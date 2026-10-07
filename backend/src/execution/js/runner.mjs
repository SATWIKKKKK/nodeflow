/**
 * JavaScript and TypeScript sandbox harness.
 *
 * Same JSON payload and response as python/tracer.py, read from stdin and
 * written to stdout. TypeScript has its types removed by Sucrase, which keeps
 * every line where it was, so messages and the trace use the learner's own
 * line numbers; then both languages run the same way.
 *
 * Each case runs in its own worker thread with a memory cap, inside a fresh
 * `vm` context holding only the language's built-ins (no require, no process).
 * A case that never ends is stopped by the context's timer; a worker that
 * runs out of memory dies alone, and the other cases still run.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const USER_FILE = "user.js";
const MAX_STDOUT = 64_000;

// ---------------------------------------------------------------------------
// Worker: one case
// ---------------------------------------------------------------------------

if (!isMainThread) {
  const { code, spec, entry, timeoutMs } = workerData;
  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  const prelude = fs.readFileSync(path.join(HERE, "prelude.js"), "utf8");
  new vm.Script(prelude, { filename: "nf-prelude.js" }).runInContext(context);

  const started = Date.now();
  const deadline = () => Math.max(50, timeoutMs - (Date.now() - started));
  let message;
  try {
    new vm.Script(code, { filename: USER_FILE }).runInContext(context, { timeout: deadline() });
    const getter = (name) => `() => (typeof ${name} !== "undefined" ? ${name} : undefined)`;
    const call = `__nf_run(${JSON.stringify(spec)}, ${getter(entry)}, ${getter("Solution")})`;
    message = { kind: "done", outcome: new vm.Script(call, { filename: "nf-case.js" }).runInContext(context, { timeout: deadline() }) };
  } catch (error) {
    const timedOut = error && error.code === "ERR_SCRIPT_EXECUTION_TIMEOUT";
    let partial = null;
    try {
      partial = vm.runInContext("__nf_partial()", context, { timeout: 2000 });
    } catch {
      partial = null;
    }
    message = {
      kind: timedOut ? "timeout" : "error",
      partial,
      error: {
        name: error && error.name ? String(error.name) : "Error",
        message: error && error.message !== undefined ? String(error.message) : String(error),
        stack: error && error.stack ? String(error.stack) : ""
      },
      runtimeMs: Date.now() - started
    };
  }
  parentPort.postMessage(message);
} else {
  main();
}

// ---------------------------------------------------------------------------
// Main: compile, run cases, shape the response
// ---------------------------------------------------------------------------

function failure(errorType, message, started, extra = {}) {
  const response = { ok: false, errorType, message, runtimeMs: Math.round(performance.now() - started) };
  for (const [key, value] of Object.entries(extra)) if (value !== undefined && value !== null) response[key] = value;
  return response;
}

const camel = (value) => value.replace(/_([a-z0-9])/g, (_match, char) => char.toUpperCase());

/** The learner's frames from a stack, and the line of the innermost one. */
function userTrace(error) {
  const lines = String(error.stack || "").split("\n");
  const head = `${error.name}: ${error.message}`;
  const frames = lines.filter((line) => line.includes(`${USER_FILE}:`)).map((line) => line.replace(/\s*\(?file:\/\/[^)]*\)?/, ""));
  const match = frames.length ? frames[0].match(new RegExp(`${USER_FILE.replace(".", "\\.")}:(\\d+)`)) : null;
  return {
    traceback: [head, ...frames.map((line) => line.replace(/__nf_f|__nf\./g, ""))].join("\n").slice(-4000),
    line: match ? Number(match[1]) : undefined
  };
}

function describeError(error) {
  if (error.name === "RangeError" && /call stack/i.test(error.message)) {
    return "Maximum call stack size exceeded. Check your base case.";
  }
  return `${error.name}: ${error.message}`;
}

/** Heap deltas between steps, exactly as common/nf_trace.py writes them. */
function deltaEncode(steps) {
  let previous = new Map();
  for (const step of steps) {
    const heap = step.heap || {};
    const current = new Map();
    const changed = {};
    for (const [ref, object] of Object.entries(heap)) {
      const encoded = JSON.stringify(object);
      current.set(ref, encoded);
      if (previous.get(ref) !== encoded) changed[ref] = object;
    }
    const removed = [...previous.keys()].filter((ref) => !current.has(ref));
    step.heap = changed;
    if (removed.length) step.removed = removed;
    previous = current;
  }
  return steps;
}

function runWorker(job, timeoutMs) {
  return new Promise((resolve) => {
    const worker = new Worker(fileURLToPath(import.meta.url), {
      workerData: { ...job, timeoutMs },
      resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 48, stackSizeMb: 4 },
      stdout: true,
      stderr: true
    });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(backstop);
      worker.terminate().catch(() => undefined);
      resolve(value);
    };
    // The context's own timer stops a runaway case; this catches anything it misses.
    const backstop = setTimeout(() => finish({ kind: "timeout", partial: null, error: { name: "Error", message: "", stack: "" } }), timeoutMs + 3000);
    worker.on("message", finish);
    worker.on("error", (error) =>
      finish({
        kind: "crash",
        error: {
          name: error.name || "Error",
          message: error.code === "ERR_WORKER_OUT_OF_MEMORY" ? "Your code used more memory than allowed." : String(error.message || error),
          stack: ""
        }
      })
    );
    worker.on("exit", () => finish({ kind: "crash", error: { name: "Error", message: "The run stopped unexpectedly.", stack: "" } }));
  });
}

/** Turns what a worker reported into the shape the API expects for one case. */
function shapeCase(report, started, stepLimit) {
  if (report.kind === "done") {
    const outcome = JSON.parse(report.outcome);
    const stdout = (outcome.stdout || "").slice(0, MAX_STDOUT);
    if (outcome.ok) {
      return { response: { ok: true, result: outcome.result, stdout, runtimeMs: outcome.runtimeMs }, steps: outcome.steps, truncated: outcome.truncated };
    }
    if (outcome.stopped) {
      const last = outcome.steps[outcome.steps.length - 1];
      return {
        response: failure("Execution Limit", `The live preview stopped after ${stepLimit} steps.`, started, { line: last ? last.line : undefined, stdout }),
        steps: outcome.steps,
        truncated: true
      };
    }
    const { traceback, line } = userTrace(outcome.error);
    return {
      response: failure("Runtime Error", describeError(outcome.error), started, { traceback, line, stdout }),
      steps: outcome.steps,
      truncated: outcome.truncated
    };
  }
  const partial = report.partial ? JSON.parse(report.partial) : { steps: [], stdout: "", truncated: false };
  const stdout = (partial.stdout || "").slice(0, MAX_STDOUT);
  if (report.kind === "timeout") {
    return {
      response: failure("Time Limit Exceeded", "Your code ran longer than the time limit.", started, { stdout }),
      steps: partial.steps,
      truncated: true
    };
  }
  if (report.kind === "error") {
    // Thrown while the learner's top-level code ran, before the call.
    const { traceback, line } = userTrace(report.error);
    return { response: failure("Runtime Error", describeError(report.error), started, { traceback, line, stdout }), steps: partial.steps, truncated: false };
  }
  return { response: failure("Runtime Error", report.error.message, started, { stdout }), steps: [], truncated: false };
}

async function loadTools() {
  const require = (await import("node:module")).createRequire(import.meta.url);
  return {
    sucrase: require("sucrase"),
    instrument: (await import("./instrument.mjs")).instrument
  };
}

/** TypeScript to JavaScript on the same lines, then a syntax check. Returns { code } or { error }. */
function prepare(payload, tools, started) {
  let code = payload.code;
  if (payload.language === "typescript") {
    try {
      code = tools.sucrase.transform(code, {
        transforms: ["typescript"],
        disableESTransforms: true,
        filePath: "user.ts"
      }).code;
    } catch (error) {
      const match = String(error.message).match(/\((\d+):(\d+)\)/);
      const line = match ? Number(match[1]) : undefined;
      return {
        error: failure("Compile Error", `${line ? `Line ${line}: ` : ""}${String(error.message).replace(/^Error transforming [^:]+:\s*/, "").replace(/\s*\(\d+:\d+\)\s*$/, "")}`, started, {
          traceback: String(error.message),
          line
        })
      };
    }
  }
  try {
    new vm.Script(code, { filename: USER_FILE });
  } catch (error) {
    const match = String(error.stack).match(new RegExp(`${USER_FILE.replace(".", "\\.")}:(\\d+)`));
    const line = match ? Number(match[1]) : undefined;
    return {
      error: failure("Compile Error", `${line ? `Line ${line}: ` : ""}${error.name}: ${error.message}`, started, {
        traceback: String(error.stack).split("\n").slice(0, 5).join("\n"),
        line
      })
    };
  }
  return { code };
}

async function main() {
  const started = performance.now();
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    process.stdout.write(JSON.stringify(failure("Platform Error", "The JavaScript harness could not read its job.", started)));
    return;
  }

  const tools = await loadTools();
  const prepared = prepare(payload, tools, started);
  const batch = Array.isArray(payload.cases);
  if (prepared.error) {
    if (!batch) prepared.error.trace = [];
    process.stdout.write(JSON.stringify(prepared.error));
    return;
  }

  const entry = payload.design ? payload.design.className : camel(payload.entrypoint);
  const caseTimeout = Number(payload.caseTimeoutMs || 3000);
  const baseSpec = {
    name: entry,
    parameters: payload.parameters,
    returnKind: payload.returnKind,
    sharedTail: payload.sharedTail,
    design: payload.design
  };

  if (batch) {
    const cases = [];
    for (const item of payload.cases) {
      const caseStarted = performance.now();
      const spec = JSON.stringify({ ...baseSpec, input: item.input || {}, trace: false });
      const report = await runWorker({ code: prepared.code, spec, entry }, caseTimeout);
      cases.push(shapeCase(report, caseStarted, 0).response);
    }
    process.stdout.write(JSON.stringify({ ok: true, cases }));
    return;
  }

  const wantTrace = payload.trace !== false;
  const stepLimit = Number(payload.stepLimit || 1500);
  let code = prepared.code;
  let traceNote;
  if (wantTrace) {
    try {
      code = tools.instrument(prepared.code);
    } catch (error) {
      // Code that runs but that the tracer cannot read still runs, untraced.
      traceNote = "This code runs, but it could not be traced line by line.";
      code = prepared.code;
    }
  }
  const spec = JSON.stringify({
    ...baseSpec,
    input: payload.input || {},
    trace: wantTrace && !traceNote,
    stepLimit,
    stopAtStepLimit: Boolean(payload.stopAtStepLimit),
    visualizeLimit: Number(payload.visualizeLimit || 64)
  });

  let { response, steps, truncated } = shapeCase(await runWorker({ code, spec, entry }, caseTimeout), started, stepLimit);

  // Tracing slows code down even after the step budget is spent. A traced run
  // that hit the time limit is run once more untraced, so a correct answer on
  // a larger input still comes back, with the replay it managed to record.
  if (!response.ok && response.errorType === "Time Limit Exceeded" && code !== prepared.code && !payload.stopAtStepLimit) {
    const plain = JSON.stringify({ ...JSON.parse(spec), trace: false });
    const retry = shapeCase(await runWorker({ code: prepared.code, spec: plain, entry }, caseTimeout), started, stepLimit);
    if (retry.response.ok) {
      response = retry.response;
      truncated = true;
    }
  }

  response.trace = deltaEncode(steps || []);
  response.heapMode = "delta";
  if (response.ok) {
    response.stepsCaptured = response.trace.length;
    if (truncated) response.traceTruncated = true;
    if (traceNote) response.traceNote = traceNote;
  } else if (response.trace.length && !response.line) {
    response.line = response.trace[response.trace.length - 1].line;
  }
  process.stdout.write(JSON.stringify(response));
}
