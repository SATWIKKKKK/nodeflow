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
export type Language = "python" | "cpp" | "java";

export const SUPPORTED_LANGUAGES: Language[] = ["python", "cpp", "java"];

export const LANGUAGE_LABELS: Record<Language, string> = {
  python: "Python",
  cpp: "C++",
  java: "Java"
};

/**
 * Whether a language can emit step-by-step traces yet. Correctness (Run/Test/
 * Submit) works for every supported language; stepping is added per language as
 * its tracer harness lands, so the UI can degrade honestly instead of silently
 * showing an empty scene.
 */
export const LANGUAGE_TRACING: Record<Language, boolean> = {
  python: true,
  cpp: true,
  java: true
};

/**
 * Wire types for problem inputs and outputs. Every harness (Python, C++, Java)
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

export interface ProblemTestCase {
  id: string;
  input: Record<string, unknown>;
  expectedOutput: unknown;
  visible: boolean;
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
  cases: CaseResult[];
  runtimeMs: number;
}

export interface SubmitResponse extends TestResponse {
  submissionId: string;
  persisted: boolean;
  userId?: string;
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

export * from "./trace.js";
