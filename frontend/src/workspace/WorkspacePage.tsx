import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  X
} from "lucide-react";
import {
  computeDiffs,
  expandTrace,
  LANGUAGE_LABELS,
  LANGUAGE_TRACING,
  outputsMatch,
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
import { readError } from "../lib/errors";
import { loadProblems, structureLabel } from "../lib/problems";
import { useServerStatus } from "../lib/serverStatus";
import { useSession } from "../lib/session";
import { cn } from "../lib/cn";
import { LogoMark } from "../components/Logo";
import { Modal } from "../components/Modal";
import { ThemeToggle } from "../components/ThemeToggle";
import { AccountMenu } from "../components/layout/AccountMenu";
import { button, chip, field } from "../components/ui";
import { TraceDiagram } from "../trace/TraceDiagram";
import CodeEditorPane from "./CodeEditorPane";
import { CustomInputPanel, parseCustomInput, pretty } from "./CustomInputPanel";
import PlaybackControls from "./PlaybackControls";
import {
  clearDraft,
  readCachedProblem,
  readCachedTrace,
  readCustomInput,
  readDraft,
  readLanguage,
  writeCachedProblem,
  writeCachedTrace,
  writeCustomInput,
  writeDraft,
  writeLanguage
} from "./persist";
import { baseNodeId, buildLineIndex, buildSceneGraph } from "./scene/graph";

// three.js is ~1MB. Splitting it out lets the editor, problem header and
// transport paint immediately instead of waiting on the renderer to download.
const Scene3D = lazy(() => import("./scene/Scene3D"));

/** Compiled languages pay for a compile per preview, so they wait longer. */
const PREVIEW_DEBOUNCE_MS: Record<Language, number> = { python: 450, cpp: 1200, java: 1200 };
const STEP_BASE_MS = 600;
const STUCK_AFTER_MS = 4500;
/** A run this slow means the sandbox is cold, queued, or wedged. */
const SLOW_RUN_MS = 20000;
/** Typing, then this long with no Run/Test/Submit, earns a nudge. */
const IDLE_NUDGE_MS = 30_000;

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

interface PreviewJob {
  key: string;
  owner: string;
  problemId: string;
  code: string;
  language: Language;
  input?: Record<string, unknown>;
}

interface CustomCheck {
  input: Record<string, unknown>;
  expected?: unknown;
  message?: string;
  pending: boolean;
}

const EMPTY_TRACE: TraceState = { trace: [], diffs: [] };

const show = (value: unknown) => JSON.stringify(value);

/** Everything that determines a preview's result. */
const previewKeyOf = (language: Language, inputKey: string, code: string) => JSON.stringify([language, inputKey, code]);

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
        <span className="text-technical-mono text-blueprint-muted">{result.visible ? "visible" : "hidden"}</span>
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
  const server = useServerStatus();
  const navigate = useNavigate();
  const { problemId: routeProblemId } = useParams<{ problemId?: string }>();

  const [problem, setProblem] = useState<PublicProblem | null>(() =>
    routeProblemId ? readCachedProblem(routeProblemId) : null
  );
  const [language, setLanguageState] = useState<Language>(readLanguage);
  // Code and custom input remember which problem (and language) they belong to, so
  // a render caught mid-switch never previews one problem's code against another.
  const [editor, setEditor] = useState({ owner: "", code: "" });

  const [traceState, setTraceState] = useState<TraceState>(EMPTY_TRACE);
  const [traceSource, setTraceSource] = useState<TraceSource | null>(null);
  const [traceInfo, setTraceInfo] = useState<{ truncated: boolean; note?: string }>({ truncated: false });
  const [sceneMode, setSceneModeState] = useState<SceneMode>(readSceneMode);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const [busy, setBusy] = useState<"run" | "test" | "submit" | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [execution, setExecution] = useState<ExecutionResponse | null>(null);
  const [judgement, setJudgement] = useState<TestResponse | null>(null);
  const [customCheck, setCustomCheck] = useState<CustomCheck | null>(null);
  const [notice, setNotice] = useState("");
  const [ranAt, setRanAt] = useState("");
  const [statementOpen, setStatementOpen] = useState(true);
  const [editorFullscreen, setEditorFullscreen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Custom input, per problem.
  const [custom, setCustom] = useState({ owner: "", enabled: false, text: "" });
  const [serverInputError, setServerInputError] = useState("");

  // Idle nudge: counts user edits since the last Run/Test/Submit.
  const [edits, setEdits] = useState(0);
  const [idle, setIdle] = useState(false);

  // Edge-case surfaces.
  const [staleTrace, setStaleTrace] = useState(false);
  const [loopWarning, setLoopWarning] = useState<string | null>(null);
  const [stuck, setStuck] = useState<StuckReason | null>(null);

  const previewAbort = useRef<AbortController | null>(null);
  const queuedPreview = useRef<PreviewJob | null>(null);
  const previewSeq = useRef(0);
  const appliedSeq = useRef(0);
  const ownerRef = useRef("");
  const lastPreviewKey = useRef("");
  const lastTraceJson = useRef("");
  const problemId = problem?.id ?? "";
  const editorOwner = `${problemId}:${language}`;
  const code = editor.code;
  const codeReady = Boolean(problemId) && editor.owner === editorOwner;
  const customReady = Boolean(problemId) && custom.owner === problemId;
  ownerRef.current = editorOwner;
  const customEnabled = customReady && custom.enabled;
  const customText = customReady ? custom.text : "";
  const setCustomEnabled = (enabled: boolean) => setCustom((current) => ({ ...current, enabled }));
  const setCustomText = (text: string) => setCustom((current) => ({ ...current, text }));

  const setSceneMode = (mode: SceneMode) => {
    setSceneModeState(mode);
    try {
      window.localStorage.setItem(SCENE_MODE_KEY, mode);
    } catch {
      // Preference only lasts this visit.
    }
  };

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    writeLanguage(next);
  };

  // --- problem loading ------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    if (!routeProblemId) {
      // /workspace on its own opens the first problem in the bank.
      loadProblems()
        .then((list) => mounted && list[0] && navigate(`/workspace/${list[0].id}`, { replace: true }))
        .catch(() => mounted && setNotice("Could not load problems. Check that the Noesis backend is running, then reload."));
      return () => {
        mounted = false;
      };
    }

    const cached = readCachedProblem(routeProblemId);
    setProblem((current) => (current?.id === routeProblemId ? current : cached));
    api
      .problem(routeProblemId)
      .then((fresh) => {
        if (!mounted) return;
        writeCachedProblem(fresh);
        // Keep the object stable when nothing changed, so nothing downstream resets.
        setProblem((current) => (current && JSON.stringify(current) === JSON.stringify(fresh) ? current : fresh));
      })
      .catch(() => {
        if (mounted && !cached) setNotice("Could not load this problem. Check that the Noesis backend is running, then reload.");
      });

    return () => {
      mounted = false;
    };
  }, [routeProblemId, navigate]);

  useEffect(() => {
    document.title = problem ? `${problem.title} · Noesis` : "Workspace · Noesis";
  }, [problem]);

  // --- custom input ---------------------------------------------------------

  const problemRef = useRef<PublicProblem | null>(null);
  problemRef.current = problem;

  useEffect(() => {
    const target = problemRef.current;
    if (!target) return;
    const saved = readCustomInput(target.id);
    setCustom({ owner: target.id, enabled: saved?.enabled ?? false, text: saved?.text ?? pretty(target.defaultInput) });
    setServerInputError("");
    setCustomCheck(null);
  }, [problemId]);

  useEffect(() => {
    if (!customReady || !customText) return;
    writeCustomInput(problemId, { enabled: customEnabled, text: customText });
  }, [customReady, problemId, customEnabled, customText]);

  const parsedInput = useMemo(() => parseCustomInput(customText), [customText]);
  const customInput = customEnabled && parsedInput.value ? parsedInput.value : undefined;
  const inputKey = customInput ? JSON.stringify(customInput) : "default";
  const customError = customEnabled ? parsedInput.error ?? serverInputError : "";

  useEffect(() => setServerInputError(""), [customText]);

  // --- traces ---------------------------------------------------------------

  /** Applies an execution result, preserving the last good trace on failure. */
  const applyExecution = useCallback((response: ExecutionResponse, fromPreview: boolean) => {
    // A quiet preview failure must not replace a real run's output.
    if (!fromPreview || response.ok) setExecution(response);

    const usable = response.ok || (response.trace?.length ?? 0) > 0;
    if (usable) {
      const json = JSON.stringify(response.trace ?? []);
      // An unchanged trace (a comment or whitespace edit) keeps the scene and cursor where they are.
      const same = fromPreview && json === lastTraceJson.current;
      lastTraceJson.current = json;
      if (!same) {
        const next = toTraceState(response);
        setTraceState(next);
        // A preview shows where the code has got to; a Run replays from the top.
        setIndex(fromPreview ? Math.max(0, next.trace.length - 1) : 0);
        setPlaying(!fromPreview && next.trace.length > 1);
      }
      setTraceSource(fromPreview ? "preview" : "run");
      setTraceInfo(
        response.ok
          ? { truncated: Boolean(response.traceTruncated), note: response.traceNote }
          : {
              truncated: true,
              note: LOOP_ERRORS.has(response.errorType)
                ? fromPreview
                  ? `The preview stops after ${response.trace?.length ?? 0} steps. If this should finish sooner, a loop may never exit.`
                  : "As written, this code never finishes, so the replay stops at the step limit."
                : undefined
            }
      );
      setStaleTrace(false);
    } else {
      // Nothing usable came back — hold whatever was last valid.
      setStaleTrace(fromPreview);
    }

    if (response.ok) {
      setLoopWarning(null);
    } else if (!fromPreview && LOOP_ERRORS.has(response.errorType)) {
      setLoopWarning(
        response.errorType === "Time Limit Exceeded"
          ? "Execution hit the time limit. This usually means a loop never exits."
          : "Execution hit the step limit. This usually means a loop never exits."
      );
    }
  }, []);

  // Switching problem or language loads the draft (or starter) and, when the
  // cache holds a trace for exactly that code, paints it straight away.
  useEffect(() => {
    const target = problemRef.current;
    if (!target) return;

    const starter = target.starterCodeByLanguage?.[language] ?? target.starterCode ?? "";
    const initial = readDraft(target.id, language) ?? starter;
    setEditor({ owner: `${target.id}:${language}`, code: initial });
    setTraceState(EMPTY_TRACE);
    setTraceSource(null);
    setTraceInfo({ truncated: false });
    setExecution(null);
    setJudgement(null);
    setCustomCheck(null);
    setIndex(0);
    setPlaying(false);
    setSelectedNode(null);
    setStaleTrace(false);
    setLoopWarning(null);
    setRanAt("");
    setEdits(0);
    setIdle(false);
    lastPreviewKey.current = "";
    lastTraceJson.current = "";
    // Anything still running belongs to the previous problem or language.
    previewAbort.current?.abort();
    previewAbort.current = null;
    queuedPreview.current = null;
    appliedSeq.current = ++previewSeq.current;
    setPreviewBusy(false);

    const saved = readCustomInput(target.id);
    const savedInput = saved?.enabled ? parseCustomInput(saved.text).value : undefined;
    const key = previewKeyOf(language, savedInput ? JSON.stringify(savedInput) : "default", initial);
    const cached = readCachedTrace(target.id, language, key);
    if (cached) {
      lastPreviewKey.current = key;
      applyExecution(cached, true);
    }
  }, [problemId, language, applyExecution]);

  const handleCodeChange = useCallback(
    (next: string) => {
      setEditor((current) => ({ ...current, code: next }));
      setEdits((count) => count + 1);
      if (problemId) writeDraft(problemId, language, next);
    },
    [problemId, language]
  );

  // Live preview. The first trace for a page is requested immediately; later
  // ones wait for a pause in typing. Mid-typing syntax errors are expected, so a
  // failed preview holds the previous scene instead of clearing it.
  const stepCount = traceState.trace.length;
  const hasTrace = stepCount > 0;

  // One preview runs at a time. While it runs, only the newest code waits its
  // turn, so a slow sandbox still shows each result instead of cancelling every
  // request while the learner keeps typing.
  const startPreview = useRef<(job: PreviewJob) => void>(() => undefined);
  startPreview.current = (job: PreviewJob) => {
    const seq = ++previewSeq.current;
    const controller = new AbortController();
    previewAbort.current = controller;
    setPreviewBusy(true);

    api
      .livePreview(job.problemId, job.code, controller.signal, job.language, job.input)
      .then((response) => {
        if (seq < appliedSeq.current || ownerRef.current !== job.owner) return;
        appliedSeq.current = seq;
        lastPreviewKey.current = job.key;
        if (response.inputError) {
          setServerInputError(response.inputError);
          return;
        }
        applyExecution(response.execution, true);
        if (response.execution.ok) writeCachedTrace(job.problemId, job.language, job.key, response.execution);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (ownerRef.current !== job.owner) return;
        const message = readError(error, "");
        if (message.startsWith("Custom input:")) setServerInputError(message.replace(/^Custom input:\s*/, ""));
        else setStaleTrace(true);
      })
      .finally(() => {
        if (previewAbort.current !== controller) return;
        previewAbort.current = null;
        const next = queuedPreview.current;
        queuedPreview.current = null;
        if (next && next.owner === ownerRef.current && next.key !== lastPreviewKey.current) startPreview.current(next);
        else setPreviewBusy(false);
      });
  };

  useEffect(() => {
    if (!server.sandbox || !problem || !codeReady || !customReady || !code.trim() || !LANGUAGE_TRACING[language]) return;
    if (customEnabled && !customInput) return;

    const key = previewKeyOf(language, inputKey, code);
    if (key === lastPreviewKey.current) return;
    const job: PreviewJob = { key, owner: editorOwner, problemId: problem.id, code, language, input: customInput };

    const timer = window.setTimeout(
      () => {
        if (previewAbort.current) queuedPreview.current = job;
        else startPreview.current(job);
      },
      hasTrace ? PREVIEW_DEBOUNCE_MS[language] : 0
    );

    return () => window.clearTimeout(timer);
    // hasTrace only picks the delay; it must not re-arm the timer by itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.sandbox, problem, code, codeReady, customReady, language, inputKey, customEnabled, editorOwner]);

  useEffect(() => () => previewAbort.current?.abort(), []);

  // Idle nudge: after typing, a long pause with no Run/Test/Submit.
  useEffect(() => {
    setIdle(false);
    if (edits === 0) return;
    const timer = window.setTimeout(() => setIdle(true), IDLE_NUDGE_MS);
    return () => window.clearTimeout(timer);
  }, [edits]);

  // Fullscreen editor closes on Escape.
  useEffect(() => {
    if (!editorFullscreen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setEditorFullscreen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editorFullscreen]);

  const { trace, diffs } = traceState;

  // Playback advances the trace cursor only — never the camera. It plays once and stops.
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

  // Cause two: a run that never comes back.
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

  const settleAction = () => {
    setEdits(0);
    setIdle(false);
  };

  const runCode = useCallback(async () => {
    if (!problem) return;
    if (customEnabled && !customInput) {
      setNotice(`Fix the custom input first: ${customError || "it is not valid JSON."}`);
      return;
    }
    settleAction();
    setBusy("run");
    setNotice("");
    setJudgement(null);
    setCustomCheck(null);

    const input = customInput ?? problem.defaultInput;
    const expectedRequest = customInput ? api.expected(problem.id, customInput).catch(() => null) : null;
    if (customInput) setCustomCheck({ input: customInput, pending: true });

    try {
      const response = await api.run(problem.id, code, input, language);
      applyExecution(response, false);
      // A successful run that prints nothing used to look like nothing happened.
      setRanAt(
        response.ok ? `Ran in ${Math.round(response.runtimeMs)}ms and returned ${JSON.stringify(response.result)}` : ""
      );
      if (expectedRequest && customInput) {
        const expected = await expectedRequest;
        setCustomCheck({
          input: customInput,
          pending: false,
          expected: expected?.ok ? expected.expectedOutput : undefined,
          message: expected?.ok ? undefined : expected?.message ?? "Could not compute the expected output."
        });
      }
    } catch (error) {
      const message = readError(error, "Run failed.");
      if (message.startsWith("Custom input:")) setServerInputError(message.replace(/^Custom input:\s*/, ""));
      setNotice(message);
      setCustomCheck(null);
    } finally {
      setBusy(null);
    }
  }, [problem, code, language, applyExecution, customEnabled, customInput, customError]);

  const runJudge = useCallback(
    async (mode: "test" | "submit") => {
      if (!problem) return;
      settleAction();
      setBusy(mode);
      setNotice("");
      setRanAt("");
      setCustomCheck(null);

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

  const resetCode = () => {
    if (!problem) return;
    clearDraft(problem.id, language);
    setEditor({ owner: editorOwner, code: problem.starterCodeByLanguage?.[language] ?? problem.starterCode ?? "" });
    setConfirmReset(false);
    settleAction();
  };

  const failedExecution = execution && !execution.ok ? execution : null;
  const passedCount = judgement ? judgement.cases.filter((entry) => entry.status === "passed").length : 0;
  const hasOutput = Boolean(
    loopWarning ||
      notice ||
      failedExecution ||
      ranAt ||
      judgement ||
      customCheck ||
      (execution?.ok && execution.stdout) ||
      busy
  );
  const customMatch =
    customCheck && !customCheck.pending && customCheck.message === undefined && execution?.ok
      ? outputsMatch(execution.result, customCheck.expected, problem?.signature.compare ?? "exact")
      : null;

  const loadingScene = !hasTrace && server.sandbox && (previewBusy || busy === "run" || !problem);

  const actionButton = (mode: "run" | "test" | "submit", label: string, primary = false) => (
    <button
      type="button"
      onClick={() => (mode === "run" ? void runCode() : void runJudge(mode))}
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
          <div className="min-w-0 flex-1">
            {problem ? (
              <p className="truncate text-sm font-medium text-primary">{problem.title}</p>
            ) : (
              <span className="block h-3 w-40 animate-pulse rounded-full bg-surface-inset" aria-hidden />
            )}
          </div>
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>

      {!server.sandbox && (
        <p className="status-warning mx-3 mt-3 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm sm:mx-4" role="status">
          <AlertTriangle size={15} aria-hidden className="shrink-0" />
          This deployment has no code sandbox, so traces, Run, Test and Submit only work when Noesis runs with Docker.
        </p>
      )}

      <div className="grid flex-1 gap-3 p-3 sm:gap-4 sm:p-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Scene + transport: half the width on desktop. */}
        <section
          aria-label="Data structure visualization"
          className="surface-frame order-2 flex h-[62vh] min-h-[380px] flex-col overflow-hidden lg:order-none lg:col-start-1 lg:row-start-1 lg:h-auto lg:min-h-0"
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
            <span className="flex items-center gap-2">
              {previewBusy && hasTrace && (
                <Loader2 size={14} aria-label="Updating trace" className="animate-spin text-blueprint-muted" />
              )}
              {hasTrace && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
                    traceSource === "preview" ? "badge-current" : "border-blueprint-line text-blueprint-muted"
                  )}
                >
                  {traceSource === "preview" ? (customInput ? "Live · custom input" : "Live preview") : "Run trace"}
                </span>
              )}
            </span>
          </div>

          <div className="relative min-h-0 flex-1">
            {sceneMode === "trace" ? (
              hasTrace ? (
                <TraceDiagram
                  trace={trace}
                  diffs={diffs}
                  index={Math.min(index, stepCount - 1)}
                  signature={problem?.signature}
                />
              ) : (
                <div className="blueprint-grid h-full bg-card opacity-60" />
              )
            ) : (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center bg-card">
                    <Loader2 size={22} aria-label="Loading 3D view" className="animate-spin text-blueprint-muted" />
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

            {loadingScene && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Loader2 size={24} aria-label="Loading trace" className="animate-spin text-blueprint-muted" />
              </div>
            )}

            {hasTrace && (staleTrace || traceInfo.truncated || traceInfo.note) && (
              <div className="pointer-events-none absolute inset-x-4 top-3 flex justify-center">
                <p className="max-w-md rounded-full border border-blueprint-line bg-card/95 px-3 py-1.5 text-center text-xs text-blueprint-muted shadow-[0_10px_26px_rgba(0,0,0,0.07)]">
                  {staleTrace
                    ? "Code is mid-edit, so this is the last trace that ran."
                    : traceInfo.note ?? `Replay shows the first ${stepCount} steps; the rest ran without recording.`}
                </p>
              </div>
            )}
          </div>

          {idle && (
            <div className="flex items-center gap-3 border-t border-blueprint-line bg-surface-inset px-4 py-2.5 sm:px-5" role="status">
              <Sparkles size={16} aria-hidden className="hero-accent shrink-0" />
              <p className="min-w-0 flex-1 text-sm font-medium text-primary">What&apos;s next, DSA champ? Go ahead!</p>
              <button
                type="button"
                onClick={() => void runCode()}
                disabled={busy !== null}
                className={cn(button.outlineSm, "px-3 py-1.5 text-[11px]")}
                style={{ minHeight: 0 }}
              >
                Run
              </button>
              <button
                type="button"
                onClick={() => void runJudge("test")}
                disabled={busy !== null}
                className={cn(button.outlineSm, "hidden px-3 py-1.5 text-[11px] sm:inline-flex")}
                style={{ minHeight: 0 }}
              >
                Test
              </button>
              <button
                type="button"
                onClick={() => setIdle(false)}
                className={cn(button.icon, "h-7 w-7")}
                style={{ minHeight: 0 }}
                aria-label="Dismiss"
              >
                <X size={13} aria-hidden />
              </button>
            </div>
          )}

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

        {/* Right column: the other half on desktop, one scroll from statement to output. On phones its
            panels join the page grid so the statement can sit above the scene. */}
        <div className="contents lg:col-start-2 lg:row-start-1 lg:flex lg:min-h-0 lg:flex-col lg:gap-4 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          {/* Problem statement */}
          <section aria-label="Problem" className="surface-frame order-1 shrink-0 overflow-hidden lg:order-none">
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
                    <span className="h-5 w-24 animate-pulse rounded-full bg-surface-inset" aria-hidden />
                  )}
                </div>
                {problem ? (
                  <h1 className="mt-2 text-headline-sm text-primary">{problem.title}</h1>
                ) : (
                  <span className="mt-3 block h-6 w-56 animate-pulse rounded-full bg-surface-inset" aria-hidden />
                )}
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

            {statementOpen ? (
              <div id="problem-statement" className="px-5 pb-5 pt-3">
                {problem ? (
                  <>
                    <p className="text-body-md text-primary">{problem.description}</p>

                    {problem.examples.length > 0 && (
                      <div className="mt-4 grid gap-2">
                        {problem.examples.slice(0, 3).map((example, exampleIndex) => (
                          <div key={exampleIndex} className="surface-inset py-3 font-mono text-xs leading-relaxed sm:py-3">
                            <p className="break-words text-blueprint-muted">
                              input <span className="text-primary">{show(example.input)}</span>
                            </p>
                            <p className="break-words text-blueprint-muted">
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
            ) : (
              <div className="pb-4" />
            )}
          </section>

          {/* Editor */}
          <section
            aria-label="Code editor"
            className={cn(
              "surface-frame order-3 flex flex-col overflow-hidden lg:order-none",
              editorFullscreen ? "fixed inset-2 z-[60] shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:inset-4" : "h-[64vh] min-h-[380px] shrink-0"
            )}
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
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                disabled={!problem}
                className={cn(button.icon, "h-9 w-9")}
                style={{ minHeight: 0 }}
                aria-label="Reset code to the starter"
                title="Reset code"
              >
                <RotateCcw size={14} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setEditorFullscreen((value) => !value)}
                className={cn(button.icon, "h-9 w-9")}
                style={{ minHeight: 0 }}
                aria-label={editorFullscreen ? "Exit fullscreen editor" : "Fullscreen editor"}
                title={editorFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
              >
                {editorFullscreen ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
              </button>
              <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
                {actionButton("run", "Run", true)}
                {actionButton("test", "Test")}
                {actionButton("submit", "Submit")}
              </div>
            </div>

            <div className="min-h-0 flex-1">
              <CodeEditorPane
                value={codeReady ? code : ""}
                language={language}
                activeLine={activeLine}
                onChange={handleCodeChange}
                onLineClick={handleLineClick}
              />
            </div>
          </section>
          {editorFullscreen && (
            <div className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm" aria-hidden onClick={() => setEditorFullscreen(false)} />
          )}

          {/* Custom input */}
          {problem && (
            <div className="order-4 lg:order-none">
              <CustomInputPanel
                problem={problem}
                enabled={customEnabled}
                text={customText}
                error={customError}
                onEnabled={setCustomEnabled}
                onText={setCustomText}
              />
            </div>
          )}

          {/* Output */}
          <section aria-label="Output" aria-live="polite" className="surface-frame order-5 shrink-0 overflow-hidden lg:order-none">
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

            <div className="grid gap-3 px-5 py-4">
              {!hasOutput && (
                <p className="text-body-md text-blueprint-muted">
                  <span className="font-medium text-primary">Run</span> executes once and replays the trace.{" "}
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

              {customCheck && (
                <div className="surface-inset grid gap-1.5 py-3 font-mono text-xs sm:py-3">
                  <p className="text-technical-mono text-blueprint-muted">custom input</p>
                  <p className="break-all text-primary">{show(customCheck.input)}</p>
                  {customCheck.pending ? (
                    <p className="flex items-center gap-2 text-blueprint-muted">
                      <Loader2 size={12} aria-hidden className="animate-spin" /> Checking against the reference solution…
                    </p>
                  ) : customCheck.message ? (
                    <p className="font-sans text-[13px] text-blueprint-muted">{customCheck.message}</p>
                  ) : (
                    <>
                      <p className="break-all text-blueprint-muted">
                        expected <span className="text-primary">{show(customCheck.expected)}</span>
                      </p>
                      {customMatch !== null && (
                        <p
                          className={cn(
                            "mt-1 flex items-center gap-2 font-sans text-[13px] font-semibold",
                            customMatch ? "text-primary" : "text-red-700 dark:text-red-300"
                          )}
                        >
                          {customMatch ? (
                            <Check size={14} aria-hidden className="check-icon" />
                          ) : (
                            <X size={14} aria-hidden />
                          )}
                          {customMatch ? "Matches the reference solution" : "Differs from the reference solution"}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {execution?.ok && execution.stdout ? (
                <div>
                  <p className="text-technical-mono text-blueprint-muted">stdout</p>
                  <pre className="surface-inset mt-1.5 max-h-64 overflow-auto py-3 font-mono text-xs leading-relaxed text-primary sm:py-3">
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
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        eyebrow="Editor"
        title="Reset to the starter code?"
        actions={
          <>
            <button type="button" className={button.outlineSm} onClick={() => setConfirmReset(false)}>
              Keep my code
            </button>
            <button type="button" className={button.primary} onClick={resetCode}>
              Reset
            </button>
          </>
        }
      >
        Your saved {LANGUAGE_LABELS[language]} draft for this problem will be replaced.
      </Modal>

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
