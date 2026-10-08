/**
 * The data structure a problem's replay is centred on. Drives the problem-bank
 * facets and the dashboard's coverage breakdown.
 */
export type StructureType =
  | "array"
  | "string"
  | "matrix"
  | "linked_list"
  | "stack"
  | "queue"
  | "hashmap"
  | "tree"
  | "heap"
  | "graph"
  | "trie"
  | "number";

export const STRUCTURE_TYPES: StructureType[] = [
  "array",
  "string",
  "matrix",
  "linked_list",
  "stack",
  "queue",
  "hashmap",
  "tree",
  "heap",
  "graph",
  "trie",
  "number"
];

export type Difficulty = "Easy" | "Medium" | "Hard";

/** Languages the sandbox can execute. Each maps to its own image + tracer harness. */
export type Language = "python" | "cpp" | "java" | "javascript" | "typescript" | "c";

export const SUPPORTED_LANGUAGES: Language[] = ["python", "cpp", "java", "javascript", "typescript", "c"];

export const LANGUAGE_LABELS: Record<Language, string> = {
  python: "Python",
  cpp: "C++",
  java: "Java",
  javascript: "JavaScript",
  typescript: "TypeScript",
  c: "C"
};

export const isLanguage = (value: unknown): value is Language =>
  typeof value === "string" && (SUPPORTED_LANGUAGES as string[]).includes(value);

/**
 * Whether a language can emit step-by-step traces yet. Correctness (Run/Test/
 * Submit) works for every supported language; stepping is added per language as
 * its tracer harness lands, so the UI can degrade honestly instead of silently
 * showing an empty scene.
 */
export const LANGUAGE_TRACING: Record<Language, boolean> = {
  python: true,
  cpp: true,
  java: true,
  javascript: true,
  typescript: true,
  c: true
};

/**
 * Wire types for problem inputs and outputs. Every harness (Python, C++, Java,
 * JavaScript/TypeScript, C)
 * knows how to build each input kind from JSON and serialise each output kind
 * back to JSON.
 *
 * - array / long_array / double_array / bool_array / string_array: 1D lists
 * - matrix / graph: 2D int lists (ragged allowed); graph is an adjacency list
 * - char_matrix: 2D list of one-character strings
 * - string_matrix: 2D list of strings
 * - linked_list: singly linked (ListNode val/next)
 * - doubly_linked_list: DListNode val/prev/next
 * - cyclic_list: { values, pos } — the tail links back to index pos (-1: none)
 * - y_list: the unique prefix of one of two lists sharing `sharedTail`
 * - random_list: [[val, randomIndex | null], ...] (RandomNode val/next/random)
 * - child_list: [[column values], ...] joined by next, each column by child
 * - tree: level-order values with nulls (TreeNode val/left/right)
 * - list_node_value / tree_node_value: return a node; judged by its val (-1 for none)
 */
export type ValueKind =
  | "int"
  | "long"
  | "double"
  | "bool"
  | "string"
  | "array"
  | "long_array"
  | "double_array"
  | "bool_array"
  | "string_array"
  | "matrix"
  | "graph"
  | "char_matrix"
  | "string_matrix"
  | "linked_list"
  | "doubly_linked_list"
  | "cyclic_list"
  | "y_list"
  | "random_list"
  | "child_list"
  | "tree"
  | "list_node_value"
  | "tree_node_value"
  | "void";

export type PrimitiveValue = string | number | boolean | null;

export type SerializedValue = PrimitiveValue | string;

export interface HeapObject {
  type: string;
  fields?: Record<string, SerializedValue>;
  items?: SerializedValue[];
  truncated?: number;
  preview?: string;
}

/** One user-code frame on the call stack at a trace step, outermost first. */
export interface TraceFrame {
  function: string;
  line: number;
  variables: Record<string, SerializedValue>;
}

export interface TraceStep {
  line: number;
  event: "line" | "return" | "call" | "exception";
  /** Locals of the innermost frame. */
  variables: Record<string, SerializedValue>;
  /**
   * Heap objects reachable from the call stack. In delta-encoded traces this
   * holds only objects that changed since the previous step; `expandTrace`
   * rebuilds the full heap.
   */
  heap: Record<string, HeapObject>;
  /** Delta traces only: ids that disappeared since the previous step. */
  removed?: string[];
  /** Every user frame, outermost first. Present when the call stack is deeper than one. */
  stack?: TraceFrame[];
  /**
   * What the innermost frame handed back, on a `return` step. Lets the replay
   * tell a recursive call that succeeded from one that gave up and backtracked.
   */
  returns?: SerializedValue;
}

export interface TraceDiff {
  created: string[];
  deleted: string[];
  mutated: MutatedObject[];
  variablesChanged: Record<
    string,
    {
      before?: SerializedValue;
      after?: SerializedValue;
    }
  >;
}

export interface MutatedObject {
  id: string;
  fields: string[];
  before: HeapObject;
  after: HeapObject;
}

export interface ProblemParameter {
  name: string;
  kind: ValueKind;
}

/** How a case's actual output is compared with the expected one. */
export type CompareMode =
  /** JSON-identical. */
  | "exact"
  /** Top-level list order does not matter. */
  | "unordered"
  /** Neither the outer list nor any inner list order matters. */
  | "unordered_deep"
  /** Numbers equal within 1e-5 (also inside lists). */
  | "float";

export interface DesignMethod {
  name: string;
  parameters: ProblemParameter[];
  returnKind: ValueKind;
}

/**
 * Class-design problems (LRU cache, min stack, trie...). Inputs are
 * `{ operations: string[], arguments: unknown[][] }` in LeetCode style: the first
 * operation constructs the class, the rest call methods. The output is one
 * entry per operation (null for the constructor and void methods).
 */
export interface DesignSpec {
  className: string;
  constructorParameters: ProblemParameter[];
  methods: DesignMethod[];
}

export interface ProblemSignature {
  functionName: string;
  parameters: ProblemParameter[];
  returnKind: ValueKind;
  compare?: CompareMode;
  /** Input key holding the shared tail for `y_list` parameters. */
  sharedTail?: string;
  design?: DesignSpec;
}

export interface ProblemExample {
  input: Record<string, unknown>;
  output: unknown;
  explanation?: string;
}

/** What the server is doing while a variant is made. */
export type VariantStage =
  | { stage: "rewriting" }
  | { stage: "checking" }
  | { stage: "running"; done: number; of: number };

/** What changing one word of a statement produced. */
export type VariantOutcome =
  | { status: "invalid"; reason: string }
  | { status: "exists"; problemId: string; title: string; number: number }
  | { status: "created"; problem: PublicProblem; number: number };

/**
 * Where a judged case came from: the problem's visible samples, its
 * hand-written hidden cases, the generated stress suite, or the learner's own.
 */
export type CaseGroup = "sample" | "hidden" | "stress" | "custom";

export interface ProblemTestCase {
  id: string;
  input: Record<string, unknown>;
  expectedOutput: unknown;
  visible: boolean;
  /** Absent on hand-written cases, which are "sample" when visible and "hidden" otherwise. */
  group?: CaseGroup;
}

export interface PublicProblem {
  id: string;
  title: string;
  topic: string;
  description: string;
  difficulty: Difficulty;
  structureType: StructureType;
  constraints: string[];
  examples: ProblemExample[];
  /** Python stub, authored in the problem bank. Kept for backwards compatibility. */
  starterCode: string;
  /** Stubs for every supported language, generated from `signature` at load time. */
  starterCodeByLanguage: Record<Language, string>;
  signature: ProblemSignature;
  defaultInput: Record<string, unknown>;
  visibleTestCases: ProblemTestCase[];
  /** How many cases Submit judges: samples, hidden and stress (the learner's own come on top). */
  judgeCaseCount?: number;
}

/** The fields list pages need; the full problem comes from /api/problems/:id. */
export type ProblemSummary = Pick<PublicProblem, "id" | "title" | "topic" | "difficulty" | "structureType">;

export interface Problem extends PublicProblem {
  referenceCode: string;
  testCases: ProblemTestCase[];
}

export interface ExecutionOk {
  ok: true;
  result: unknown;
  stdout: string;
  runtimeMs: number;
  queuedMs?: number;
  trace: TraceStep[];
  /** Computed client-side from the expanded trace when absent. */
  diffs?: TraceDiff[];
  stepsCaptured: number;
  /** The program kept running after the step budget; the replay stops early. */
  traceTruncated?: boolean;
  /** Steps carry heap deltas; call `expandTrace` before reading them. */
  heapMode?: "delta" | "full";
  /** Why a trace is missing or partial, when the tracer could not finish. */
  traceNote?: string;
}

export interface ExecutionError {
  ok: false;
  errorType:
    | "Compile Error"
    | "Runtime Error"
    | "Sandbox Violation"
    | "Time Limit Exceeded"
    | "Execution Limit"
    | "Platform Error";
  message: string;
  traceback?: string;
  stdout?: string;
  runtimeMs?: number;
  queuedMs?: number;
  trace?: TraceStep[];
  diffs?: TraceDiff[];
  heapMode?: "delta" | "full";
  /** 1-based line in the user's code where the error surfaced, when known. */
  line?: number;
}

export type ExecutionResponse = ExecutionOk | ExecutionError;

export interface LivePreviewResponse {
  mode: "live";
  ok: boolean;
  execution: ExecutionResponse;
  quiet: boolean;
  source: "default_input" | "custom_input";
  /** Set when the custom input was rejected before running; `execution` then carries the same message. */
  inputError?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface CaseResult {
  id: string;
  visible: boolean;
  group?: CaseGroup;
  status: "passed" | "failed" | "error";
  actualOutput?: unknown;
  expectedOutput?: unknown;
  input?: Record<string, unknown>;
  execution: ExecutionResponse;
}

export type JudgeVerdict =
  | "Accepted"
  | "Wrong Answer"
  | "Runtime Error"
  | "Sandbox Violation"
  | "Compile Error"
  | "Time Limit Exceeded"
  | "Execution Limit"
  | "Platform Error";

export interface TestResponse {
  verdict: JudgeVerdict;
  /** The cases that ran: a Submit stops at the first one that fails. */
  cases: CaseResult[];
  runtimeMs: number;
  /** How many cases were judged in all, run or not. */
  totalCases?: number;
  /** How many of those came from each group. */
  breakdown?: Partial<Record<CaseGroup, number>>;
  /** The learner's own cases that were left out, and why (1-based, as the Testcase tab numbers them). */
  skippedCases?: Array<{ index: number; reason: string }>;
}

export interface SubmitResponse extends TestResponse {
  submissionId: string;
  persisted: boolean;
  userId?: string;
  /** Coins paid for this submission: only a problem's first accepted one pays. */
  coinsAwarded?: number;
  /** Badge tiers this submission earned, each with the coins it paid. */
  badgesEarned?: BadgeAward[];
}

export type CoinSource = "game" | "solve" | "badge";

/**
 * Badges are worked out and drawn end to end, but stay off until their final
 * artwork is in: no badge is computed, paid for or shown while this is false.
 */
export const BADGES_ENABLED = false;

/** Bronze, silver, gold, platinum. A one-step badge only has tier 1. */
export const BADGE_TIERS = ["Bronze", "Silver", "Gold", "Platinum"] as const;

/** Coins a badge pays when a tier is reached, by tier (1-based). */
export const BADGE_REWARD = [0, 10, 25, 50, 100] as const;

export type BadgeFamily = "milestone" | "difficulty" | "topic" | "consistency" | "monthly" | "coins" | "performance";

/**
 * One badge and how far along it is. Badges are worked out from submissions
 * and coins, never stored, so they can always be explained.
 */
export interface Badge {
  /** Stable key: "solver", "topic-tree", "month-2026-10". */
  id: string;
  family: BadgeFamily;
  name: string;
  /** What earns it, in a line. */
  description: string;
  /** Which emblem to draw. */
  icon: string;
  /** Tiers reached so far (0 = locked). */
  tier: number;
  /** The value each tier needs, lowest first. */
  thresholds: number[];
  /** Where the learner is now, in the same unit. */
  value: number;
  unit: string;
  /** When the current tier was reached. */
  earnedAt?: string;
}

export interface BadgeAward {
  id: string;
  name: string;
  tier: number;
  /** How many tiers the badge has, so a one-step badge is not called "Bronze". */
  tiers: number;
  icon: string;
  coins: number;
}

/** Coins for a problem's first accepted submission, by difficulty. */
export const SOLVE_REWARD: Record<Difficulty, number> = { Easy: 5, Medium: 10, Hard: 15 };

/** The waiting game's rates. */
export const GAME_REWARD = { right: 2, wrong: -1 } as const;

/** Where a learner's coins came from. */
export interface CoinBreakdown {
  coins: number;
  /** The change-the-word waiting game: +2 a right pick, -1 a wrong one. */
  game: { net: number; gained: number; lost: number };
  /** First accepted submissions, paid once per problem by difficulty. */
  solve: {
    total: number;
    count: number;
    recent: Array<{ problemId: string; title: string; difficulty?: Difficulty; amount: number; at: string }>;
  };
  /** Badge tiers reached, each paid once. */
  badge?: { total: number; count: number };
  /** Coins held from before sources were recorded. */
  earlier: number;
  rewards: Record<Difficulty, number>;
}

export interface SubmissionSummary {
  submissionId: string;
  userId: string;
  problemId: string;
  problemTitle: string;
  structureType: StructureType;
  verdict: JudgeVerdict;
  runtimeMs: number;
  timestamp: string;
}

export interface ProgressProblemSummary {
  id: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  structureType: StructureType;
  attempts: number;
  accepted: boolean;
  lastVerdict?: JudgeVerdict;
  lastSubmittedAt?: string;
  bestRuntimeMs?: number;
}

export interface ProgressSummary {
  userId: string;
  userEmail?: string;
  totalProblems: number;
  totalArrays: number;
  totalLinkedLists: number;
  totalStacks: number;
  totalQueues: number;
  attempted: number;
  accepted: number;
  acceptedArrays: number;
  acceptedLinkedLists: number;
  acceptedStacks: number;
  acceptedQueues: number;
  /** Per structure type: accepted and live counts. */
  byStructure?: Partial<Record<StructureType, { accepted: number; total: number }>>;
  /** Solved and live counts by difficulty. */
  byDifficulty?: Record<Difficulty, { solved: number; total: number }>;
  /** Every submission ever judged (platform failures aside), and how many were accepted. */
  submissionCount?: number;
  acceptedCount?: number;
  /**
   * Submissions per day, keyed "YYYY-MM-DD" in the time zone the request
   * named, over the learner's whole history.
   */
  calendar?: Record<string, number>;
  badges?: Badge[];
  recentSubmissions: SubmissionSummary[];
  problems: ProgressProblemSummary[];
}

/** What the reference solution returns for a learner's custom input. */
export interface ExpectedOutputResponse {
  ok: boolean;
  /** Present when ok: the reference solution's return value. */
  expectedOutput?: unknown;
  message?: string;
}

export interface ClassroomSummary {
  id: string;
  name: string;
  isOwner: boolean;
  memberCount: number;
  assignmentCount: number;
  createdAt: string;
}

export interface ClassroomMember {
  id: string;
  /** The part of the email before "@"; the full email is only sent to the owner. */
  name: string;
  email?: string;
  role: "owner" | "member";
  joinedAt: string;
  solved: number;
  attempted: number;
  assignmentsSolved: number;
  lastSubmittedAt?: string;
  /** Problem ids from the assignment list this member has had accepted. */
  solvedAssignments: string[];
}

export interface ClassroomAssignment {
  problemId: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  addedAt: string;
  solvedBy: number;
}

export interface ClassroomDetail {
  id: string;
  name: string;
  isOwner: boolean;
  /** Only sent to the owner, who shares it with students. */
  joinCode?: string;
  createdAt: string;
  members: ClassroomMember[];
  assignments: ClassroomAssignment[];
}

/**
 * A problem the learner started and has not yet solved: where Continue Solving
 * takes them back to.
 */
export interface UnfinishedProblem {
  problemId: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  structureType: StructureType;
  /** Language of the saved code, when there is any. */
  language?: Language;
  /** Most recent edit or submission. */
  updatedAt: string;
  attempts: number;
  lastVerdict?: JudgeVerdict;
}

export interface SavedDraft {
  problemId: string;
  language: Language;
  code: string;
  updatedAt: string;
}

export * from "./trace.js";
