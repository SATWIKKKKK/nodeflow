import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Lock } from "lucide-react";
import type { CaseResult, ExecutionResponse, ProblemSignature, TestResponse } from "@nodeflow/shared";
import { verdictLabel } from "../../lib/verdict";
import { cn } from "../../lib/cn";
import { FieldLabel, InputFields, ValueBox } from "./values";

/**
 * Test Result: what the last Run, Test or Submit came back with, laid out as
 * LeetCode lays it out — the verdict in its colour with the runtime beside
 * it, one chip per case, then that case's input, output and expected value.
 *
 * The motion is kept to what explains something: while the judge works the
 * shape of the answer shimmers in place (so nothing jumps when it lands), and
 * the answer settles in with one short rise, the verdict's mark drawing
 * itself as it does.
 */

export type ResultState =
  | {
      kind: "run";
      at: number;
      input: Record<string, unknown>;
      /** "Example 2" or "Your input". */
      source: string;
      execution: ExecutionResponse;
      /** Known for an example or a custom input the reference solution answered. */
      expected?: { value: unknown } | { pending: true } | { note: string };
      /** Whether the output matches what was expected, once both are known. */
      match: boolean | null;
    }
  | {
      kind: "test" | "submit";
      at: number;
      judgement: TestResponse;
      coins?: number;
    };

type Tone = "pass" | "fail" | "slow" | "plain";

const toneOf = (verdict: string): Tone =>
  verdict === "Accepted"
    ? "pass"
    : verdict === "Time Limit Exceeded" || verdict === "Execution Limit" || verdict === "Platform Error"
      ? "slow"
      : "fail";

const TONE_COLOR: Record<Tone, string> = {
  pass: "text-[var(--verdict-pass)]",
  fail: "text-[var(--verdict-fail)]",
  slow: "text-[var(--verdict-slow)]",
  plain: "text-primary"
};

const EASE = [0.22, 1, 0.36, 1] as const;

/** A tick or a cross that draws itself, beside the verdict. */
function VerdictMark({ tone }: { tone: Tone }) {
  const still = useReducedMotion();
  if (tone === "plain") return null;
  const draw = (delay: number) =>
    still
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { pathLength: { duration: 0.42, ease: EASE, delay }, opacity: { duration: 0.01, delay } }
        };
  return (
    <svg viewBox="0 0 24 24" className={cn("h-[22px] w-[22px] shrink-0", TONE_COLOR[tone])} fill="none" aria-hidden>
      <motion.circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" strokeOpacity="0.35" {...draw(0)} />
      {tone === "pass" ? (
        <motion.path d="M7.5 12.4l3 3 6-6.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...draw(0.16)} />
      ) : tone === "fail" ? (
        <motion.path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...draw(0.16)} />
      ) : (
        <motion.path d="M12 7v5.5l3.2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...draw(0.16)} />
      )}
    </svg>
  );
}

function Headline({ tone, title, runtimeMs, children }: { tone: Tone; title: string; runtimeMs?: number; children?: ReactNode }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-2">
          <VerdictMark tone={tone} />
          <h3 className={cn("text-[19px] font-semibold leading-none tracking-[-0.01em]", TONE_COLOR[tone])}>{title}</h3>
        </span>
        {runtimeMs !== undefined && (
          <span className="text-[13px] text-blueprint-muted">
            Runtime: <span className="font-mono text-primary">{Math.round(runtimeMs)} ms</span>
          </span>
        )}
      </div>
      {children && <div className="mt-2 text-[13px] leading-relaxed text-blueprint-muted">{children}</div>}
    </div>
  );
}

function ErrorBox({ execution }: { execution: Extract<ExecutionResponse, { ok: false }> }) {
  const ours = execution.errorType === "Platform Error";
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2.5 font-mono text-[12.5px] leading-relaxed",
        ours ? "verdict-box-slow" : "verdict-box-fail"
      )}
    >
      <p className="whitespace-pre-wrap break-words">
        {ours ? "This one is on our side, not your code. Please try again in a moment." : execution.message}
      </p>
      {!ours && execution.traceback && (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap opacity-85">{execution.traceback}</pre>
      )}
    </div>
  );
}

function Stdout({ execution }: { execution: ExecutionResponse }) {
  if (!execution.ok || !execution.stdout) return null;
  return (
    <div>
      <FieldLabel>Stdout</FieldLabel>
      <ValueBox value={execution.stdout.replace(/\n$/, "")} raw />
    </div>
  );
}

/** One case's detail: what went in, what came out, what should have. */
function CaseDetail({ result, signature }: { result: CaseResult; signature?: ProblemSignature }) {
  const failedExecution = !result.execution.ok ? result.execution : null;
  if (!result.visible) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-surface-inset px-3 py-3 text-[13px] text-blueprint-muted">
        <Lock size={13} aria-hidden className="shrink-0" />
        A hidden case: its input and expected output stay sealed. Check the edge cases the examples skip.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      {failedExecution && <ErrorBox execution={failedExecution} />}
      {result.input && (
        <div>
          <FieldLabel>Input</FieldLabel>
          <InputFields input={result.input} signature={signature} />
        </div>
      )}
      {result.status !== "error" && (
        <div>
          <FieldLabel>Output</FieldLabel>
          <ValueBox value={result.actualOutput} tone={result.status === "failed" ? "wrong" : undefined} />
        </div>
      )}
      <div>
        <FieldLabel>Expected</FieldLabel>
        <ValueBox value={result.expectedOutput} />
      </div>
      <Stdout execution={result.execution} />
    </div>
  );
}

function CaseChips({
  cases,
  selected,
  onSelect,
  label
}: {
  cases: CaseResult[];
  selected: number;
  onSelect: (at: number) => void;
  label: (at: number) => string;
}) {
  const still = useReducedMotion();
  return (
    <div role="tablist" aria-label="Cases" className="flat-tabs flex flex-wrap gap-1.5">
      {cases.map((entry, at) => {
        const passed = entry.status === "passed";
        return (
          <motion.button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={at === selected}
            onClick={() => onSelect(at)}
            initial={still ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + at * 0.035, duration: 0.22, ease: EASE }}
            className={cn(
              "case-chip no-lift flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors",
              at === selected ? "case-chip-on text-primary" : "text-blueprint-muted hover:bg-surface-hover hover:text-primary"
            )}
            style={{ minHeight: 0 }}
          >
            <span
              aria-hidden
              className={cn("h-1.5 w-1.5 rounded-full", passed ? "bg-[var(--verdict-pass)]" : "bg-[var(--verdict-fail)]")}
            />
            {label(at)}
            <span className="sr-only">{passed ? "passed" : "failed"}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function JudgeResult({
  result,
  signature
}: {
  result: Extract<ResultState, { kind: "test" | "submit" }>;
  signature?: ProblemSignature;
}) {
  const { judgement, kind } = result;
  const total = judgement.totalCases ?? judgement.cases.length;
  const passed = judgement.cases.filter((entry) => entry.status === "passed").length;
  const firstFailing = judgement.cases.findIndex((entry) => entry.status !== "passed");
  const [selected, setSelected] = useState(Math.max(0, firstFailing));
  useEffect(() => setSelected(Math.max(0, firstFailing)), [result.at, firstFailing]);

  const down = judgement.verdict === "Platform Error";
  const tone = toneOf(judgement.verdict);
  const title = down ? "Couldn't run" : verdictLabel(judgement.verdict);

  // A submit can carry dozens of cases, most of them hidden. Like LeetCode,
  // it shows the count and the first case that failed, not a wall of chips.
  const shownCases = kind === "test" ? judgement.cases : firstFailing >= 0 ? [judgement.cases[firstFailing]] : [];
  const current = kind === "test" ? judgement.cases[selected] : shownCases[0];

  return (
    <div className="grid gap-4">
      <Headline tone={tone} title={title} runtimeMs={down ? undefined : judgement.runtimeMs}>
        {down ? (
          "This one is on our side, not your code. Please try again in a moment."
        ) : kind === "submit" ? (
          <>
            <span className="font-medium text-primary">
              {passed} / {total}
            </span>{" "}
            testcases passed{tone === "pass" ? ", hidden ones included" : ""}
            {result.coins ? (
              <span className="ml-2.5 font-medium text-[var(--difficulty-medium)]">+{result.coins} coins</span>
            ) : null}
          </>
        ) : tone === "pass" ? (
          "Every visible case passes. Submit to run the hidden cases too."
        ) : (
          <>
            <span className="font-medium text-primary">
              {passed} / {total}
            </span>{" "}
            visible cases passed
          </>
        )}
      </Headline>

      {!down && kind === "test" && (
        <CaseChips cases={judgement.cases} selected={selected} onSelect={setSelected} label={(at) => `Case ${at + 1}`} />
      )}
      {!down && kind === "submit" && firstFailing >= 0 && (
        <p className="-mb-1 text-xs font-medium text-blueprint-muted">
          First failing case · {firstFailing + 1} of {total}
        </p>
      )}
      {!down && current && (
        <motion.div
          key={`${result.at}-${current.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
        >
          <CaseDetail result={current} signature={signature} />
        </motion.div>
      )}
    </div>
  );
}

function RunResult({ result, signature }: { result: Extract<ResultState, { kind: "run" }>; signature?: ProblemSignature }) {
  const { execution, expected } = result;
  if (!execution.ok) {
    const tone: Tone =
      execution.errorType === "Platform Error" ||
      execution.errorType === "Time Limit Exceeded" ||
      execution.errorType === "Execution Limit"
        ? "slow"
        : "fail";
    const loop = execution.errorType === "Time Limit Exceeded" || execution.errorType === "Execution Limit";
    return (
      <div className="grid gap-4">
        <Headline tone={tone} title={verdictLabel(execution.errorType)}>
          {loop ? "The run hit its limit before finishing. This usually means a loop never exits." : null}
        </Headline>
        {!loop && <ErrorBox execution={execution} />}
        <div>
          <FieldLabel>Input · {result.source}</FieldLabel>
          <InputFields input={result.input} signature={signature} />
        </div>
      </div>
    );
  }

  const tone: Tone = result.match === null ? "plain" : result.match ? "pass" : "fail";
  const title = result.match === null ? "Finished" : result.match ? "Correct" : "Wrong Answer";
  return (
    <div className="grid gap-4">
      <Headline tone={tone} title={title} runtimeMs={execution.runtimeMs}>
        {result.match === null
          ? "Your code ran to the end. The replay on the left shows every step."
          : result.match
            ? `Right for ${result.source.toLowerCase()}. Test runs every visible case.`
            : `Different from the expected answer for ${result.source.toLowerCase()}.`}
      </Headline>
      <div className="grid gap-3">
        <div>
          <FieldLabel>Input · {result.source}</FieldLabel>
          <InputFields input={result.input} signature={signature} />
        </div>
        <div>
          <FieldLabel>Output</FieldLabel>
          <ValueBox value={execution.result} tone={result.match === false ? "wrong" : undefined} />
        </div>
        {expected && (
          <div>
            <FieldLabel>Expected</FieldLabel>
            {"value" in expected ? (
              <ValueBox value={expected.value} />
            ) : "pending" in expected ? (
              <span className="skeleton block h-10 w-full rounded-lg" aria-label="Working out the expected answer" />
            ) : (
              <p className="rounded-lg bg-surface-inset px-3 py-2.5 text-[13px] text-blueprint-muted">{expected.note}</p>
            )}
          </div>
        )}
        <Stdout execution={execution} />
      </div>
    </div>
  );
}

function Pending({ busy, visibleCount }: { busy: "run" | "test" | "submit"; visibleCount: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [busy]);
  const what =
    busy === "run"
      ? "Running your code"
      : busy === "test"
        ? `Running ${visibleCount} visible case${visibleCount === 1 ? "" : "s"}`
        : "Judging every case, hidden ones included";
  return (
    <div className="grid gap-4" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="skeleton h-[22px] w-[22px] rounded-full" />
        <span className="skeleton h-[18px] w-32" />
        <span className="skeleton h-3.5 w-20" />
      </div>
      <p className="-mt-1 text-[13px] text-blueprint-muted">
        {what}…{seconds >= 3 && <span className="ml-1.5 font-mono text-[12px]">{seconds}s</span>}
        {seconds >= 12 && <span className="ml-1.5">The first run after a quiet spell takes a little longer.</span>}
      </p>
      {busy === "test" && (
        <div className="flex gap-1.5">
          {Array.from({ length: Math.min(Math.max(visibleCount, 1), 6) }, (_, at) => (
            <span key={at} className="skeleton h-7 w-[70px] rounded-md" />
          ))}
        </div>
      )}
      <div className="grid gap-3">
        <span className="skeleton h-3 w-12" />
        <span className="skeleton h-11 w-full rounded-lg" />
        <span className="skeleton h-3 w-14" />
        <span className="skeleton h-11 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function ResultPanel({
  result,
  busy,
  notice,
  visibleCount,
  signature
}: {
  result: ResultState | null;
  busy: "run" | "test" | "submit" | null;
  notice: string;
  visibleCount: number;
  signature?: ProblemSignature;
}) {
  const still = useReducedMotion();

  if (busy) return <Pending busy={busy} visibleCount={visibleCount} />;

  if (notice) {
    return (
      <div className="verdict-box-slow rounded-lg px-3 py-3 text-[13px] leading-relaxed" role="alert">
        <p className="font-semibold">We couldn&apos;t complete that</p>
        <p className="mt-1 break-words opacity-90">{notice}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 text-center">
        <p className="text-[13px] text-blueprint-muted">Run, Test or Submit, and the result shows up here.</p>
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11.5px] text-blueprint-muted">
          <span>
            <kbd className="kbd">Ctrl</kbd> <kbd className="kbd">Enter</kbd> Run
          </span>
          <span>
            <kbd className="kbd">Ctrl</kbd> <kbd className="kbd">&apos;</kbd> Test
          </span>
          <span>
            <kbd className="kbd">Ctrl</kbd> <kbd className="kbd">Shift</kbd> <kbd className="kbd">Enter</kbd> Submit
          </span>
        </p>
      </div>
    );
  }

  return (
    <motion.div
      key={result.at}
      initial={still ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: EASE }}
      aria-live="polite"
    >
      {result.kind === "run" ? (
        <RunResult result={result} signature={signature} />
      ) : (
        <JudgeResult result={result} signature={signature} />
      )}
    </motion.div>
  );
}
