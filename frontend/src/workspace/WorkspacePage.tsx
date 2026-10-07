import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { VariableStatement, VariantDialog, type VariantState } from "./VariableStatement";
import { ZoomControls, ZOOM_STEP, clampZoom } from "./ZoomControls";
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  CloudUpload,
  CodeXml,
  Copy,
  Expand,
  FileText,
  FlaskConical,
  History,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Shrink,
  Sparkles,
  SquareCheckBig,
  SquareTerminal,
  TextCursorInput,
  Waypoints,
  X
} from "lucide-react";
import {
  computeDiffs,
  expandTrace,
  isLanguage,
  LANGUAGE_LABELS,
  LANGUAGE_TRACING,
  outputsMatch,
  SUPPORTED_LANGUAGES,
  type ExecutionResponse,
  type Language,
  type PublicProblem,
  type SubmitResponse,
  type TraceDiff,
  type TraceStep
} from "@nodeflow/shared";
import { api, ApiError } from "../lib/api";
import { readError } from "../lib/errors";
import { loadProblems, structureLabel } from "../lib/problems";
import { useServerStatus } from "../lib/serverStatus";
import { useSession } from "../lib/session";
import { cn } from "../lib/cn";
import { verdictLabel } from "../lib/verdict";
import { creditSolve } from "../lib/coins";
import { forgetStarted, markSolvedHere, markStarted } from "../lib/started";
import { LogoMark } from "../components/Logo";
import { Modal } from "../components/Modal";
import { ThemeToggle } from "../components/ThemeToggle";
import { AccountMenu } from "../components/layout/AccountMenu";
import { CoinBalance } from "../components/NoesisCoin";
import { button } from "../components/ui";
import { TraceDiagram } from "../trace/TraceDiagram";
import CodeEditorPane from "./CodeEditorPane";
import { CustomInputPanel, parseCustomInput, pretty } from "./CustomInputPanel";
import PlaybackControls from "./PlaybackControls";
import { formatCode } from "./formatCode";
import { DEFAULT_LAYOUT, clamp, useWorkspaceLayout, type PanelId } from "./layout";
import { Splitter } from "./Splitter";
import { PanelBar, PanelSizeTools, ToolButton, ToolGroup, type PanelTab } from "./panels/PanelBar";
import { HoverSelect } from "../components/HoverSelect";
import { NotesButton } from "./panels/NotesButton";
import { ResultPanel, type ResultState } from "./panels/ResultPanel";
import { TestcasePanel } from "./panels/TestcasePanel";
import { orderedInput, show } from "./panels/values";
import {
  clearDraft,
  forgetCachedProblem,
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
import { baseNodeId, buildLineIndex, buildSceneGraph, buildSceneLayout, hasLinkedObjects } from "./scene/graph";

/** Problems whose structures are objects joined by pointers: worth a 3D view. */
const THREE_D_STRUCTURES = new Set(["linked_list", "tree", "trie"]);

// three.js is ~1MB. Splitting it out lets the editor, problem header and
// transport paint immediately instead of waiting on the renderer to download.
const Scene3D = lazy(() => import("./scene/Scene3D"));

/** Compiled languages pay for a compile per preview, so they wait longer. */
const PREVIEW_DEBOUNCE_MS: Record<Language, number> = {
  python: 450,
  javascript: 450,
  typescript: 500,
  c: 1000,
  cpp: 1200,
  java: 1200
};
const STEP_BASE_MS = 600;
// Long enough that a busy device (a heavy 3D frame, a background tab coming
// back) is not mistaken for a broken replay.
const STUCK_AFTER_MS = 15000;
/** A run this slow means the sandbox is cold, queued, or wedged. */
// A first run after a quiet spell can take most of a minute to start.
const SLOW_RUN_MS = 40000;
/** Typing, then this long with no Run/Test/Submit, earns a nudge. */
const IDLE_NUDGE_MS = 30_000;

type StuckReason = "playback" | "sandbox";
type TraceSource = "preview" | "run";
type SceneMode = "trace" | "3d";

const SCENE_MODE_KEY = "noesis:scene-mode";

/** The editor panel: the code, the visible cases, and what the last run said. */
type WorkTab = "code" | "testcase" | "result";
type ProblemTab = "description" | "custom";

/** Sizes the splitters keep to, in pixels. */
const SPLITTER_PX = 12;
const MIN_PROBLEM_PX = 96;
const MIN_WORK_PX = 220;

const ACTIONS = {
  run: { label: "Run", busy: "Running", icon: Play, keys: "Ctrl+Enter", width: "sm:min-w-[92px]" },
  test: { label: "Test", busy: "Testing", icon: FlaskConical, keys: "Ctrl+'", width: "sm:min-w-[92px]" },
  submit: { label: "Submit", busy: "Judging", icon: CloudUpload, keys: "Ctrl+Shift+Enter", width: "sm:min-w-[106px]" }
} as const;

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: "var(--difficulty-easy)",
  Medium: "var(--difficulty-medium)",
  Hard: "var(--difficulty-hard)"
};

const readSceneMode = (): SceneMode => {
  try {
    return window.localStorage.getItem(SCENE_MODE_KEY) === "3d" ? "3d" : "trace";
  } catch {
    return "trace";
  }
};

/** Tracers send heap deltas; the replay needs full heaps and per-step diffs. */
const toTraceState = (response: ExecutionResponse, source: string): TraceState => {
  const trace = expandTrace(response.trace ?? [], response.heapMode);
  return { trace, diffs: computeDiffs(trace), source };
};

/** Backend verdicts that mean "your code never terminated". */
const LOOP_ERRORS = new Set(["Execution Limit", "Time Limit Exceeded"]);

interface TraceState {
  trace: TraceStep[];
  diffs: TraceDiff[];
  /** The code that produced this trace, which mid-edit is not the editor's. */
  source: string;
}

interface PreviewJob {
  key: string;
  owner: string;
  problemId: string;
  code: string;
  language: Language;
  input?: Record<string, unknown>;
}

const EMPTY_TRACE: TraceState = { trace: [], diffs: [], source: "" };

/** Everything that determines a preview's result. */
const previewKeyOf = (language: Language, inputKey: string, code: string) => JSON.stringify([language, inputKey, code]);

export default function WorkspacePage() {
  const session = useSession();
  const server = useServerStatus();
  const navigate = useNavigate();
  const [variant, setVariant] = useState<VariantState>({ kind: "closed" });
  // One level per view: a chain wants different framing from a table.
  const [zoom2d, setZoom2d] = useState(1);
  const [zoom3d, setZoom3d] = useState(1);
  // Where this problem sits in the bank, and how the learner has fared on it,
  // for the heading: "12. Right Rotate Once", with a Solved or last-verdict badge.
  const [problemNumber, setProblemNumber] = useState<number | null>(null);
  const [standing, setStanding] = useState<{ accepted: boolean; lastVerdict?: string } | null>(null);
  const [scenePanel, setScenePanel] = useState<HTMLDivElement | null>(null);
  const sceneModeRef = useRef<"trace" | "3d">("trace");

  const { problemId: routeProblemId } = useParams<{ problemId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

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
  sceneModeRef.current = sceneMode;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // A trackpad pinch arrives as a wheel event with ctrlKey set (Safari sends
  // gesture events instead), and left alone the browser zooms the whole page,
  // which throws the reader's view across to the editor. Over the drawing a
  // pinch means "zoom the drawing", so it drives the same level the buttons do.
  useEffect(() => {
    const panel = scenePanel;
    if (!panel) return;
    const scale = (factor: number) =>
      (sceneModeRef.current === "trace" ? setZoom2d : setZoom3d)((level) => clampZoom(level * factor));
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      scale(Math.exp(-event.deltaY * 0.01));
    };
    let lastScale = 1;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      lastScale = 1;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const current = (event as Event & { scale?: number }).scale ?? 1;
      scale(current / lastScale);
      lastScale = current;
    };
    panel.addEventListener("wheel", onWheel, { passive: false });
    panel.addEventListener("gesturestart", onGestureStart);
    panel.addEventListener("gesturechange", onGestureChange);
    return () => {
      panel.removeEventListener("wheel", onWheel);
      panel.removeEventListener("gesturestart", onGestureStart);
      panel.removeEventListener("gesturechange", onGestureChange);
    };
  }, [scenePanel]);

  const [busy, setBusy] = useState<"run" | "test" | "submit" | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [draftState, setDraftState] = useState<"saved" | "saving">("saved");

  // Custom input, per problem.
  const [custom, setCustom] = useState({ owner: "", enabled: false, text: "" });
  const [serverInputError, setServerInputError] = useState("");

  // Idle nudge: counts user edits since the last Run/Test/Submit.
  const [edits, setEdits] = useState(0);
  const [idle, setIdle] = useState(false);

  // Edge-case surfaces.
  const [staleTrace, setStaleTrace] = useState(false);
  const [stuck, setStuck] = useState<StuckReason | null>(null);

  const previewAbort = useRef<AbortController | null>(null);
  const queuedPreview = useRef<PreviewJob | null>(null);
  const previewSeq = useRef(0);
  const appliedSeq = useRef(0);
  const ownerRef = useRef("");
  const lastPreviewKey = useRef("");
  const lastTraceJson = useRef("");
  /** Set once the learner drives the cursor themselves, so previews stop moving it. */
  const userScrubbed = useRef(false);
  const problemId = problem?.id ?? "";

  /**
   * One word of the statement swapped for another.
   *
   * The wait is real — the server rewrites the problem and then runs that
   * rewrite's own solution to work out every answer — so the word being
   * changed keeps a spinner rather than the page going blank.
   */
  const changeTerm = useCallback(
    async (term: string, replacement: string) => {
      if (!problemId) return;
      setVariant({ kind: "working", term, note: "Starting…" });
      try {
        const outcome = await api.variant(problemId, term, replacement, (stage) => {
          // Straight from the server, so the line always says what is actually
          // happening rather than what a timer guesses is happening.
          const note =
            stage.stage === "rewriting"
              ? "Rewriting the problem…"
              : stage.stage === "checking"
                ? "Checking it is not one you already have…"
                : `Running the solution to work out the answers (${stage.done + 1} of ${stage.of})…`;
          setVariant({ kind: "working", term, note });
        });
        if (outcome.status === "invalid") setVariant({ kind: "invalid", term, reason: outcome.reason });
        else if (outcome.status === "exists")
          setVariant({ kind: "exists", title: outcome.title, number: outcome.number, problemId: outcome.problemId });
        else
          setVariant({
            kind: "created",
            title: outcome.problem.title,
            number: outcome.number,
            problemId: outcome.problem.id
          });
      } catch (error) {
        setVariant({
          kind: "invalid",
          term,
          reason: error instanceof Error ? error.message : "That change could not be made."
        });
      }
    },
    [problemId]
  );
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
  const languageRef = useRef(language);
  languageRef.current = language;

  // Continue Solving links carry the language the work was in (?lang=cpp), so
  // resuming opens that code even when the default language has moved on.
  // Read once, then dropped from the address so a reload does not undo a
  // later switch.
  const requestedLanguage = searchParams.get("lang");
  /** A link that names a language wins over the account's latest draft. */
  const languageChosen = useRef(false);
  useEffect(() => {
    if (!isLanguage(requestedLanguage)) return;
    languageChosen.current = true;
    if (requestedLanguage !== languageRef.current) setLanguage(requestedLanguage);
    const next = new URLSearchParams(searchParams);
    next.delete("lang");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedLanguage]);
  const setLanguageRef = useRef(setLanguage);
  setLanguageRef.current = setLanguage;

  // --- problem loading ------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    if (!routeProblemId) {
      // /workspace on its own opens the first problem in the bank.
      loadProblems()
        .then((list) => mounted && list[0] && navigate(`/workspace/${list[0].id}`, { replace: true }))
        .catch(() => mounted && setNotice("We couldn't load the problems. Please reload the page."));
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
      .catch((error: unknown) => {
        if (!mounted) return;
        // A problem the server no longer has must not go on being shown from
        // the cache: everything on the page would still look right and every
        // request it made would fail.
        if (error instanceof ApiError && error.status === 404) {
          // The cached copy has to go first: left in place it would still
          // render, still look right, and fail on everything it tried to do.
          forgetCachedProblem(routeProblemId);
          forgetStarted(routeProblemId);
          setProblem(null);
          // No notice here — this page is about to unmount, so a message set
          // on it could never be read. The bank is where a missing problem
          // leaves you, and it explains itself.
          navigate("/problems", { replace: true });
          return;
        }
        if (!cached) setNotice("We couldn't load this problem. Please reload the page.");
      });

    return () => {
      mounted = false;
    };
  }, [routeProblemId, navigate]);

  useEffect(() => {
    document.title = problem ? `${problem.title} · Noesis` : "Workspace · Noesis";
  }, [problem]);

  useEffect(() => {
    let mounted = true;
    setProblemNumber(null);
    setStanding(null);
    if (!problem) return;
    loadProblems()
      .then((list) => {
        const at = list.findIndex((entry) => entry.id === problem.id);
        if (mounted) setProblemNumber(at >= 0 ? at + 1 : null);
      })
      .catch(() => undefined);
    api
      .progress(session.token)
      .then((summary) => {
        const entry = summary.problems.find((row) => row.id === problem.id);
        if (mounted && entry && entry.attempts > 0) {
          setStanding({ accepted: entry.accepted, lastVerdict: entry.lastVerdict });
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [problem?.id, session.token]);

  // --- custom input ---------------------------------------------------------

  const problemRef = useRef<PublicProblem | null>(null);
  problemRef.current = problem;

  useEffect(() => {
    const target = problemRef.current;
    if (!target) return;
    const saved = readCustomInput(target.id);
    setCustom({ owner: target.id, enabled: saved?.enabled ?? false, text: saved?.text ?? pretty(target.defaultInput) });
    setServerInputError("");
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
  const applyExecution = useCallback((response: ExecutionResponse, fromPreview: boolean, source: string) => {
    const usable = response.ok || (response.trace?.length ?? 0) > 0;
    if (usable) {
      const json = JSON.stringify(response.trace ?? []);
      // An unchanged trace (a comment or whitespace edit) keeps the scene and cursor where they are.
      const same = fromPreview && json === lastTraceJson.current;
      lastTraceJson.current = json;
      if (!same) {
        const next = toTraceState(response, source);
        const last = Math.max(0, next.trace.length - 1);
        setTraceState(next);
        // A preview shows where the code has got to; a Run replays from the top.
        // Once the learner is stepping through themselves, keeping their place
        // matters more than following the edit, so previews only clamp it.
        setIndex((current) => {
          if (!fromPreview) return 0;
          return userScrubbed.current ? Math.min(current, last) : last;
        });
        setPlaying(!fromPreview && next.trace.length > 1);
      }
      if (!fromPreview) userScrubbed.current = false;
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
    setResult(null);
    setNotice("");
    setIndex(0);
    setPlaying(false);
    setSelectedNode(null);
    setStaleTrace(false);
    setEdits(0);
    setIdle(false);
    lastPreviewKey.current = "";
    lastTraceJson.current = "";
    userScrubbed.current = false;
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
    // Painted at once, but never trusted as final: the tracer improves, and a
    // trace cached before a fix would otherwise replay the old mistake for
    // as long as the code stays the same. The fresh preview still runs and
    // replaces it.
    if (cached) applyExecution(cached, true, initial);
  }, [problemId, language, applyExecution]);

  // --- drafts on the server ---------------------------------------------------
  //
  // The browser's copy (persist.ts) is for instant reloads; the account's copy
  // is what brings a learner back to a problem after signing out, closing the
  // window or switching machine, and what Continue Solving lists.

  // Opening a problem with nothing typed here yet picks up where the account
  // left off, in the language it was written in.
  useEffect(() => {
    const target = problem;
    const token = session.token;
    if (!target || !session.user) return;
    let mounted = true;
    api
      .draft(target.id, token)
      .then(({ draft }) => {
        if (!mounted || !draft) return;
        const starterFor = (lang: Language) => target.starterCodeByLanguage?.[lang] ?? target.starterCode ?? "";
        if (draft.code.trim() === starterFor(draft.language).trim()) return;
        const local = readDraft(target.id, draft.language);
        if (local !== null && local.trim() !== starterFor(draft.language).trim()) return;
        writeDraft(target.id, draft.language, draft.code);
        if (draft.language !== languageRef.current) {
          if (languageChosen.current) return;
          const current = readDraft(target.id, languageRef.current);
          const untouched = current === null || current.trim() === starterFor(languageRef.current).trim();
          if (untouched) setLanguageRef.current(draft.language);
          return;
        }
        setEditor((editorState) =>
          editorState.owner === `${target.id}:${draft.language}` &&
          editorState.code.trim() === starterFor(draft.language).trim()
            ? { ...editorState, code: draft.code }
            : editorState
        );
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
    // Once per problem and account; language changes are handled above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem?.id, session.user?.id]);

  // Opening a problem is starting it: it joins Continue Solving now, typed in
  // or not. This device remembers it for a guest (and for the account, until
  // the next sync); an account also records it on the server straight away.
  useEffect(() => {
    if (!problem) return;
    markStarted(problem, languageRef.current);
    if (session.token) api.touchDraft(problem.id, languageRef.current, session.token).catch(() => undefined);
    // Once per problem and account; typing keeps the record fresh below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem?.id, session.token]);

  // Typing saves to the account after a pause, and once more when the tab is
  // hidden or the page is left, so the last few keystrokes are never lost.
  const pendingDraft = useRef<{ problemId: string; language: Language; code: string; starter: string } | null>(null);
  const flushDraft = useCallback(() => {
    const pending = pendingDraft.current;
    pendingDraft.current = null;
    if (!pending || !session.token) return;
    // Starter code is saved too: going back to it is still working on the
    // problem, and deleting the draft here would take it off the list.
    api
      .saveDraft(pending.problemId, pending.language, pending.code, session.token)
      .catch(() => undefined)
      .finally(() => setDraftState("saved"));
  }, [session.token]);

  useEffect(() => {
    if (!problem || edits === 0) return;
    const timer = window.setTimeout(() => markStarted(problem, language), 1200);
    return () => window.clearTimeout(timer);
  }, [code, edits, problem, language]);

  useEffect(() => {
    if (!problem || !session.user || edits === 0) return;
    pendingDraft.current = {
      problemId: problem.id,
      language,
      code,
      starter: problem.starterCodeByLanguage?.[language] ?? problem.starterCode ?? ""
    };
    setDraftState("saving");
    const timer = window.setTimeout(flushDraft, 1200);
    return () => window.clearTimeout(timer);
  }, [code, edits, problem, language, session.user, flushDraft]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushDraft);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushDraft);
      flushDraft();
    };
  }, [flushDraft]);

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
  // 3D earns its place only where objects point at each other: lists, trees,
  // tries, or any run that builds linked nodes. Arrays, strings, numbers,
  // matrices and maps are flat, and the 2D diagram already shows them best.
  const can3D = useMemo(
    () => THREE_D_STRUCTURES.has(problem?.structureType ?? "") || hasLinkedObjects(traceState.trace),
    [problem?.structureType, traceState.trace]
  );
  const shownMode: SceneMode = can3D ? sceneMode : "trace";

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
        applyExecution(response.execution, true, job.code);
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
    if (!playing || stepCount < 2) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") setStuck("playback");
    }, STUCK_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [playing, index, stepCount]);

  // Cause two: a run that never comes back.
  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => setStuck("sandbox"), SLOW_RUN_MS);
    return () => window.clearTimeout(timer);
  }, [busy]);

  const currentStep = trace[Math.min(index, Math.max(0, stepCount - 1))];
  // Positions are fixed for the whole trace, so a step only ever moves arrows.
  const sceneLayout = useMemo(() => buildSceneLayout(trace), [trace]);
  const graph = useMemo(() => buildSceneGraph(currentStep, sceneLayout), [currentStep, sceneLayout]);
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

  /** Any deliberate move of the cursor, from the transport or from a jump. */
  const jumpTo = useCallback((step: number) => {
    userScrubbed.current = true;
    setIndex(step);
  }, []);

  /** Scene -> editor: jump playback to where this node was last touched. */
  const handleSelectNode = useCallback(
    (id: string | null) => {
      setSelectedNode(id);
      if (!id) return;

      const steps = lineIndex.nodeToSteps.get(baseNodeId(id));
      if (!steps?.length) return;

      setPlaying(false);
      const previous = [...steps].reverse().find((step) => step <= index);
      jumpTo(previous ?? steps[0]);
    },
    [lineIndex, index, jumpTo]
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
        jumpTo(touch.step);
        return;
      }

      const steps = lineIndex.lineToSteps.get(line);
      if (!steps?.length) return;

      setPlaying(false);
      setSelectedNode(null);
      jumpTo(pick(steps, (step) => step));
    },
    [lineIndex, index, jumpTo]
  );

  const settleAction = () => {
    setEdits(0);
    setIdle(false);
  };

  const runCode = useCallback(async () => {
    if (!problem) return;
    if (customEnabled && !customInput) {
      setNotice(`Fix the custom input first: ${customError || "it is not valid JSON."}`);
      showResults("run");
      return;
    }
    settleAction();
    setBusy("run");
    setNotice("");
    showResults("run");

    // When the input is one of the problem's own cases, its answer is already
    // known; a custom one is put to the reference solution alongside the run.
    const input = customInput ?? problem.defaultInput;
    const inputJson = JSON.stringify(input);
    const exampleAt = problem.examples.findIndex((example) => JSON.stringify(example.input) === inputJson);
    const knownCase = problem.visibleTestCases.find((entry) => JSON.stringify(entry.input) === inputJson);
    const known =
      exampleAt >= 0
        ? { value: problem.examples[exampleAt].output }
        : knownCase
          ? { value: knownCase.expectedOutput }
          : null;
    const source = exampleAt >= 0 ? `Example ${exampleAt + 1}` : customInput ? "Your input" : "The default input";
    const expectedRequest = !known && customInput ? api.expected(problem.id, customInput).catch(() => null) : null;
    const compare = problem.signature.compare ?? "exact";

    try {
      const response = await api.run(problem.id, code, input, language);
      applyExecution(response, false, code);
      const at = Date.now();
      const matchOf = (expected: unknown) => (response.ok ? outputsMatch(response.result, expected, compare) : null);
      setResult({
        kind: "run",
        at,
        input,
        source,
        execution: response,
        expected: known ?? (expectedRequest ? { pending: true } : undefined),
        match: known ? matchOf(known.value) : null
      });
      setBusy(null);
      if (expectedRequest) {
        const expected = await expectedRequest;
        setResult((current) =>
          current?.kind === "run" && current.at === at
            ? {
                ...current,
                expected: expected?.ok
                  ? { value: expected.expectedOutput }
                  : { note: expected?.message ?? "We couldn't work out the expected answer for this input." },
                match: expected?.ok ? matchOf(expected.expectedOutput) : null
              }
            : current
        );
      }
    } catch (error) {
      const message = readError(error, "Run failed.");
      if (message.startsWith("Custom input:")) setServerInputError(message.replace(/^Custom input:\s*/, ""));
      setNotice(message);
    } finally {
      setBusy(null);
    }
    // showResults only calls setters and reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem, code, language, applyExecution, customEnabled, customInput, customError]);

  const runJudge = useCallback(
    async (mode: "test" | "submit") => {
      if (!problem) return;
      settleAction();
      setBusy(mode);
      setNotice("");
      showResults(mode);

      try {
        const response =
          mode === "test"
            ? await api.test(problem.id, code, language)
            : await api.submitWithSession(problem.id, code, session.token, language);
        setResult({
          kind: mode,
          at: Date.now(),
          judgement: response,
          coins: mode === "submit" ? (response as SubmitResponse).coinsAwarded : undefined
        });
        if (mode === "submit" && response.verdict === "Accepted") {
          // Paid once per problem: the server decides for an account, this
          // browser's record for a guest.
          creditSolve(problem, (response as SubmitResponse).coinsAwarded);
          markSolvedHere(problem.id);
        }
        // A failure on our side says nothing about the learner's code, so it
        // never becomes the problem's status badge.
        if (mode === "submit" && response.verdict !== "Platform Error") {
          setStanding((previous) => ({
            accepted: Boolean(previous?.accepted) || response.verdict === "Accepted",
            lastVerdict: response.verdict
          }));
        }
      } catch (error) {
        setNotice(readError(error, `${mode === "test" ? "Test" : "Submit"} failed.`));
      } finally {
        setBusy(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [problem, code, language, session.token]
  );

  const resetCode = () => {
    if (!problem) return;
    clearDraft(problem.id, language);
    // The account keeps the starter, so the next visit does not bring the old
    // code back, and the problem stays on Continue Solving.
    if (session.token) {
      const starter = problem.starterCodeByLanguage?.[language] ?? problem.starterCode ?? "";
      api.saveDraft(problem.id, language, starter, session.token).catch(() => undefined);
    }
    setEditor({ owner: editorOwner, code: problem.starterCodeByLanguage?.[language] ?? problem.starterCode ?? "" });
    setConfirmReset(false);
    settleAction();
  };

  // --- layout ----------------------------------------------------------------

  const [layout, setLayout] = useWorkspaceLayout();
  const [maximized, setMaximized] = useState<PanelId | null>(null);
  const [traceCollapsed, setTraceCollapsed] = useState(false);
  const [problemCollapsed, setProblemCollapsed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const workRef = useRef<HTMLElement>(null);

  const toggleMaximized = (panel: PanelId) => setMaximized((current) => (current === panel ? null : panel));

  const moveSplit = (clientX: number) => {
    const box = bodyRef.current?.getBoundingClientRect();
    if (!box) return;
    setTraceCollapsed(false);
    setLayout({ split: clamp((clientX - box.left) / box.width, 0.22, 0.78) });
  };

  const moveProblem = (clientY: number) => {
    const box = columnRef.current?.getBoundingClientRect();
    if (!box) return;
    const most = box.height - MIN_WORK_PX - SPLITTER_PX;
    const px = clamp(clientY - box.top - SPLITTER_PX / 2, MIN_PROBLEM_PX, Math.max(MIN_PROBLEM_PX, most));
    setProblemCollapsed(false);
    setLayout({ problem: px / box.height });
  };

  // --- tabs ------------------------------------------------------------------------

  const [workTab, setWorkTab] = useState<WorkTab>("code");
  const workTabRef = useRef(workTab);
  workTabRef.current = workTab;
  const [problemTab, setProblemTab] = useState<ProblemTab>("description");
  /** A result came back while the learner was looking at something else. */
  const [resultUnseen, setResultUnseen] = useState(false);

  useEffect(() => {
    if (workTab === "result") setResultUnseen(false);
  }, [workTab]);

  useEffect(() => {
    if ((result || notice) && workTabRef.current !== "result") setResultUnseen(true);
  }, [result, notice]);

  // A new problem starts on its code and its statement.
  useEffect(() => {
    setWorkTab("code");
    setProblemTab("description");
    setResultUnseen(false);
  }, [problemId]);

  const openProblemTab = (tab: ProblemTab) => {
    setProblemTab(tab);
    setProblemCollapsed(false);
    setMaximized((current) => (current && current !== "problem" ? null : current));
  };

  /**
   * Test and Submit answer in Test Result, brought into view. Run answers on
   * the left, in the replay, so it leaves the editor where it is; its verdict
   * waits in Test Result and in the editor's status bar.
   */
  const showResults = (mode: "run" | "test" | "submit") => {
    setMaximized((current) => (current === "trace" && mode === "run" ? current : current === "work" ? current : null));
    if (mode === "run") {
      setWorkTab((tab) => (tab === "testcase" ? "result" : tab));
      return;
    }
    setWorkTab("result");
    // On a phone the editor panel sits below the trace: bring it up.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.requestAnimationFrame(() => workRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  // --- editor tools ------------------------------------------------------------

  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [codeNote, setCodeNote] = useState<{ text: string; tone: "plain" | "warn" } | null>(null);
  const [toolBusy, setToolBusy] = useState<"format" | "last" | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<{ code: string; verdict: string; submittedAt: string } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const canFullscreen = typeof document !== "undefined" && Boolean(document.fullscreenEnabled);

  useEffect(() => {
    if (!codeNote) return;
    const timer = window.setTimeout(() => setCodeNote(null), 4200);
    return () => window.clearTimeout(timer);
  }, [codeNote]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen().catch(() => setCodeNote({ text: "Full screen isn't available here.", tone: "warn" }));
  };

  const formatNow = async () => {
    if (!codeReady || toolBusy) return;
    setToolBusy("format");
    try {
      const formatted = await formatCode(code, language);
      if (formatted !== code) {
        handleCodeChange(formatted);
        setCodeNote({ text: "Formatted", tone: "plain" });
      } else {
        setCodeNote({ text: "Already formatted", tone: "plain" });
      }
    } catch {
      setCodeNote({ text: "Couldn't format this. Fix the syntax error first, then try again.", tone: "warn" });
    } finally {
      setToolBusy(null);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCodeNote({ text: "Couldn't copy. Select the code and press Ctrl+C.", tone: "warn" });
    }
  };

  const fetchLastSubmission = async () => {
    if (!problem || !session.token || toolBusy) return;
    setToolBusy("last");
    try {
      setLastSubmission(await api.latestSubmission(problem.id, language, session.token));
    } catch (error) {
      setCodeNote({
        text:
          error instanceof ApiError && error.status === 404
            ? `You haven't submitted this problem in ${LANGUAGE_LABELS[language]} yet.`
            : readError(error, "Couldn't load your last submission."),
        tone: "warn"
      });
    } finally {
      setToolBusy(null);
    }
  };

  const restoreLastSubmission = () => {
    if (!lastSubmission) return;
    handleCodeChange(lastSubmission.code);
    setLastSubmission(null);
    setCodeNote({ text: "Your last submission is back in the editor", tone: "plain" });
  };

  // Keyboard: Ctrl+Enter runs, Ctrl+' tests, Ctrl+Shift+Enter submits,
  // Shift+Alt+F formats, Esc leaves a maximised panel. Caught before the
  // editor sees them, so Ctrl+Enter does not also add a line.
  const keys = useRef({ runCode, runJudge, formatNow, maximized, busy });
  keys.current = { runCode, runJudge, formatNow, maximized, busy };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const { runCode: run, runJudge: judge, formatNow: format, maximized: big, busy: working } = keys.current;
      const take = () => {
        event.preventDefault();
        event.stopPropagation();
      };
      if (mod && event.key === "Enter") {
        take();
        if (!working) void (event.shiftKey ? judge("submit") : run());
      } else if (mod && (event.key === "'" || event.code === "Quote")) {
        take();
        if (!working) void judge("test");
      } else if (event.shiftKey && event.altKey && event.code === "KeyF") {
        take();
        void format();
      } else if (event.key === "Escape" && big && !document.querySelector("[role=dialog]")) {
        setMaximized(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const loadingScene = !hasTrace && server.sandbox && (previewBusy || busy === "run" || !problem);
  const zoomFor = shownMode === "trace" ? zoom2d : zoom3d;
  const setZoomFor = shownMode === "trace" ? setZoom2d : setZoom3d;

  const actionButton = (mode: "run" | "test" | "submit") => {
    const meta = ACTIONS[mode];
    const Icon = meta.icon;
    const working = busy === mode;
    return (
      <button
        type="button"
        onClick={() => (mode === "run" ? void runCode() : void runJudge(mode))}
        disabled={busy !== null || !problem}
        aria-busy={working}
        title={`${meta.label} (${meta.keys})`}
        className={cn(mode === "submit" ? button.primary : button.outlineSm, "workspace-action shadow-none", meta.width)}
        style={{ minHeight: 0 }}
      >
        {working ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Icon size={14} aria-hidden />}
        <span>{working ? meta.busy : meta.label}</span>
      </button>
    );
  };

  const hidden = (panel: PanelId) => maximized !== null && maximized !== panel;
  const dot = (tone: string) => <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} aria-hidden />;
  const resultTone =
    !result
      ? "var(--fill-blue)"
      : result.kind === "run"
        ? result.execution.ok
          ? result.match === false
            ? "var(--verdict-fail)"
            : "var(--verdict-pass)"
          : "var(--verdict-fail)"
        : result.judgement.verdict === "Accepted"
          ? "var(--verdict-pass)"
          : "var(--verdict-fail)";
  const workTabs: PanelTab<WorkTab>[] = [
    { id: "code", label: "Code", icon: CodeXml },
    { id: "testcase", label: "Testcase", icon: SquareCheckBig },
    {
      id: "result",
      label: "Test Result",
      shortLabel: "Result",
      icon: SquareTerminal,
      badge:
        busy && workTab !== "result" ? (
          <Loader2 size={11} className="animate-spin text-blueprint-muted" aria-label="running" />
        ) : resultUnseen ? (
          dot(notice ? "var(--verdict-slow)" : resultTone)
        ) : undefined
    }
  ];
  const problemTabs: PanelTab<ProblemTab>[] = [
    { id: "description", label: "Description", icon: FileText },
    { id: "custom", label: "Custom Input", shortLabel: "Input", icon: TextCursorInput, badge: customEnabled ? dot("var(--fill-blue)") : undefined }
  ];

  /** The last run's verdict, one line, for the editor's status bar. */
  const resultSummary: { text: string; color: string } | null = busy
    ? { text: busy === "run" ? "Running…" : busy === "test" ? "Testing…" : "Judging…", color: "var(--muted-foreground)" }
    : notice
      ? { text: "Couldn't complete the last run", color: "var(--verdict-slow)" }
      : !result
        ? null
        : result.kind === "run"
          ? result.execution.ok
            ? {
                text:
                  result.match === null
                    ? `Ran in ${Math.round(result.execution.runtimeMs)} ms`
                    : result.match
                      ? "Correct"
                      : "Wrong Answer",
                color: result.match === false ? "var(--verdict-fail)" : result.match ? "var(--verdict-pass)" : "var(--muted-foreground)"
              }
            : { text: verdictLabel(result.execution.errorType), color: "var(--verdict-fail)" }
          : {
              text: `${verdictLabel(result.judgement.verdict)} · ${result.judgement.cases.filter((entry) => entry.status === "passed").length}/${
                result.judgement.totalCases ?? result.judgement.cases.length
              }`,
              color: result.judgement.verdict === "Accepted" ? "var(--verdict-pass)" : "var(--verdict-fail)"
            };
  const traceTabs: PanelTab<SceneMode>[] = can3D
    ? [
        { id: "trace", label: "2D trace", icon: Waypoints },
        { id: "3d", label: "3D view", icon: Box }
      ]
    : [{ id: "trace", label: "Trace", icon: Waypoints }];

  const layoutVars = {
    "--split": `${layout.split * 100}%`,
    "--problem-h": `${layout.problem * 100}%`
  } as CSSProperties;

  return (
    <div className="flex min-h-screen flex-col bg-background lg:h-screen lg:overflow-hidden">
      <header className="app-header sticky top-0 z-40 shrink-0">
        <div className="relative flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 sm:h-14 sm:flex-nowrap sm:gap-3 sm:px-5 sm:py-0">
          <HomeAndBack />
          {/* Centred on the page: the three things a learner reaches for,
              always in the same place. */}
          <div className="order-last grid w-full grid-cols-[1fr_1fr_1fr_auto] gap-2 sm:order-none sm:mx-auto sm:flex sm:w-auto sm:items-center lg:absolute lg:left-1/2 lg:-translate-x-1/2">
            {actionButton("run")}
            {actionButton("test")}
            {actionButton("submit")}
            <NotesButton problemId={problemId} token={session.token} signedIn={Boolean(session.user)} />
          </div>
          <div className="ml-auto flex items-center gap-4 sm:ml-0 sm:gap-6 lg:ml-auto">
            <CoinBalance className="hidden sm:inline-flex" />
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
      </header>

      {!server.sandbox && (
        <p className="status-warning mx-3 mt-3 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm sm:mx-4" role="status">
          <AlertTriangle size={15} aria-hidden className="shrink-0" />
          Running code is switched off on this copy of Noesis, so traces, Run, Test and Submit are unavailable.
        </p>
      )}

      <div
        ref={bodyRef}
        style={layoutVars}
        className="flex flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-4 lg:min-h-0 lg:flex-row lg:gap-0 lg:p-3"
      >
        {/* Trace: the left of the page on desktop. */}
        {traceCollapsed && !maximized && (
          <button
            type="button"
            onClick={() => setTraceCollapsed(false)}
            className="surface-frame no-lift hidden w-10 shrink-0 flex-col items-center gap-3 py-3 text-[13px] font-medium text-blueprint-muted hover:text-primary lg:flex"
            style={{ minHeight: 0 }}
            aria-label="Show the trace"
          >
            <ChevronRight size={15} aria-hidden />
            <Waypoints size={14} aria-hidden className="text-[var(--fill-blue)]" />
            <span style={{ writingMode: "vertical-rl" }}>Trace</span>
          </button>
        )}
        <section
          aria-label="Data structure visualization"
          className={cn(
            "surface-frame order-2 flex h-[min(72svh,600px)] min-h-[440px] flex-col overflow-hidden lg:order-none lg:h-auto lg:min-h-0 lg:min-w-0",
            maximized === "trace" ? "lg:flex-1" : "lg:shrink-0 lg:basis-[var(--split)]",
            (hidden("trace") || traceCollapsed) && "lg:hidden"
          )}
        >
          <PanelBar
            name="Visualization style"
            tabs={traceTabs}
            active={shownMode}
            onTab={(mode) => setSceneMode(mode)}
          >
            {previewBusy && hasTrace && (
              <Loader2 size={14} aria-label="Updating trace" className="mr-1 animate-spin text-blueprint-muted" />
            )}
            {(shownMode === "trace" ? hasTrace : true) && (
              <ZoomControls
                className="lg:hidden"
                compact
                zoom={zoomFor}
                onZoom={(direction) => setZoomFor((level) => clampZoom(level + direction * ZOOM_STEP))}
                onReset={() => setZoomFor(1)}
              />
            )}
            <PanelSizeTools
              maximized={maximized === "trace"}
              onMaximize={() => toggleMaximized("trace")}
              onCollapse={() => setTraceCollapsed(true)}
              collapseAxis="x"
            />
          </PanelBar>

          {hasTrace && (staleTrace || traceInfo.truncated || traceInfo.note) && (
            <p className="shrink-0 border-b border-blueprint-line bg-surface-inset px-4 py-2 text-center text-xs text-blueprint-muted sm:px-5">
              {staleTrace
                ? "Code is mid-edit, so this is the last trace that ran."
                : traceInfo.note ?? `Replay shows the first ${stepCount} steps; the rest ran without recording.`}
            </p>
          )}

          <div ref={setScenePanel} className="neu-screen relative min-h-0 flex-1">
            {shownMode === "trace" ? (
              hasTrace ? (
                <TraceDiagram
                  trace={trace}
                  diffs={diffs}
                  index={Math.min(index, stepCount - 1)}
                  signature={problem?.signature}
                  source={traceState.source}
                  zoom={zoom2d}
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
                  zoom={zoom3d}
                />
              </Suspense>
            )}

            {(shownMode === "trace" ? hasTrace : true) && (
              <ZoomControls
                className="absolute bottom-3 right-3 z-20 hidden lg:flex"
                zoom={zoomFor}
                onZoom={(direction) => setZoomFor((level) => clampZoom(level + direction * ZOOM_STEP))}
                onReset={() => setZoomFor(1)}
              />
            )}

            {loadingScene && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-blueprint-muted dark:text-[#ffd60a]">
                <Loader2 size={24} aria-label="Loading trace" className="animate-spin" />
                {busy === "run" && <span className="font-mono text-xs font-semibold tracking-wide">Running…</span>}
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
                className={cn(button.outlineSm, "workspace-action h-8 px-3")}
                style={{ minHeight: 0 }}
              >
                Run
              </button>
              <button
                type="button"
                onClick={() => void runJudge("test")}
                disabled={busy !== null}
                className={cn(button.outlineSm, "workspace-action hidden h-8 px-3 sm:inline-flex")}
                style={{ minHeight: 0 }}
              >
                Test
              </button>
              <ToolGroup>
                <ToolButton label="Dismiss" onClick={() => setIdle(false)}>
                  <X size={14} aria-hidden />
                </ToolButton>
              </ToolGroup>
            </div>
          )}

          <PlaybackControls
            locked={busy === "run"}
            index={index}
            count={stepCount}
            playing={playing}
            speed={speed}
            line={activeLine}
            onIndex={jumpTo}
            onPlaying={setPlaying}
            onSpeed={setSpeed}
          />
        </section>

        {!traceCollapsed && !maximized && (
          <Splitter
            direction="x"
            label="Resize the trace and the editor"
            value={layout.split * 100}
            onMove={(x) => moveSplit(x)}
            onStep={(step) => setLayout({ split: clamp(layout.split + step * 0.02, 0.22, 0.78) })}
            onReset={() => setLayout({ split: DEFAULT_LAYOUT.split })}
            className="hidden lg:block"
          />
        )}

        {/* Right column: the problem, then the editor panel. On phones its panels join
            the page so the statement can sit above the trace. */}
        <div
          ref={columnRef}
          className={cn(
            "contents lg:flex lg:min-h-0 lg:min-w-0 lg:flex-1 lg:flex-col",
            hidden("problem") && hidden("work") && "lg:hidden"
          )}
        >
          {/* Problem */}
          <section
            aria-label="Problem"
            className={cn(
              "surface-frame order-1 flex flex-col overflow-hidden lg:order-none",
              maximized === "problem"
                ? "lg:min-h-0 lg:flex-1"
                : problemCollapsed
                  ? "lg:shrink-0"
                  : "lg:min-h-0 lg:shrink-0 lg:basis-[var(--problem-h)]",
              hidden("problem") && "lg:hidden"
            )}
          >
            <PanelBar name="Problem" tabs={problemTabs} active={problemTab} onTab={openProblemTab}>
              <PanelSizeTools
                maximized={maximized === "problem"}
                onMaximize={() => toggleMaximized("problem")}
                collapsed={problemCollapsed}
                onCollapse={() => setProblemCollapsed((value) => !value)}
              />
            </PanelBar>
            <div
              id="problem-statement"
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-4",
                problemCollapsed && "lg:hidden"
              )}
            >
              {problemTab === "custom" && problem ? (
                <CustomInputPanel
                  problem={problem}
                  enabled={customEnabled}
                  text={customText}
                  error={customError}
                  onEnabled={setCustomEnabled}
                  onText={setCustomText}
                />
              ) : problem ? (
                <>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium">
                    <span className="text-[var(--fill-blue)]">{problem.topic}</span>
                    <span aria-hidden className="text-blueprint-muted/60">·</span>
                    <span style={{ color: DIFFICULTY_COLOR[problem.difficulty] }}>{problem.difficulty}</span>
                    {structureLabel(problem.structureType).toLowerCase() !== problem.topic.toLowerCase() && (
                      <>
                        <span aria-hidden className="text-blueprint-muted/60">·</span>
                        <span className="text-blueprint-muted">{structureLabel(problem.structureType)}</span>
                      </>
                    )}
                    {standing && (standing.accepted || standing.lastVerdict) && (
                      <span
                        className="ml-auto flex items-center gap-1"
                        style={{
                          color: standing.accepted
                            ? "var(--verdict-pass)"
                            : standing.lastVerdict === "Time Limit Exceeded" ||
                                standing.lastVerdict === "Execution Limit"
                              ? "var(--verdict-slow)"
                              : "var(--verdict-fail)"
                        }}
                      >
                        {standing.accepted && <Check size={14} aria-hidden strokeWidth={2.5} />}
                        {standing.accepted ? "Solved" : verdictLabel(standing.lastVerdict)}
                      </span>
                    )}
                  </p>
                  <h1 className="mt-1.5 text-headline-sm text-primary">
                    {problemNumber !== null && <span className="mr-2 font-mono text-blueprint-muted">{problemNumber}.</span>}
                    {problem.title}
                  </h1>
                  <VariableStatement
                    text={problem.description}
                    busy={variant.kind === "working"}
                    onPick={(term) => setVariant({ kind: "editing", term })}
                    className="mt-3 text-body-md text-primary"
                  />

                  {problem.examples.slice(0, 3).map((example, exampleIndex) => (
                    <div key={exampleIndex} className="mt-5">
                      <p className="text-[13.5px] font-semibold text-primary">Example {exampleIndex + 1}</p>
                      <div className="mt-2 grid gap-1 rounded-lg bg-surface-inset px-3.5 py-3 font-mono text-[13px] leading-relaxed">
                        <p className="break-words">
                          <span className="font-sans font-medium text-blueprint-muted">Input: </span>
                          <span className="text-primary">
                            {orderedInput(example.input, problem.signature)
                              .map(([name, value]) => `${name} = ${show(value)}`)
                              .join(", ")}
                          </span>
                        </p>
                        <p className="break-words">
                          <span className="font-sans font-medium text-blueprint-muted">Output: </span>
                          <span className="text-primary">{show(example.output)}</span>
                        </p>
                        {example.explanation && (
                          <p className="font-sans text-[13px] text-blueprint-muted">
                            <span className="font-medium">Explanation: </span>
                            {example.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {problem.constraints.length > 0 && (
                    <div className="mt-5">
                      <p className="text-[13.5px] font-semibold text-primary">Constraints</p>
                      <ul className="mt-2 grid gap-1.5">
                        {problem.constraints.map((constraint) => (
                          <li key={constraint} className="flex gap-2 text-[13.5px] text-blueprint-muted">
                            <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-blueprint-muted" aria-hidden />
                            {constraint}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : notice ? (
                <p className="text-body-md text-blueprint-muted">{notice}</p>
              ) : (
                <div className="grid gap-3" aria-hidden>
                  <span className="skeleton h-3.5 w-40" />
                  <span className="skeleton h-6 w-64" />
                  <span className="skeleton h-3 w-5/6" />
                  <span className="skeleton h-3 w-2/3" />
                </div>
              )}
            </div>
          </section>

          {!maximized && (
            <Splitter
              direction="y"
              label="Resize the problem and the editor"
              value={layout.problem * 100}
              onMove={(_x, y) => moveProblem(y)}
              onStep={(step) => setLayout({ problem: clamp(layout.problem + step * 0.03, 0.1, 0.7) })}
              onReset={() => {
                setProblemCollapsed(false);
                setLayout({ problem: DEFAULT_LAYOUT.problem });
              }}
              className="hidden lg:block"
            />
          )}

          {/* Code, test cases and results: one large panel, the code first. */}
          <section
            ref={workRef}
            aria-label="Code editor"
            className={cn(
              "surface-frame relative order-3 flex scroll-mt-3 flex-col overflow-hidden lg:order-none lg:min-h-[220px] lg:flex-1",
              hidden("work") && "lg:hidden"
            )}
          >
            {busy && <span className="console-progress" aria-hidden />}
            <PanelBar name="Editor" tabs={workTabs} active={workTab} onTab={setWorkTab}>
              {workTab === "code" && (
                <>
                  <HoverSelect
                    label="Language"
                    value={language}
                    options={SUPPORTED_LANGUAGES.map((option) => ({ value: option, label: LANGUAGE_LABELS[option] }))}
                    onChange={(next) => {
                      languageChosen.current = true;
                      setLanguage(next);
                    }}
                    align="right"
                    triggerClassName="h-7 rounded-md px-2 text-[13px] font-medium text-primary transition-colors hover:bg-surface-hover"
                  />
                  <span className="mx-0.5 hidden h-4 w-px bg-blueprint-line sm:block" aria-hidden />
                  <ToolGroup className="hidden sm:flex">
                    <ToolButton label="Format (Shift+Alt+F)" onClick={() => void formatNow()} disabled={!codeReady || toolBusy !== null}>
                      {toolBusy === "format" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Braces size={14} aria-hidden />}
                    </ToolButton>
                    <ToolButton label={copied ? "Copied" : "Copy code"} onClick={() => void copyCode()} disabled={!codeReady}>
                      {copied ? <Check size={14} aria-hidden className="text-[var(--verdict-pass)]" /> : <Copy size={14} aria-hidden />}
                    </ToolButton>
                    <ToolButton
                      label={session.user ? "Last submitted code" : "Sign in to load your last submission"}
                      onClick={() => void fetchLastSubmission()}
                      disabled={!problem || !session.user || toolBusy !== null}
                    >
                      {toolBusy === "last" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <History size={14} aria-hidden />}
                    </ToolButton>
                    <ToolButton label="Reset to the starter code" onClick={() => setConfirmReset(true)} disabled={!problem}>
                      <RotateCcw size={14} aria-hidden />
                    </ToolButton>
                    {canFullscreen && (
                      <ToolButton label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen} pressed={fullscreen}>
                        {fullscreen ? <Shrink size={14} aria-hidden /> : <Expand size={14} aria-hidden />}
                      </ToolButton>
                    )}
                  </ToolGroup>
                </>
              )}
              <PanelSizeTools maximized={maximized === "work"} onMaximize={() => toggleMaximized("work")} />
            </PanelBar>

            {/* The editor stays mounted on every tab, so its undo history and
                cursor survive a look at the results. */}
            <div className={cn("neu-screen relative min-h-0 flex-1", workTab !== "code" && "hidden")}>
              <CodeEditorPane
                value={codeReady ? code : ""}
                language={language}
                activeLine={activeLine}
                onChange={handleCodeChange}
                onLineClick={handleLineClick}
                onCursor={(line, column) => setCursor({ line, column })}
              />
            </div>

            {workTab === "code" ? (
              <div className="flex h-7 shrink-0 items-center gap-3 border-t border-blueprint-line px-3 text-[11.5px] text-blueprint-muted">
                <span className="min-w-0 truncate" aria-live="polite">
                  {codeNote ? (
                    <span className={codeNote.tone === "warn" ? "text-[var(--verdict-slow)]" : undefined}>{codeNote.text}</span>
                  ) : edits > 0 || draftState === "saving" ? (
                    draftState === "saving" ? (
                      "Saving…"
                    ) : session.user ? (
                      "Saved"
                    ) : (
                      "Saved on this device"
                    )
                  ) : null}
                </span>
                {resultSummary && (
                  <button
                    type="button"
                    onClick={() => setWorkTab("result")}
                    className="no-lift ml-auto flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-[11.5px] font-medium transition-colors hover:bg-surface-hover"
                    style={{ minHeight: 0, color: resultSummary.color }}
                    title="See the result"
                  >
                    {busy ? <Loader2 size={11} className="animate-spin" aria-hidden /> : dot(resultSummary.color)}
                    {resultSummary.text}
                    {!busy && <ChevronRight size={12} aria-hidden className="opacity-70" />}
                  </button>
                )}
                <span className={cn("shrink-0 font-mono", !resultSummary && "ml-auto")}>
                  Ln {cursor.line}, Col {cursor.column}
                </span>
              </div>
            ) : (
              <div
                role="tabpanel"
                aria-label={workTab === "testcase" ? "Testcase" : "Test Result"}
                className="min-h-[320px] flex-1 overflow-y-auto overscroll-contain px-4 py-4 lg:min-h-0"
              >
                {workTab === "testcase" &&
                  (problem ? (
                    <TestcasePanel
                      problem={problem}
                      onUseAsInput={(input) => {
                        setCustomText(pretty(input));
                        setCustomEnabled(true);
                        openProblemTab("custom");
                      }}
                    />
                  ) : (
                    <span className="skeleton h-24 w-full" aria-hidden />
                  ))}
                {workTab === "result" && (
                  <ResultPanel
                    result={result}
                    busy={busy}
                    notice={problem ? notice : ""}
                    visibleCount={problem?.visibleTestCases.length || problem?.examples.length || 0}
                    signature={problem?.signature}
                  />
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <VariantDialog
        state={variant}
        statement={problem?.description ?? ""}
        onSubmit={changeTerm}
        onClose={() => setVariant({ kind: "closed" })}
        onOpen={(id) => {
          setVariant({ kind: "closed" });
          navigate(`/workspace/${id}`);
        }}
      />

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
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
        open={lastSubmission !== null}
        onClose={() => setLastSubmission(null)}
        title="Bring back your last submission?"
        actions={
          <>
            <button type="button" className={button.outlineSm} onClick={() => setLastSubmission(null)}>
              Keep my code
            </button>
            <button type="button" className={button.primary} onClick={restoreLastSubmission}>
              Load it
            </button>
          </>
        }
      >
        {lastSubmission && (
          <>
            Your last {LANGUAGE_LABELS[language]} submission ({verdictLabel(lastSubmission.verdict)},{" "}
            {timeAgo(lastSubmission.submittedAt)}) will replace the code in the editor.
          </>
        )}
      </Modal>

      <Modal
        open={stuck !== null}
        onClose={() => setStuck(null)}
        title={stuck === "sandbox" ? "This is taking longer than usual" : "The replay stopped advancing"}
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
          ? "The first run after a quiet spell can take up to a minute to start, and a busy moment can add a short wait. You can keep waiting or try again."
          : "Playback has not moved for a few seconds. The trace may be empty, or the scene may have failed to draw."}
      </Modal>
    </div>
  );
}

/**
 * The logo, and on hover a way back to wherever the learner came from: the
 * problem list, their dashboard, another problem. It slides out from behind
 * the mark rather than sitting in the header all the time.
 */
function HomeAndBack() {
  const navigate = useNavigate();
  const back = () => {
    const position = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (position > 0) navigate(-1);
    else navigate("/problems");
  };
  return (
    <div className="logo-back flex items-center">
      <NavLink to="/dashboard" aria-label="Noesis home" className="flex h-9 items-center text-primary">
        <LogoMark className="h-7" />
      </NavLink>
      <button
        type="button"
        onClick={back}
        className="logo-back-button no-lift flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-medium text-blueprint-muted hover:bg-surface-hover hover:text-primary"
        style={{ minHeight: 0 }}
      >
        <ArrowLeft size={14} aria-hidden />
        Back
      </button>
    </div>
  );
}

const timeAgo = (iso: string) => {
  const seconds = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
