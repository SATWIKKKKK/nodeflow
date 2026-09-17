import fs from "node:fs";
import path from "node:path";
import {
  outputsMatch,
  type CaseResult,
  type ExecutionResponse,
  type ExpectedOutputResponse,
  type Language,
  type LivePreviewResponse,
  type Problem,
  type ProblemTestCase,
  type SubmitResponse,
  type TestResponse
} from "@nodeflow/shared";
import { runInDocker, type RawBatchResponse, type RawRunnerError, type RunnerPayload } from "./dockerRunner.js";
import { configFor } from "./languages.js";
import { runQueued } from "./queue.js";
import { dataDir } from "../paths.js";

const submissionsPath = path.join(dataDir, "submissions.json");
const submitRateLimit = new Map<string, number>();
/** A preview only needs to show the start of a runaway loop, so it gives up quickly. */
const PREVIEW_CASE_TIMEOUT_MS = 1500;

const basePayload = (problem: Problem, code: string): Omit<RunnerPayload, "stepLimit" | "visualizeLimit"> => ({
  code,
  entrypoint: problem.signature.functionName,
  parameters: problem.signature.parameters,
  returnKind: problem.signature.returnKind,
  sharedTail: problem.signature.sharedTail,
  design: problem.signature.design
});

const queueFailure = (error: unknown): { value: RawRunnerError; queuedMs: number } => ({
  value: {
    ok: false,
    errorType: "Platform Error",
    message: error instanceof Error ? error.message : "The execution queue is unavailable."
  },
  queuedMs: 0
});

/** One traced execution (Run and the live preview). */
export const runProblemCase = async (
  problem: Problem,
  code: string,
  input: Record<string, unknown>,
  options: {
    stepLimit?: number;
    visualizeLimit?: number;
    timeoutMs?: number;
    language?: Language;
    trace?: boolean;
    /** Live previews stop at the step budget and give native runs a shorter clock. */
    preview?: boolean;
  } = {}
): Promise<ExecutionResponse> => {
  const language = options.language ?? "python";
  const config = configFor(language);
  const payload: RunnerPayload = {
    ...basePayload(problem, code),
    input,
    trace: options.trace ?? true,
    stepLimit: options.stepLimit ?? config.runStepLimit,
    visualizeLimit: options.visualizeLimit ?? 64,
    stopAtStepLimit: options.preview,
    caseTimeoutMs: options.preview ? PREVIEW_CASE_TIMEOUT_MS : config.caseTimeoutMs + 2000
  };

  const queued = await runQueued(() =>
    runInDocker(payload, options.timeoutMs ?? config.timeoutMs, language)
  ).catch(queueFailure);

  return { ...queued.value, queuedMs: queued.queuedMs } as ExecutionResponse;
};

export const previewProblem = async (
  problem: Problem,
  code: string,
  language: Language = "python",
  input?: Record<string, unknown>
): Promise<LivePreviewResponse> => {
  const config = configFor(language);
  const execution = await runProblemCase(problem, code, input ?? problem.defaultInput, {
    stepLimit: config.previewStepLimit,
    visualizeLimit: 48,
    language,
    preview: true
  });

  return {
    mode: "live",
    ok: execution.ok,
    execution,
    quiet: !execution.ok,
    source: input ? "custom_input" : "default_input"
  };
};

const expectedCache = new Map<string, ExpectedOutputResponse>();

/**
 * The reference solution's answer for a custom input, so a learner can check
 * their own case. References are Python and run untraced; answers are cached.
 */
export const expectedOutput = async (
  problem: Problem,
  input: Record<string, unknown>
): Promise<ExpectedOutputResponse> => {
  const key = `${problem.id}:${JSON.stringify(input)}`;
  const cached = expectedCache.get(key);
  if (cached) return cached;

  const execution = await runProblemCase(problem, problem.referenceCode, input, {
    trace: false,
    stepLimit: 0,
    visualizeLimit: 0,
    language: "python"
  });
  const response: ExpectedOutputResponse = execution.ok
    ? { ok: true, expectedOutput: execution.result }
    : {
        ok: false,
        message:
          execution.errorType === "Platform Error"
            ? execution.message
            : "The reference solution could not handle this input, so it is probably outside the problem's constraints."
      };

  if (execution.ok || execution.errorType !== "Platform Error") {
    if (expectedCache.size > 500) expectedCache.delete(expectedCache.keys().next().value!);
    expectedCache.set(key, response);
  }
  return response;
};

/**
 * Every case of a Test/Submit runs in one sandbox container: the program is
 * compiled once and each case gets its own time budget. Cases run untraced, so
 * judging is fast and independent of the replay's step budget.
 */
const runCases = async (
  problem: Problem,
  code: string,
  cases: ProblemTestCase[],
  revealHidden: boolean,
  language: Language = "python"
): Promise<TestResponse> => {
  const started = performance.now();
  const config = configFor(language);
  const payload: RunnerPayload = {
    ...basePayload(problem, code),
    cases: cases.map((testCase) => ({ input: testCase.input })),
    trace: false,
    stepLimit: 0,
    visualizeLimit: 0,
    caseTimeoutMs: config.caseTimeoutMs
  };
  const budget = config.startupMs + cases.length * (config.caseTimeoutMs + 500);

  const queued = await runQueued(() => runInDocker<RawBatchResponse>(payload, budget, language)).catch(
    queueFailure
  );
  const batch = queued.value;
  const elapsed = () => Math.round(performance.now() - started);

  if (!batch.ok) {
    // Compile errors and sandbox failures stop every case at once.
    const first = cases[0];
    return {
      verdict: batch.errorType,
      runtimeMs: elapsed(),
      cases: [
        {
          id: first?.id ?? "compile",
          visible: first?.visible ?? true,
          status: "error",
          input: first && (first.visible || revealHidden) ? first.input : undefined,
          execution: batch
        }
      ]
    };
  }

  const results: CaseResult[] = [];
  const compare = problem.signature.compare ?? "exact";

  for (const [index, testCase] of cases.entries()) {
    const execution = batch.cases[index] as ExecutionResponse | undefined;
    const reveal = testCase.visible || revealHidden;

    if (!execution) {
      results.push({
        id: testCase.id,
        visible: testCase.visible,
        status: "error",
        execution: { ok: false, errorType: "Platform Error", message: "The sandbox returned no result for this case." }
      });
      return { verdict: "Platform Error", cases: results, runtimeMs: elapsed() };
    }

    if (!execution.ok) {
      results.push({
        id: testCase.id,
        visible: testCase.visible,
        status: "error",
        input: reveal ? testCase.input : undefined,
        expectedOutput: reveal ? testCase.expectedOutput : undefined,
        execution: reveal ? execution : { ...execution, traceback: undefined, stdout: undefined }
      });
      return { verdict: execution.errorType, cases: results, runtimeMs: elapsed() };
    }

    const passed = outputsMatch(execution.result, testCase.expectedOutput, compare);
    results.push({
      id: testCase.id,
      visible: testCase.visible,
      status: passed ? "passed" : "failed",
      input: reveal ? testCase.input : undefined,
      expectedOutput: reveal ? testCase.expectedOutput : undefined,
      actualOutput: reveal ? execution.result : undefined,
      execution: reveal ? execution : { ...execution, result: undefined, stdout: "" }
    });

    if (!passed) {
      return { verdict: "Wrong Answer", cases: results, runtimeMs: elapsed() };
    }
  }

  return { verdict: "Accepted", cases: results, runtimeMs: elapsed() };
};

export const testProblem = (problem: Problem, code: string, language: Language = "python") =>
  runCases(
    problem,
    code,
    problem.testCases.filter((testCase) => testCase.visible),
    true,
    language
  );

export const verifyProblemReference = (problem: Problem, code: string, language: Language = "python") =>
  runCases(problem, code, problem.testCases, true, language);

export const submitProblem = async (
  problem: Problem,
  code: string,
  userId = "local",
  language: Language = "python"
): Promise<SubmitResponse> => {
  const rateKey = `${userId}:${problem.id}`;
  const previous = submitRateLimit.get(rateKey) ?? 0;
  const now = Date.now();

  if (now - previous < 3000) {
    return {
      submissionId: `rate-limited-${now}`,
      persisted: false,
      userId,
      verdict: "Runtime Error",
      runtimeMs: 0,
      cases: [
        {
          id: "rate-limit",
          visible: true,
          status: "error",
          execution: {
            ok: false,
            errorType: "Platform Error",
            message: "Please wait a few seconds before submitting this problem again."
          }
        }
      ]
    };
  }

  submitRateLimit.set(rateKey, now);
  const response = await runCases(problem, code, problem.testCases, false, language);
  const submissionId = `${problem.id}-${now}`;
  // A sandbox failure says nothing about the learner's code, so it is not recorded as an attempt.
  if (response.verdict === "Platform Error") {
    return { ...response, submissionId, persisted: false, userId };
  }
  const record = {
    submissionId,
    userId,
    problemId: problem.id,
    language,
    code,
    verdict: response.verdict,
    runtimeMs: response.runtimeMs,
    timestamp: new Date(now).toISOString()
  };

  fs.mkdirSync(dataDir, { recursive: true });
  const existing = fs.existsSync(submissionsPath)
    ? (JSON.parse(fs.readFileSync(submissionsPath, "utf8")) as unknown[])
    : [];
  existing.push(record);
  fs.writeFileSync(submissionsPath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");

  return {
    ...response,
    submissionId,
    persisted: true,
    userId
  };
};
