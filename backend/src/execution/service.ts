import { platformFailure } from "./messages.js";
import {
  outputsMatch,
  type CaseGroup,
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
import { recordSubmission } from "../progress/summary.js";
import { stressCases } from "../problems/stress.js";
import { validateCustomInput } from "../problems/inputValidation.js";
import { runQueued } from "./queue.js";

const submitRateLimit = new Map<string, number>();

export class SubmitTooSoon extends Error {
  constructor() {
    super("You just submitted this problem. Give it a few seconds, then submit again.");
  }
}
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

/** The most cases of their own a learner can add to Test and Submit. */
export const MAX_OWN_CASES = 10;

/** Test was sent cases, and not one of them can be judged. */
export class NoUsableCases extends Error {
  constructor(skipped: Array<{ index: number; reason: string }>) {
    const first = skipped[0];
    super(first ? `Case ${first.index}: ${first.reason}` : "There are no cases to test.");
  }
}

/**
 * The reference solution's answers for several inputs in one sandbox run,
 * cached like single answers. An input it cannot handle gets a message.
 */
export const expectedOutputs = async (
  problem: Problem,
  inputs: Array<Record<string, unknown>>
): Promise<ExpectedOutputResponse[]> => {
  const keys = inputs.map((input) => `${problem.id}:${JSON.stringify(input)}`);
  const missing = [...new Set(keys.filter((key) => !expectedCache.has(key)))];
  if (missing.length) {
    const toRun = missing.map((key) => inputs[keys.indexOf(key)]);
    const config = configFor("python");
    const payload: RunnerPayload = {
      ...basePayload(problem, problem.referenceCode),
      cases: toRun.map((input) => ({ input })),
      trace: false,
      stepLimit: 0,
      visualizeLimit: 0,
      caseTimeoutMs: config.caseTimeoutMs
    };
    const budget = config.startupMs + toRun.length * (config.caseTimeoutMs + 500);
    const queued = await runQueued(() => runInDocker<RawBatchResponse>(payload, budget, "python")).catch(queueFailure);
    const batch = queued.value;
    missing.forEach((key, at) => {
      const execution = batch.ok ? (batch.cases[at] as ExecutionResponse | undefined) : batch;
      // Our failure, not the input's: leave it uncached so the next try runs again.
      if (!execution || (!execution.ok && execution.errorType === "Platform Error")) return;
      const response: ExpectedOutputResponse = execution.ok
        ? { ok: true, expectedOutput: execution.result }
        : {
            ok: false,
            message: "The reference solution could not handle this input, so it is probably outside the problem's constraints."
          };
      if (expectedCache.size > 500) expectedCache.delete(expectedCache.keys().next().value!);
      expectedCache.set(key, response);
    });
  }
  return keys.map(
    (key) =>
      expectedCache.get(key) ?? {
        ok: false,
        message: "We couldn't work out the expected answer right now. Please try again in a moment."
      }
  );
};

/**
 * The learner's own cases, ready to judge: each checked against the
 * signature, then answered by the problem's own case when the input is one of
 * those, or by the reference solution. A case that cannot be used is reported
 * by its place in the Testcase tab rather than silently dropped.
 */
export const resolveOwnCases = async (
  problem: Problem,
  inputs: Array<Record<string, unknown>>
): Promise<{ cases: ProblemTestCase[]; skipped: Array<{ index: number; reason: string }> }> => {
  const skipped: Array<{ index: number; reason: string }> = [];
  const known = new Map(
    problem.testCases.filter((entry) => entry.visible).map((entry) => [JSON.stringify(entry.input), entry])
  );
  const ready: Array<{ at: number; testCase: ProblemTestCase }> = [];
  const pending: Array<{ at: number; input: Record<string, unknown> }> = [];

  inputs.slice(0, MAX_OWN_CASES).forEach((input, at) => {
    const invalid = validateCustomInput(problem, input);
    if (invalid) {
      skipped.push({ index: at + 1, reason: `This input doesn't fit the problem: ${invalid}` });
      return;
    }
    const sample = known.get(JSON.stringify(input));
    if (sample) ready.push({ at, testCase: { ...sample, id: `case-${at + 1}`, group: "sample" } });
    else pending.push({ at, input });
  });

  if (pending.length) {
    const answers = await expectedOutputs(
      problem,
      pending.map((entry) => entry.input)
    );
    pending.forEach((entry, position) => {
      const answer = answers[position];
      if (answer.ok) {
        ready.push({
          at: entry.at,
          testCase: {
            id: `case-${entry.at + 1}`,
            input: entry.input,
            expectedOutput: answer.expectedOutput,
            visible: true,
            group: "custom"
          }
        });
      } else {
        skipped.push({ index: entry.at + 1, reason: answer.message ?? "The expected answer is unknown." });
      }
    });
  }
  ready.sort((left, right) => left.at - right.at);
  skipped.sort((left, right) => left.index - right.index);
  return { cases: ready.map((entry) => entry.testCase), skipped };
};

const groupOf = (testCase: ProblemTestCase): CaseGroup => testCase.group ?? (testCase.visible ? "sample" : "hidden");

const breakdownOf = (cases: ProblemTestCase[]) => {
  const breakdown: Partial<Record<CaseGroup, number>> = {};
  for (const testCase of cases) breakdown[groupOf(testCase)] = (breakdown[groupOf(testCase)] ?? 0) + 1;
  return breakdown;
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
  language: Language = "python",
  /**
   * Submit stops at the first case that fails, as judges do. Test reports
   * every visible case, so each one can be looked at.
   */
  stopAtFirstFailure = true
): Promise<TestResponse> => {
  const started = performance.now();
  const totalCases = cases.length;
  const config = configFor(language);
  const payload: RunnerPayload = {
    ...basePayload(problem, code),
    cases: cases.map((testCase) => ({ input: testCase.input })),
    trace: false,
    stepLimit: 0,
    visualizeLimit: 0,
    caseTimeoutMs: config.caseTimeoutMs,
    // A judge stops at the first crash or timeout, so a runaway loop costs
    // one case's time limit rather than a hundred of them.
    stopOnError: stopAtFirstFailure
  };
  const budget = config.startupMs + cases.length * (config.caseTimeoutMs + 500);

  const queued = await runQueued(() => runInDocker<RawBatchResponse>(payload, budget, language)).catch(
    queueFailure
  );
  const batch = queued.value;
  const elapsed = () => Math.round(performance.now() - started);
  const breakdown = breakdownOf(cases);

  if (!batch.ok) {
    // Compile errors and sandbox failures stop every case at once.
    const first = cases[0];
    return {
      verdict: batch.errorType,
      runtimeMs: elapsed(),
      totalCases,
      breakdown,
      cases: [
        {
          id: first?.id ?? "compile",
          visible: first?.visible ?? true,
          group: first ? groupOf(first) : "sample",
          status: "error",
          input: first && (first.visible || revealHidden) ? first.input : undefined,
          execution: batch
        }
      ]
    };
  }

  const results: CaseResult[] = [];
  const compare = problem.signature.compare ?? "exact";
  // The first thing that went wrong decides the verdict.
  let verdict: TestResponse["verdict"] = "Accepted";

  const done = (): TestResponse => ({ verdict, cases: results, runtimeMs: elapsed(), totalCases, breakdown });

  for (const [index, testCase] of cases.entries()) {
    const execution = batch.cases[index] as ExecutionResponse | undefined;
    const group = groupOf(testCase);
    const shown = testCase.visible || revealHidden;
    // A failing stress case is shown in full, as LeetCode shows the last
    // input it ran: among a hundred generated cases there is no answer key to
    // protect, and the input is what a learner needs to find the bug. The
    // hand-written hidden cases stay sealed.
    const shownOnFailure = shown || group === "stress";

    if (!execution) {
      results.push({
        id: testCase.id,
        visible: testCase.visible,
        group,
        status: "error",
        execution: platformFailure(`case result (${problem.id})`, "no result for this case")
      });
      verdict = "Platform Error";
      return done();
    }

    if (!execution.ok) {
      results.push({
        id: testCase.id,
        visible: shownOnFailure,
        group,
        status: "error",
        input: shownOnFailure ? testCase.input : undefined,
        expectedOutput: shownOnFailure ? testCase.expectedOutput : undefined,
        execution: shownOnFailure ? execution : { ...execution, traceback: undefined, stdout: undefined }
      });
      if (verdict === "Accepted") verdict = execution.errorType;
      if (stopAtFirstFailure) return done();
      continue;
    }

    const passed = outputsMatch(execution.result, testCase.expectedOutput, compare);
    const reveal = passed ? shown : shownOnFailure;
    results.push({
      id: testCase.id,
      visible: reveal,
      group,
      status: passed ? "passed" : "failed",
      input: reveal ? testCase.input : undefined,
      expectedOutput: reveal ? testCase.expectedOutput : undefined,
      actualOutput: reveal ? execution.result : undefined,
      execution: reveal ? execution : { ...execution, result: undefined, stdout: "" }
    });

    if (!passed) {
      if (verdict === "Accepted") verdict = "Wrong Answer";
      if (stopAtFirstFailure) return done();
    }
  }

  return done();
};

/**
 * Test: the cases in the learner's Testcase tab, in that order, or the
 * problem's visible cases when none are sent. Edited and added cases are
 * answered by the reference solution first.
 */
export const testProblem = async (
  problem: Problem,
  code: string,
  language: Language = "python",
  inputs?: Array<Record<string, unknown>>
): Promise<TestResponse> => {
  if (!inputs?.length) {
    return runCases(problem, code, problem.testCases.filter((testCase) => testCase.visible), true, language, false);
  }
  const { cases, skipped } = await resolveOwnCases(problem, inputs);
  // Nothing usable: say why, rather than "Accepted" on nothing.
  if (!cases.length) throw new NoUsableCases(skipped);
  const response = await runCases(problem, code, cases, true, language, false);
  return skipped.length ? { ...response, skippedCases: skipped } : response;
};

/** Everything Submit judges before the learner's own cases: samples, hidden cases, then the stress suite. */
export const judgeCases = (problem: Problem): ProblemTestCase[] => [...problem.testCases, ...stressCases(problem.id)];

export const verifyProblemReference = (problem: Problem, code: string, language: Language = "python") =>
  runCases(problem, code, problem.testCases, true, language);

export const submitProblem = async (
  problem: Problem,
  code: string,
  userId = "local",
  language: Language = "python",
  ownInputs: Array<Record<string, unknown>> = []
): Promise<SubmitResponse> => {
  const rateKey = `${userId}:${problem.id}`;
  const previous = submitRateLimit.get(rateKey) ?? 0;
  const now = Date.now();

  // A second Submit of the same problem within a few seconds is almost always
  // a double click. It is turned away as exactly that (the route answers 429
  // with this message), never dressed up as an error in the learner's code.
  if (now - previous < 3000) {
    throw new SubmitTooSoon();
  }

  submitRateLimit.set(rateKey, now);
  const cases = judgeCases(problem);
  let skipped: Array<{ index: number; reason: string }> = [];
  if (ownInputs.length) {
    // The learner's own cases go last, and only those the judge does not already have.
    const have = new Set(cases.map((testCase) => JSON.stringify(testCase.input)));
    const own = await resolveOwnCases(problem, ownInputs);
    skipped = own.skipped;
    for (const testCase of own.cases) {
      const key = JSON.stringify(testCase.input);
      if (have.has(key)) continue;
      have.add(key);
      cases.push({ ...testCase, visible: true, group: "custom" });
    }
  }
  const judged = await runCases(problem, code, cases, false, language);
  const response: TestResponse = skipped.length ? { ...judged, skippedCases: skipped } : judged;
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

  await recordSubmission(record);

  return {
    ...response,
    submissionId,
    persisted: true,
    userId
  };
};
