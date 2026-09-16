import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  CircleDashed,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  X
} from "lucide-react";
import {
  computeDiffs,
  expandTrace,
  LANGUAGE_LABELS,
  LANGUAGE_TRACING,
  SUPPORTED_LANGUAGES,
  type CaseResult,
  type ExecutionResponse,
  type Language,
  type PublicProblem,
  type TestResponse,
  type TraceDiff,
  type TraceStep
} from "@nodeflow/shared";
import { api } from "../lib/api";
import { loadProblems, structureLabel } from "../lib/problems";
import { useSession } from "../lib/session";
import { cn } from "../lib/cn";
import { LogoMark } from "../components/Logo";
import { Modal } from "../components/Modal";
import { ThemeToggle } from "../components/ThemeToggle";
import { AccountMenu } from "../components/layout/AccountMenu";
import { button, chip, field } from "../components/ui";
import { TraceDiagram } from "../trace/TraceDiagram";
import CodeEditorPane from "./CodeEditorPane";
import PlaybackControls from "./PlaybackControls";
import { baseNodeId, buildLineIndex, buildSceneGraph } from "./scene/graph";

// three.js is ~1MB. Splitting it out lets the editor, problem header and
// transport paint immediately instead of waiting on the renderer to download.
const Scene3D = lazy(() => import("./scene/Scene3D"));

/** Compiled languages pay for a compile per preview, so they wait longer. */
const PREVIEW_DEBOUNCE_MS: Record<Language, number> = { python: 650, cpp: 1600, java: 1600 };
const STEP_BASE_MS = 700;
const STUCK_AFTER_MS = 4500;
/** A run this slow means the sandbox is cold, queued, or wedged. */
const SLOW_RUN_MS = 20000;

type StuckReason = "playback" | "sandbox";
type TraceSource = "preview" | "run";
type SceneMode = "trace" | "3d";

const SCENE_MODE_KEY = "noesis:scene-mode";

const readSceneMode = (): SceneMode => {
  try {
    return window.localStorage.getItem(SCENE_MODE_KEY) === "3d" ? "3d" : "trace";
  } catch {
    return "trace";
  }
};

/** Tracers send heap deltas; the replay needs full heaps and per-step diffs. */
const toTraceState = (response: ExecutionResponse): TraceState => {
  const trace = expandTrace(response.trace ?? [], response.heapMode);
  return { trace, diffs: computeDiffs(trace) };
};

/** Backend verdicts that mean "your code never terminated". */
const LOOP_ERRORS = new Set(["Execution Limit", "Time Limit Exceeded"]);

interface TraceState {
  trace: TraceStep[];
  diffs: TraceDiff[];
}

const EMPTY_TRACE: TraceState = { trace: [], diffs: [] };

const show = (value: unknown) => JSON.stringify(value);

/** Pulls `message` out of a JSON error body; request errors carry the raw body. */
const readError = (error: unknown, fallback: string) => {
  if (!(error instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(error.message) as { message?: string };
    return parsed.message ?? error.message;
  } catch {
    return error.message || fallback;
  }
};

const panelTitle = "text-ui-label text-blueprint-muted";

function ExecutionErrorNote({ execution }: { execution: Extract<ExecutionResponse, { ok: false }> }) {
  // Keep "your code failed" visually apart from "Noesis failed".
  if (execution.errorType === "Platform Error") {
    return (
      <div className="status-warning rounded-xl border px-4 py-3 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle size={15} aria-hidden /> Noesis could not run this — not a problem with your code
        </p>
        <p className="mt-1">{execution.message}</p>
      </div>
    );
  }

  return (
    <div className="status-error rounded-xl border px-4 py-3 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <AlertCircle size={15} aria-hidden /> Your code raised {execution.errorType}
      </p>
      <p className="mt-1 break-words">{execution.message}</p>
      {execution.traceback && (
        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed opacity-90">
          {execution.traceback}
        </pre>
      )}
    </div>
  );
}

function CaseRow({ result, index }: { result: CaseResult; index: number }) {
  const passed = result.status === "passed";
  const failedExecution = result.execution && !result.execution.ok ? result.execution : null;

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blueprint-line">
          {passed ? (
            <Check size={13} aria-hidden className="check-icon" />
          ) : (
            <X size={12} aria-hidden className="text-red-600 dark:text-red-300" />
          )}
        </span>
        <span className="text-sm font-medium text-primary">Case {index + 1}</span>
        <span className="text-technical-mono text-blueprint-muted">
          {result.visible ? "visible" : "hidden"}
        </span>
        <span className="ml-auto text-xs text-blueprint-muted">
          {passed ? "Passed" : result.status === "error" ? "Error" : "Wrong answer"}
        </span>
      </div>

      {!passed && !result.visible && (
        <p className="mt-2 flex items-center gap-2 pl-9 text-xs text-blueprint-muted">
          <Lock size={12} aria-hidden /> Hidden case: its input and expected output stay sealed.
        </p>
      )}

      {!passed && result.visible && (
        <div className="mt-2 grid gap-1.5 pl-9 font-mono text-xs">
          {result.input && (
            <p className="text-blueprint-muted">
              input <span className="text-primary">{show(result.input)}</span>
            </p>
          )}
          <p className="text-blueprint-muted">
            expected <span className="text-primary">{show(result.expectedOutput)}</span>
          </p>
          {result.status === "failed" && (
            <p className="text-blueprint-muted">
              yours <span className="text-primary">{show(result.actualOutput)}</span>
            </p>
          )}
          {failedExecution && <p className="text-red-700 dark:text-red-300">{failedExecution.message}</p>}
        </div>
      )}
    </li>
  );
}

export default function WorkspacePage() {
  const session = useSession();
  const { problemId: routeProblemId } = useParams<{ problemId?: string }>();

  const [problems, setProblems] = useState<PublicProblem[]>([]);
  const [language, setLanguage] = useState<Language>("python");
  const [code, setCode] = useState("");

  const [traceState, setTraceState] = useState<TraceState>(EMPTY_TRACE);
  const [traceSource, setTraceSource] = useState<TraceSource | null>(null);
  const [traceInfo, setTraceInfo] = useState<{ truncated: boolean; note?: string }>({ truncated: false });
  const [sceneMode, setSceneModeState] = useState<SceneMode>(readSceneMode);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const [busy, setBusy] = useState<"run" | "test" | "submit" | null>(null);
  const [execution, setExecution] = useState<ExecutionResponse | null>(null);
  const [judgement, setJudgement] = useState<TestResponse | null>(null);
  const [notice, setNotice] = useState("");
  const [ranAt, setRanAt] = useState("");
  const [statementOpen, setStatementOpen] = useState(true);

  // Edge-case surfaces.
  const [staleTrace, setStaleTrace] = useState(false);
  const [loopWarning, setLoopWarning] = useState<string | null>(null);
  const [stuck, setStuck] = useState<StuckReason | null>(null);

  const previewAbort = useRef<AbortController | null>(null);

  const setSceneMode = (mode: SceneMode) => {
    setSceneModeState(mode);
    try {
      window.localStorage.setItem(SCENE_MODE_KEY, mode);
    } catch {
      // Preference only lasts this visit.
    }
  };

  const problem = useMemo(() => {
    if (!problems.length) return null;
    return problems.find((entry) => entry.id === routeProblemId) ?? problems[0];
  }, [problems, routeProblemId]);

  // Keyed on the id, not the object: the problems array gets a fresh identity on
  // every refetch, and resetting off object identity wiped live state.
  const activeProblemId = problem?.id ?? "";
  const tracingSupported = LANGUAGE_TRACING[language];

  useEffect(() => {
    let mounted = true;

    loadProblems()
      .then((list) => {
        if (mounted) setProblems(list);
      })
      .catch(() => {
        if (mounted) setNotice("Could not load problems. Check that the Noesis backend is running, then reload.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    document.title = problem ? `${problem.title} · Noesis` : "Workspace · Noesis";
  }, [problem]);

  // Looked up through a ref so the reset below can depend on the problem *id*
  // alone. Depending on the object re-fired this effect whenever the problems
  // array got a new identity, wiping a trace that had just arrived.
  const problemsRef = useRef<PublicProblem[]>([]);
  problemsRef.current = problems;

  // Switching problem or language reloads the matching starter stub.
  useEffect(() => {
    const target = problemsRef.current.find((entry) => entry.id === activeProblemId);
    if (!target) return;

    setCode(target.starterCodeByLanguage?.[language] ?? target.starterCode ?? "");
    setTraceState(EMPTY_TRACE);
    setTraceSource(null);
    setTraceInfo({ truncated: false });
    setExecution(null);
    setJudgement(null);
    setIndex(0);
    setPlaying(false);
    setSelectedNode(null);
    setStaleTrace(false);
    setLoopWarning(null);
    setRanAt("");
  }, [activeProblemId, language]);

  /** Applies an execution result, preserving the last good trace on failure. */
  const applyExecution = useCallback((response: ExecutionResponse, fromPreview: boolean) => {
    // A quiet preview failure must not replace a real run's output.
    if (!fromPreview || response.ok) setExecution(response);

    if (response.ok) {
      setTraceState(toTraceState(response));
      setTraceInfo({ truncated: Boolean(response.traceTruncated), note: response.traceNote });
      setTraceSource(fromPreview ? "preview" : "run");
      setIndex(0);
      setStaleTrace(false);
      setLoopWarning(null);
      return;
    }

    if (LOOP_ERRORS.has(response.errorType)) {
      setLoopWarning(
        response.errorType === "Time Limit Exceeded"
          ? "Execution hit the time limit. This usually means a loop never exits."
          : "Execution hit the step limit. This usually means a loop never exits."
      );
    }

    // A partial trace is still worth playing; it shows where it got stuck.
    const partial = response.trace ?? [];
    if (partial.length) {
      setTraceState(toTraceState(response));
      setTraceInfo({ truncated: true });
      setTraceSource(fromPreview ? "preview" : "run");
      setIndex(0);
      setStaleTrace(false);
      return;
    }

    // Nothing usable came back — hold whatever was last valid.
    setStaleTrace(fromPreview);
  }, []);

  // Debounced live preview. Mid-typing syntax errors are expected, so a failed
  // preview holds the previous scene instead of clearing it.
  useEffect(() => {
    if (!problem || !code.trim() || !tracingSupported) return;

    const timer = window.setTimeout(() => {
      previewAbort.current?.abort();
      const controller = new AbortController();
      previewAbort.current = controller;

      api
        .livePreview(problem.id, code, controller.signal, language)
        .then((response) => applyExecution(response.execution, true))
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setStaleTrace(true);
        });
    }, PREVIEW_DEBOUNCE_MS[language]);

    return () => window.clearTimeout(timer);
  }, [problem, code, language, tracingSupported, applyExecution]);

  useEffect(() => () => previewAbort.current?.abort(), []);

  const { trace, diffs } = traceState;
  const stepCount = trace.length;

  // Playback advances the trace cursor only — never the camera.
  useEffect(() => {
    if (!playing || stepCount === 0) return;

    const interval = window.setInterval(() => {
      setIndex((current) => {
        if (current >= stepCount - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, STEP_BASE_MS / speed);

    return () => window.clearInterval(interval);
  }, [playing, speed, stepCount]);

  // Stuck detection, cause one: playing, but the cursor has not moved.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setStuck("playback"), STUCK_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [playing, index]);

  // Cause two: a run that never comes back. This is the one users actually hit,
  // when the sandbox image is cold or the queue is saturated.
  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => setStuck("sandbox"), SLOW_RUN_MS);
    return () => window.clearTimeout(timer);
  }, [busy]);

  const currentStep = trace[Math.min(index, Math.max(0, stepCount - 1))];
  const graph = useMemo(() => buildSceneGraph(currentStep), [currentStep]);
  const lineIndex = useMemo(() => buildLineIndex(trace, diffs), [trace, diffs]);

  // Heap ids that changed to produce this step's state, expanded to the ids the
  // scene renders (an array container becomes one node per cell).
  const activeIds = useMemo(() => {
    const touched = new Set<string>();
    const diff = diffs[index];

    if (diff) {
      for (const id of diff.created ?? []) touched.add(id);
      for (const mutation of diff.mutated ?? []) touched.add(mutation.id);
    }

    const expanded = new Set<string>();
    for (const node of graph.nodes) {
      if (touched.has(baseNodeId(node.id))) expanded.add(node.id);
    }
    return expanded;
  }, [diffs, index, graph.nodes]);

  const activeLine = currentStep?.line ?? null;

  /** Scene -> editor: jump playback to where this node was last touched. */
  const handleSelectNode = useCallback(
    (id: string | null) => {
      setSelectedNode(id);
      if (!id) return;

      const steps = lineIndex.nodeToSteps.get(baseNodeId(id));
      if (!steps?.length) return;

      setPlaying(false);
      const previous = [...steps].reverse().find((step) => step <= index);
      setIndex(previous ?? steps[0]);
    },
    [lineIndex, index]
  );

  /** Editor -> scene: jump to the clicked line and select what it changed. */
  const handleLineClick = useCallback(
    (line: number) => {
      const pick = <T,>(entries: T[], stepOf: (entry: T) => number): T =>
        entries.find((entry) => stepOf(entry) >= index) ?? entries[0];

      const touches = lineIndex.lineToNodes.get(line);
      if (touches?.length) {
        const touch = pick(touches, (entry) => entry.step);
        setPlaying(false);
        setSelectedNode(touch.id);
        setIndex(touch.step);
        return;
      }

      const steps = lineIndex.lineToSteps.get(line);
      if (!steps?.length) return;

      setPlaying(false);
      setSelectedNode(null);
      setIndex(pick(steps, (step) => step));
    },
    [lineIndex, index]
  );

  const runCode = useCallback(async () => {
    if (!problem) return;
    setBusy("run");
    setNotice("");
    setJudgement(null);

    try {
      const response = await api.run(problem.id, code, problem.defaultInput, language);
      applyExecution(response, false);
      // A successful run that prints nothing used to look like nothing happened.
      setRanAt(
        response.ok
          ? `Ran in ${Math.round(response.runtimeMs)}ms and returned ${JSON.stringify(response.result)}`
          : ""
      );
    } catch (error) {
      setNotice(readError(error, "Run failed."));
    } finally {
      setBusy(null);
    }
  }, [problem, code, language, applyExecution]);

  const runJudge = useCallback(
    async (mode: "test" | "submit") => {
      if (!problem) return;
      setBusy(mode);
      setNotice("");
      setRanAt("");

      try {
        const response =
          mode === "test"
            ? await api.test(problem.id, code, language)
            : await api.submitWithSession(problem.id, code, session.token, language);
        setJudgement(response);
      } catch (error) {
        setNotice(readError(error, `${mode === "test" ? "Test" : "Submit"} failed.`));
      } finally {
        setBusy(null);
      }
    },
    [problem, code, language, session.token]
  );

  const failedExecution = execution && !execution.ok ? execution : null;
  const passedCount = judgement ? judgement.cases.filter((entry) => entry.status === "passed").length : 0;
  const hasOutput = Boolean(
    loopWarning || notice || failedExecution || ranAt || judgement || (execution?.ok && execution.stdout) || busy
  );

  const sceneStatus = !tracingSupported
    ? `${LANGUAGE_LABELS[language]} · no visual trace`
    : stepCount === 0
      ? "Waiting for a trace"
      : traceSource === "preview"
        ? "Live preview"
        : "Run trace";

  const actionButton = (mode: "run" | "test" | "submit", label: string, primary = false) => (
    <button
      type="button"
      onClick={() => (mode === "run" ? runCode() : runJudge(mode))}
      disabled={busy !== null || !problem}
      className={cn(primary ? button.primary : button.outlineSm, "px-4 py-2")}
      style={{ minHeight: 0, width: "auto" }}
    >
      {busy === mode ? (
        <Loader2 size={14} className="animate-spin" aria-hidden />
      ) : primary ? (
        <Play size={13} aria-hidden />
      ) : null}
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background lg:h-screen lg:overflow-hidden">
      <header className="app-header sticky top-0 z-40 shrink-0">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-5">
          <NavLink to="/" aria-label="Noesis home" className="flex items-center text-primary">
            <LogoMark className="h-7" />
          </NavLink>
          <span className="mx-1 h-6 w-px bg-blueprint-line" aria-hidden />
          <NavLink to="/problems" className={cn(button.ghost, "px-2 sm:px-3")}>
            <ArrowLeft size={14} aria-hidden />
            <span className="hidden sm:inline">Problems</span>
          </NavLink>
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
            {problem?.title ?? (notice ? "Workspace" : "Loading…")}
          </p>
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>

      <div className="grid flex-1 gap-3 p-3 sm:gap-4 sm:p-4 lg:min-h-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)_auto]">
        {/* Problem statement */}
        <section
          aria-label="Problem"
          className="surface-frame overflow-hidden lg:col-start-2 lg:row-start-1"
        >
          <div className="flex items-start justify-between gap-3 px-5 pt-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {problem ? (
                  <>
                    <span className={cn(chip.small, "text-primary")}>{problem.topic}</span>
                    <span className={cn(chip.small, "text-blueprint-muted")}>{problem.difficulty}</span>
                    {structureLabel(problem.structureType).toLowerCase() !== problem.topic.toLowerCase() && (
                      <span className="text-technical-mono text-blueprint-muted">
                        {structureLabel(problem.structureType)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className={panelTitle}>Problem</span>
                )}
              </div>
              <h1 className="mt-2 text-headline-sm text-primary">{problem?.title ?? "Loading problem…"}</h1>
            </div>
            <button
              type="button"
              onClick={() => setStatementOpen((open) => !open)}
              aria-expanded={statementOpen}
              aria-controls="problem-statement"
              className={cn(button.icon, "h-9 w-9")}
              style={{ minHeight: 0 }}
              aria-label={statementOpen ? "Collapse problem statement" : "Expand problem statement"}
            >
              <ChevronDown
                size={16}
                aria-hidden
                className={cn("transition-transform duration-300", statementOpen && "rotate-180")}
              />
            </button>
          </div>

          {statementOpen && (
            <div
              id="problem-statement"
              className="max-h-[38vh] overflow-y-auto px-5 pb-6 pt-3 lg:max-h-[30vh]"
              // Fade the bottom edge so a clipped statement reads as scrollable.
              style={{ maskImage: "linear-gradient(to bottom, black calc(100% - 28px), transparent)" }}
            >
              {problem ? (
                <>
                  <p className="text-body-md text-primary">{problem.description}</p>

                  {problem.examples.length > 0 && (
                    <div className="mt-4 grid gap-2">
                      {problem.examples.slice(0, 2).map((example, exampleIndex) => (
                        <div key={exampleIndex} className="surface-inset py-3 font-mono text-xs leading-relaxed sm:py-3">
                          <p className="text-blueprint-muted">
                            input <span className="text-primary">{show(example.input)}</span>
                          </p>
                          <p className="text-blueprint-muted">
                            output <span className="text-primary">{show(example.output)}</span>
                          </p>
                          {example.explanation && (
                            <p className="mt-1 font-sans text-[13px] text-blueprint-muted">{example.explanation}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {problem.constraints.length > 0 && (
                    <ul className="mt-4 grid gap-1.5">
                      {problem.constraints.map((constraint) => (
                        <li key={constraint} className="flex gap-2 text-sm text-blueprint-muted">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blueprint-muted" aria-hidden />
                          {constraint}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : notice ? (
                <p className="text-body-md text-blueprint-muted">{notice}</p>
              ) : (
                <div className="grid gap-2" aria-hidden>
                  <span className="h-3 w-5/6 animate-pulse rounded-full bg-surface-inset" />
                  <span className="h-3 w-2/3 animate-pulse rounded-full bg-surface-inset" />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Scene + transport */}
        <section
          aria-label="Data structure visualization"
          className="surface-frame flex h-[62vh] min-h-[380px] flex-col overflow-hidden lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:h-auto lg:min-h-0"
        >
          <div className="flex items-center justify-between gap-3 border-b border-blueprint-line px-4 py-2.5 sm:px-5">
            <div
              role="tablist"
              aria-label="Visualization style"
              className="inline-flex rounded-full border border-blueprint-line bg-background p-0.5"
            >
              {(["trace", "3d"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={sceneMode === mode}
                  onClick={() => setSceneMode(mode)}
                  className={cn(
                    "no-lift rounded-full px-3 py-1 text-ui-label text-[12px] transition-colors",
                    sceneMode === mode ? "bg-primary text-primary-foreground" : "text-blueprint-muted hover:text-primary"
                  )}
                  style={{ minHeight: 0, width: "auto" }}
                >
                  {mode === "trace" ? "Trace" : "3D"}
                </button>
              ))}
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
                traceSource === "preview" && stepCount > 0
                  ? "badge-current"
                  : "border-blueprint-line text-blueprint-muted"
              )}
            >
              {stepCount === 0 && tracingSupported && <CircleDashed size={12} aria-hidden />}
              {sceneStatus}
            </span>
          </div>

          <div className="relative min-h-0 flex-1">
            {sceneMode === "trace" ? (
              stepCount > 0 ? (
                <TraceDiagram trace={trace} diffs={diffs} index={Math.min(index, stepCount - 1)} signature={problem?.signature} />
              ) : (
                <div className="blueprint-grid h-full bg-card opacity-60" />
              )
            ) : (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center bg-card">
                  <span className="text-technical-mono text-blueprint-muted">Loading renderer…</span>
                </div>
              }
            >
              <Scene3D
                graph={graph}
                activeIds={activeIds}
                selectedId={selectedNode}
                onSelectNode={handleSelectNode}
                onWebGLError={() => setStuck("playback")}
              />
            </Suspense>
            )}

            {stepCount === 0 && tracingSupported && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <p className="max-w-xs rounded-2xl border border-blueprint-line bg-card/90 px-5 py-4 text-center text-body-md text-blueprint-muted backdrop-blur-sm">
                  Start typing or press Run. The scene is drawn from the trace your code produces.
                </p>
              </div>
            )}

            {((staleTrace && stepCount > 0) || !tracingSupported || (stepCount > 0 && (traceInfo.truncated || traceInfo.note))) && (
              <div className="pointer-events-none absolute inset-x-4 top-3 flex justify-center">
                <p className="max-w-md rounded-full border border-blueprint-line bg-card/95 px-3 py-1.5 text-center text-xs text-blueprint-muted shadow-[0_10px_26px_rgba(0,0,0,0.07)]">
                  {!tracingSupported
                    ? `${LANGUAGE_LABELS[language]} runs and judges, but does not produce a visual trace yet.`
                    : staleTrace
                      ? "Code is mid-edit, so this is the last trace that ran."
                      : traceInfo.note ?? `Replay shows the first ${stepCount} steps; the rest ran without recording.`}
                </p>
              </div>
            )}
          </div>

          <PlaybackControls
            index={index}
            count={stepCount}
            playing={playing}
            speed={speed}
            line={activeLine}
            onIndex={setIndex}
            onPlaying={setPlaying}
            onSpeed={setSpeed}
          />
        </section>

        {/* Editor */}
        <section
          aria-label="Code editor"
          className="surface-frame flex h-[64vh] min-h-[360px] flex-col overflow-hidden lg:col-start-2 lg:row-start-2 lg:h-auto lg:min-h-[260px]"
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-blueprint-line px-4 py-2.5">
            <label className="min-w-0 flex-1 sm:flex-none">
              <span className="sr-only">Language</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                className={cn(field.select, "h-9 w-full text-xs sm:w-auto")}
              >
                {SUPPORTED_LANGUAGES.map((option) => (
                  <option key={option} value={option}>
                    {LANGUAGE_LABELS[option]}
                    {LANGUAGE_TRACING[option] ? "" : " (no visual trace)"}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
              {actionButton("run", "Run", true)}
              {actionButton("test", "Test")}
              {actionButton("submit", "Submit")}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <CodeEditorPane
              value={code}
              language={language}
              activeLine={activeLine}
              onChange={setCode}
              onLineClick={handleLineClick}
            />
          </div>
        </section>

        {/* Output */}
        <section
          aria-label="Output"
          aria-live="polite"
          className="surface-frame overflow-hidden lg:col-start-2 lg:row-start-3"
        >
          <div className="flex items-center justify-between gap-3 border-b border-blueprint-line px-5 py-3">
            <span className={panelTitle}>Output</span>
            {judgement && (
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
                  judgement.verdict === "Accepted" ? "badge-current" : "status-error"
                )}
              >
                {judgement.verdict} · {passedCount}/{judgement.cases.length}
              </span>
            )}
          </div>

          <div className="grid max-h-[40vh] gap-3 overflow-y-auto px-5 py-4 lg:max-h-[24vh]">
            {!hasOutput && (
              <p className="text-body-md text-blueprint-muted">
                <span className="font-medium text-primary">Run</span> executes once and draws the trace.{" "}
                <span className="font-medium text-primary">Test</span> checks the visible cases.{" "}
                <span className="font-medium text-primary">Submit</span> checks all of them
                {session.user ? " and saves the result." : "."}
              </p>
            )}

            {busy && (
              <p className="flex items-center gap-2 text-sm text-blueprint-muted">
                <Loader2 size={14} aria-hidden className="animate-spin" />
                {busy === "run" ? "Running in the sandbox…" : busy === "test" ? "Testing visible cases…" : "Judging every case…"}
              </p>
            )}

            {loopWarning && (
              <p className="status-warning flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
                <AlertTriangle size={15} aria-hidden className="shrink-0" />
                {loopWarning}
              </p>
            )}

            {notice && (
              <div className="status-warning rounded-xl border px-4 py-3 text-sm">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle size={15} aria-hidden /> Noesis could not complete that request
                </p>
                <p className="mt-1 break-words">{notice}</p>
              </div>
            )}

            {failedExecution && !loopWarning && <ExecutionErrorNote execution={failedExecution} />}

            {ranAt && !failedExecution && (
              <p className="flex items-center gap-2 text-sm text-primary">
                <Check size={14} aria-hidden className="check-icon shrink-0" />
                <span className="break-all font-mono text-xs">{ranAt}</span>
              </p>
            )}

            {execution?.ok && execution.stdout ? (
              <div>
                <p className="text-technical-mono text-blueprint-muted">stdout</p>
                <pre className="surface-inset mt-1.5 overflow-x-auto py-3 font-mono text-xs leading-relaxed text-primary sm:py-3">
                  {execution.stdout}
                </pre>
              </div>
            ) : null}

            {judgement && (
              <ul className="divide-y divide-blueprint-line">
                {judgement.cases.map((result, caseIndex) => (
                  <CaseRow key={result.id} result={result} index={caseIndex} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <Modal
        open={stuck !== null}
        onClose={() => setStuck(null)}
        eyebrow={stuck === "sandbox" ? "Sandbox" : "Playback"}
        title={stuck === "sandbox" ? "Still waiting on the sandbox" : "The replay stopped advancing"}
        actions={
          <>
            <button
              type="button"
              className={button.outlineSm}
              onClick={() => {
                setStuck(null);
                setPlaying(false);
                setIndex(0);
              }}
            >
              Reset playback
            </button>
            <button
              type="button"
              className={button.primary}
              onClick={() => {
                setStuck(null);
                setPlaying(false);
                setIndex(0);
                void runCode();
              }}
            >
              <RefreshCw size={14} aria-hidden /> Run again
            </button>
          </>
        }
      >
        {stuck === "sandbox"
          ? "This run has been going for a while. The sandbox image may be starting cold, or the queue may be backed up."
          : "Playback has not moved for a few seconds. The trace may be empty, or the scene may have failed to draw."}
      </Modal>
    </div>
  );
}
