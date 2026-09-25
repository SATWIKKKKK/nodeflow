import type {
  HeapObject,
  ProblemSignature,
  SerializedValue,
  TraceDiff,
  TraceStep
} from "@nodeflow/shared";
import { lineCells, type CellRef, type LineCells } from "./compare";

/**
 * Turns one trace step into diagram models. Nothing here is problem-specific:
 * shapes are inferred from the heap (objects with `next` are list nodes, with
 * `left`/`right` tree nodes, lists of lists are grids...), with the problem
 * signature and variable names as tie-breakers.
 */

export type Heap = Record<string, HeapObject>;

export const isRef = (value: unknown, heap: Heap): value is string =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(heap, value);

const LIST_LINKS = ["next", "prev", "child", "random"];
const TREE_LINKS = ["left", "right", "parent"];
const VALUE_FIELDS = ["val", "value", "data", "key", "item"];

export const nodeValue = (object: HeapObject | undefined): string => {
  if (!object?.fields) return "?";
  for (const field of VALUE_FIELDS) {
    const value = object.fields[field];
    if (value !== undefined && typeof value !== "object") return formatPrimitive(value);
  }
  return object.type;
};

export const isListNode = (object: HeapObject | undefined) =>
  Boolean(object?.fields && "next" in object.fields && !("left" in object.fields));

export const isTreeNode = (object: HeapObject | undefined) =>
  Boolean(object?.fields && "left" in object.fields && "right" in object.fields);

export const formatPrimitive = (value: SerializedValue | undefined): string => {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 1e4) / 1e4);
  }
  return value;
};

/** A short, human label for any value (used in cells, map values and captions). */
export function inlineLabel(value: SerializedValue | undefined, heap: Heap, depth = 0): string {
  if (!isRef(value, heap)) {
    return typeof value === "string" ? JSON.stringify(value) : formatPrimitive(value);
  }
  const object = heap[value];
  if (isListNode(object) || isTreeNode(object)) return `node ${nodeValue(object)}`;
  if (depth > 1) return object.items ? "[…]" : "{…}";
  if (object.items) {
    const inner = object.items.slice(0, 6).map((item) => inlineLabel(item, heap, depth + 1));
    const more = object.items.length > 6 || object.truncated ? ", …" : "";
    const [open, close] = object.type === "set" ? ["{", "}"] : object.type === "tuple" ? ["(", ")"] : ["[", "]"];
    return `${open}${inner.join(", ")}${more}${close}`;
  }
  if (object.fields) {
    if (object.type === "dict" || /dict|map|counter/i.test(object.type)) {
      const entries = Object.entries(object.fields).slice(0, 4);
      const more = Object.keys(object.fields).length > 4 ? ", …" : "";
      return `{${entries.map(([key, entry]) => `${key}: ${inlineLabel(entry, heap, depth + 1)}`).join(", ")}${more}}`;
    }
    return object.type;
  }
  return object.type;
}

// ---------------------------------------------------------------- models

export interface Tag {
  name: string;
  changed: boolean;
}

/** How the line about to run is treating a drawn object. */
export interface Attention {
  comparing?: boolean;
  reading?: boolean;
}

export interface ListNodeModel extends Attention {
  id: string;
  label: string;
  row: number;
  col: number;
  changed: boolean;
  tags: Tag[];
}

export interface ListEdgeModel {
  key: string;
  from: string;
  to: string | null;
  field: "next" | "prev" | "child" | "random";
  changed: boolean;
}

export interface ListViewModel {
  kind: "list";
  key: string;
  title: string;
  nodes: ListNodeModel[];
  edges: ListEdgeModel[];
  rows: number;
  cols: number;
}

export interface TreeNodeModel extends Attention {
  /** Position in the traversal, once this node's value has been consulted. */
  visit?: number;
  /** Extra numeric fields the node carries — a height or balance factor. */
  meta?: string;
  id: string;
  label: string;
  x: number;
  depth: number;
  changed: boolean;
  tags: Tag[];
}

export interface TreeViewModel {
  kind: "tree";
  key: string;
  title: string;
  nodes: TreeNodeModel[];
  edges: Array<{ key: string; from: string; to: string; side: "left" | "right" }>;
  width: number;
  depth: number;
}

export interface CellModel {
  key: string;
  label: string;
  changed: boolean;
  /** The line about to run weighs this cell against another. */
  comparing?: boolean;
  /** The line about to run only looks at this cell. */
  reading?: boolean;
  /** What a rewritten-in-place cell held a step ago. */
  previous?: string;
  /** The cell holds a reference to another structure. */
  ref?: boolean;
}

export type ArrayVariant = "list" | "tuple" | "stack" | "queue" | "deque" | "heap" | "set" | "string";

export interface PointerModel {
  name: string;
  index: number;
  changed: boolean;
}

export interface ArrayViewModel {
  kind: "array";
  key: string;
  title: string;
  variant: ArrayVariant;
  cells: CellModel[];
  truncated: number;
  pointers: PointerModel[];
  changed: boolean;
  /** Cells are keyed by value, so a swap animates as two cells trading places. */
  permuting?: boolean;
  /** Inclusive span between a pair of window pointers, when they read as one. */
  window?: { from: number; to: number };
  /** Leading and trailing runs a sort has provably finished with. */
  settled?: { prefix: number; suffix: number };
  /** Parent pointers: cell `i` names its parent, so the row is also a forest. */
  forest?: number[];
  /** Two cells that have just become one, and what made them. */
  merged?: { left: string; right: string; op: string };
  /** Drawn beneath another row, shifted to where it is being tried. */
  aligned?: { offset: number; matched: number };
  /** The stretch a prefix-sum difference is asking about. */
  sumSpan?: { from: number; to: number; total: string };
  /** The cell a scalar was lifted out of and is now weighed against. */
  pivot?: number;
  /** Where the run already on the pivot's low side ends. */
  divider?: number;
}

export interface GridCell {
  row: number;
  col: number;
}

export interface GridViewModel {
  kind: "grid";
  key: string;
  title: string;
  rows: CellModel[][];
  highlights: Array<{ row: number; col: number; names: string[] }>;
  rowPointers: PointerModel[];
  /** Cells the line about to run reads, and the cell it is about to fill. */
  dependency?: { from: GridCell[]; to: GridCell };
  /** The walk back through the finished table, as far as this step. */
  trail?: GridCell[];
}

export interface TrieNodeModel extends Attention {
  id: string;
  /** The character on the edge that reaches this node; empty at the root. */
  char: string;
  x: number;
  depth: number;
  end: boolean;
  changed: boolean;
  tags: Tag[];
}

export interface TrieViewModel {
  kind: "trie";
  key: string;
  title: string;
  nodes: TrieNodeModel[];
  edges: Array<{ key: string; from: string; to: string; char: string }>;
  width: number;
  depth: number;
}

export interface BitRowModel {
  name: string;
  value: number;
  /** Most significant first, so the row reads the way the number is written. */
  bits: Array<{ on: boolean; flipped: boolean }>;
  changed: boolean;
  comparing: boolean;
}

export interface BitsViewModel {
  kind: "bits";
  key: string;
  title: string;
  width: number;
  rows: BitRowModel[];
}

export interface CallNodeModel {
  id: string;
  fn: string;
  args: string;
  depth: number;
  parent: string | null;
  x: number;
  /** Step this call appeared, and the step it left the stack. */
  from: number;
  to: number;
  returned?: { value: string; deadEnd: boolean };
  /**
   * The call answered from a table instead of doing the work.
   *
   * What makes memoisation worth drawing is the branch that <em>does not</em>
   * happen, so a cached call has to look different from one that recursed and
   * from a base case that simply had nothing to do.
   */
  cached?: boolean;
}

export interface CallTreeViewModel {
  kind: "calls";
  key: string;
  title: string;
  nodes: CallNodeModel[];
  width: number;
  depth: number;
  /** The call currently executing. */
  activeId: string | null;
}

/**
 * Ranges drawn where they actually are, instead of as a table of pairs.
 *
 * Interval scheduling is about overlap, and a two-column table hides the one
 * thing the reader has to see. Laid on a shared axis, an accepted run and the
 * ones it ruled out are the same picture the problem is taught with.
 */
export interface TimelineViewModel {
  kind: "timeline";
  key: string;
  title: string;
  /** The axis, decided across the whole trace so bars never rescale. */
  from: number;
  to: number;
  bars: Array<{
    key: string;
    start: number;
    end: number;
    changed: boolean;
    /** Taken into the answer, weighed and passed over, or not yet reached. */
    verdict: "taken" | "passed" | "idle";
    /** The line about to run is looking at this one. */
    active: boolean;
  }>;
}

export interface GraphViewModel {
  kind: "graph";
  key: string;
  title: string;
  count: number;
  edges: Array<{ key: string; from: number; to: number; directed: boolean; weight?: string }>;
  active: Array<{ node: number; names: string[] }>;
  /** Component index per node, present only when the graph is disconnected. */
  components?: number[];
  /** Nodes discovered but not yet processed — the wavefront. */
  frontier?: number[];
  /** Nodes already settled. */
  visited?: number[];
  /** A per-node figure such as a distance, with what it held a step ago. */
  labels?: Array<{ value: string; previous?: string } | undefined>;
  /** The edge the current step is working across. */
  hotEdge?: string;
  /** Edges taken into the result so far. */
  chosen?: string[];
  /** Edges weighed and turned down — kept on screen, because that is the story. */
  rejected?: string[];
  /** Edges no reachable end of the search has touched yet. */
  dormant?: string[];
}

export interface MapViewModel {
  kind: "map";
  key: string;
  title: string;
  typeName: string;
  entries: Array<{ key: string; value: string; changed: boolean }>;
  truncated: number;
}

export interface ObjectViewModel {
  kind: "object";
  key: string;
  title: string;
  typeName: string;
  fields: Array<{ name: string; value: string; changed: boolean }>;
}

export type ViewModel =
  | ListViewModel
  | TreeViewModel
  | TrieViewModel
  | BitsViewModel
  | CallTreeViewModel
  | ArrayViewModel
  | GridViewModel
  | TimelineViewModel
  | GraphViewModel
  | MapViewModel
  | ObjectViewModel;

export interface VariableChip {
  name: string;
  value: string;
  changed: boolean;
  isNone: boolean;
}

export interface FrameModel {
  function: string;
  line: number;
  args: string;
  /** Set on the frame handing control back at this step. */
  returning?: { value: string; deadEnd: boolean };
}

/**
 * Functions for which returning nothing is a refusal rather than a void return.
 *
 * `False` says no on its own. `None` does not: a helper that walks a tree and
 * returns nothing every time has not failed, it simply has no answer to give.
 * The difference is whether the function ever returns something else — a search
 * that yields a node on one path and `None` on another is reporting a dead end.
 * Falsiness is the wrong test entirely; `fib(0)` correctly returns 0.
 */
/**
 * The order a traversal actually visits its nodes.
 *
 * Not the order they are reached — every recursive walk reaches them in
 * pre-order, whatever it is. A node is visited when its *value* is consulted,
 * so `res.append(node.val)` counts and `walk(node.left)` does not. That one
 * distinction is what separates pre-, in- and post-order; without it all three
 * would be numbered identically and the badges would be a lie.
 */
export function buildVisitOrder(trace: TraceStep[], source?: string): Map<string, number> {
  const order = new Map<string, number>();
  if (!source) return order;

  let next = 1;
  for (const step of trace) {
    const heap = step.heap;
    const touched = lineCells(source, step.line, step.variables);

    for (const { owner, field } of [...touched.read.attrs, ...touched.compared.attrs]) {
      if (!VALUE_FIELDS.includes(field)) continue;
      const target = step.variables[owner];
      if (!isRef(target, heap) || !isTreeNode(heap[target]) || order.has(target)) continue;
      order.set(target, next);
      next += 1;
    }
  }

  return order;
}

/** Beyond this a recursion is too wide to read, and the stack panel serves better. */
const MAX_CALLS = 90;

export interface CallTree {
  nodes: CallNodeModel[];
  width: number;
  depth: number;
}

/**
 * Every call the program made, as the tree it explored.
 *
 * The tracer records no call events, so a new frame is inferred from the stack
 * growing between steps — and a sibling call at the same depth is safe to spot
 * because returning to the parent always executes at least one line there
 * first, shrinking the stack in between.
 */
/**
 * Collections the program both fills and looks up by key — a memo table.
 *
 * Wanted as names rather than objects: the test is which line ran, and a line
 * is written in names. Both halves are required, because a table only read is
 * an input and a table only written is an output; a memo is the one that is
 * consulted before it is added to.
 */
function memoNames(source: string | undefined): string[] {
  if (!source) return [];
  const written = new Set<string>();
  const read = new Set<string>();
  for (const line of source.split("\n")) {
    const assign = /^\s*(\w+)\s*\[[^\]]*\]\s*=(?!=)/.exec(line);
    if (assign) written.add(assign[1]);
    const after = assign ? line.slice(line.indexOf("=", assign[0].length - 1) + 1) : line;
    for (const [, name] of after.matchAll(/(\w+)\s*\[/g)) read.add(name);
  }
  return [...written].filter((name) => read.has(name));
}

export function buildCallTree(
  trace: TraceStep[],
  failing: Set<string>,
  heapOf: (step: TraceStep) => Heap,
  source?: string
): CallTree | null {
  const nodes: CallNodeModel[] = [];
  const byId = new Map<string, CallNodeModel>();
  let active: string[] = [];
  let made = 0;

  const close = (id: string, at: number) => {
    const node = byId.get(id);
    if (node && node.to === Infinity) node.to = at;
  };

  // A frame that has just returned, so the next thing seen at its depth is a
  // new call rather than the same one continuing.
  let returnedAt = -1;

  for (let index = 0; index < trace.length; index += 1) {
    const step = trace[index];
    const stack = step.stack ?? [];

    while (active.length > stack.length) close(active.pop()!, index);

    // Two sibling calls written on one line — `fib(n - 1) + fib(n - 2)` — give
    // the caller no line event between them, so the stack never appears to
    // shrink and the second call would be mistaken for the first still
    // running. The return event is the only thing that separates them.
    if (returnedAt >= 0) {
      for (let deeper = active.length - 1; deeper >= returnedAt; deeper -= 1) close(active.pop()!, index);
      returnedAt = -1;
    }

    for (let depth = 0; depth < stack.length; depth += 1) {
      const frame = stack[depth];
      const current = active[depth] ? byId.get(active[depth]) : undefined;
      if (current && current.fn === frame.function) continue;

      for (let deeper = active.length - 1; deeper >= depth; deeper -= 1) close(active.pop()!, index);
      if (made >= MAX_CALLS) return null;

      const node: CallNodeModel = {
        id: `c${made}`,
        fn: frame.function,
        args: Object.entries(frame.variables)
          .slice(0, 2)
          .map(([name, value]) => `${name}=${describeValue(value, heapOf(step))}`)
          .join(", "),
        depth,
        parent: depth > 0 ? active[depth - 1] ?? null : null,
        x: 0,
        from: index,
        to: Infinity
      };
      made += 1;
      nodes.push(node);
      byId.set(node.id, node);
      active[depth] = node.id;
    }

    if (step.event === "return") returnedAt = Math.max(0, stack.length - 1);

    // A return belongs to the frame handing back, which is the deepest one.
    if (step.event === "return" && active.length) {
      const node = byId.get(active[active.length - 1]);
      if (node && !node.returned) {
        node.returned = {
          value: describeValue(step.returns ?? null, heapOf(step)),
          deadEnd:
            step.returns === false ||
            ((step.returns === null || step.returns === undefined) && failing.has(node.fn))
        };
      }
    }
  }

  for (const id of active) close(id, trace.length);
  if (nodes.length < 3) return null;

  /**
   * Which calls were answered out of the table.
   *
   * Two things together, and neither on its own: the call looked the table up,
   * and it never recursed. A miss looks the table up too, but then goes on to
   * call itself; a base case returns without ever touching it. No return value
   * is needed for this, which is what makes it work in every language rather
   * than only the one whose tracer reports them.
   */
  const memo = memoNames(source);
  if (memo.length > 0 && source) {
    const lines = source.split("\n");
    const consults = trace.map((step) => {
      const text = lines[(step.line ?? 0) - 1];
      if (!text) return false;
      const rest = /^\s*\w+\s*\[[^\]]*\]\s*=(?!=)/.test(text) ? text.slice(text.indexOf("=") + 1) : text;
      return memo.some((name) => new RegExp(String.raw`\b${name}\s*\[`).test(rest));
    });

    const hasChild = new Set(nodes.map((node) => node.parent).filter(Boolean) as string[]);
    for (const node of nodes) {
      if (hasChild.has(node.id)) continue;
      const until = Math.min(node.to, trace.length);
      for (let at = node.from; at < until; at += 1) {
        if (consults[at]) {
          node.cached = true;
          break;
        }
      }
    }
  }

  // Leaves take the next column; a parent centres over the span of its children.
  const children = new Map<string, CallNodeModel[]>();
  for (const node of nodes) {
    if (node.parent) children.set(node.parent, [...(children.get(node.parent) ?? []), node]);
  }
  let cursor = 0;
  const place = (node: CallNodeModel): number => {
    const kids = children.get(node.id) ?? [];
    if (kids.length === 0) {
      node.x = cursor;
      cursor += 1;
      return node.x;
    }
    const spread = kids.map(place);
    node.x = (Math.min(...spread) + Math.max(...spread)) / 2;
    return node.x;
  };
  for (const node of nodes) if (!node.parent) place(node);

  return { nodes, width: Math.max(cursor, 1), depth: Math.max(...nodes.map((node) => node.depth)) };
}

/** `&`, `|`, `^`, `~` and the shifts — but never the boolean `&&` or `||`. */
const BITWISE = /&(?!&)|\|(?!\|)|\^|<<|>>|~/;

export interface BitPlan {
  names: Set<string>;
  width: number;
}

/**
 * Integers a program actually manipulates bit by bit.
 *
 * Decided across the whole trace so the view holds still: a number that is
 * shifted on one line is shown as bits on every line, rather than appearing as
 * a row of bits for one step and a plain chip for the next. The width is fixed
 * the same way, so columns never reflow underneath the reader.
 */
export function buildBitPlan(trace: TraceStep[], source?: string): BitPlan {
  const names = new Set<string>();
  if (!source) return { names, width: 0 };

  const lines = source.split("\n");
  trace.forEach((step, index) => {
    const raw = lines[step.line - 1];
    if (!raw) return;
    const text = raw.replace(/#.*$/, "").replace(/"(?:\\.|[^"\\])*"/g, '""');
    if (!BITWISE.test(text)) return;

    // The step after, too: `both = a & b` assigns a name that does not exist
    // yet while the line is pending, and the result is the point of the row.
    const scopes = [step.variables, trace[index + 1]?.variables ?? {}];
    for (const [word] of text.matchAll(/[A-Za-z_]\w*/g)) {
      for (const scope of scopes) {
        const value = scope[word];
        if (typeof value === "number" && Number.isInteger(value) && value >= 0) names.add(word);
      }
    }
  });

  let widest = 0;
  for (const step of trace) {
    for (const name of names) {
      const value = step.variables[name];
      if (typeof value === "number" && value >= 0) widest = Math.max(widest, value.toString(2).length);
    }
  }

  return { names, width: Math.min(32, Math.max(8, widest)) };
}

/**
 * Character-keyed edges out of a trie node.
 *
 * Two shapes both occur and both are handled: a class whose `children` field
 * holds the map, and a bare nested dict where the characters are the node's own
 * keys. The single-character key is what makes a trie identifiable at all — an
 * object graph with arbitrary field names is just an object graph.
 */
const trieChildren = (id: string, heap: Heap): Array<{ char: string; to: string }> => {
  const object = heap[id];
  if (!object?.fields) return [];

  const holder = Object.entries(object.fields).find(
    ([name, value]) => isRef(value, heap) && heap[value]?.type === "dict" && /child|kid|next|link|edge/i.test(name)
  );
  const source = holder ? heap[holder[1] as string] : object;

  return Object.entries(source?.fields ?? {})
    .filter(([key, value]) => key.length === 1 && isRef(value, heap))
    .map(([key, value]) => ({ char: key, to: value as string }));
};

/** A node that terminates a word: a truthy flag that is not a child link. */
const trieEnds = (id: string, heap: Heap): boolean => {
  const fields = heap[id]?.fields ?? {};
  return Object.entries(fields).some(([key, value]) => value === true && !isRef(value, heap) && key.length <= 4);
};

/** Cells a grid was read at, per step, once it had stopped being filled. */
export type GridTrails = Map<string, Array<{ step: number; cells: GridCell[] }>>;

/**
 * The walk back through a finished table.
 *
 * A reconstruction is not a separate kind of step — it is the reads that
 * happen after the table has stopped changing. Finding the last write and
 * keeping every cell read after it gives the path that produced the answer,
 * without needing to know which problem is being solved.
 */
export function buildGridTrails(trace: TraceStep[], source?: string): GridTrails {
  const trails: GridTrails = new Map();
  if (!source) return trails;

  const lastWrite = new Map<string, number>();
  const readsAt: Array<{ id: string; step: number; cells: GridCell[] }> = [];

  for (let index = 0; index < trace.length; index += 1) {
    const step = trace[index];
    const heap = step.heap;
    const touched = lineCells(source, step.line, step.variables);
    const named = new Map<string, string>();
    for (const [name, value] of Object.entries(step.variables)) {
      if (isRef(value, heap) && heap[value].items) named.set(name, value);
    }

    for (const [name, id] of named) {
      const written = (touched.written.cells.get(name) ?? []).filter((ref) => ref.col !== undefined);
      if (written.length) lastWrite.set(id, index);

      // A walk back consults cells however it likes — `dp[i][j] == dp[i-1][j]`
      // is a comparison, not a read, and it is the commonest form there is.
      const consulted = [
        ...(touched.read.cells.get(name) ?? []),
        ...(touched.compared.cells.get(name) ?? [])
      ].filter((ref): ref is GridCell => ref.col !== undefined);
      // Only the first cell of each step: in `dp[i][j] == dp[i-1][j]` that is
      // the cursor, and the rest are the candidates it is choosing between.
      // Keeping them all would draw a zigzag between the two rather than the
      // walk the reconstruction actually took.
      if (consulted.length) readsAt.push({ id, step: index, cells: [consulted[0]] });
    }
  }

  for (const entry of readsAt) {
    const after = lastWrite.get(entry.id);
    if (after === undefined || entry.step <= after) continue;
    const trail = trails.get(entry.id) ?? [];
    trail.push({ step: entry.step, cells: entry.cells });
    trails.set(entry.id, trail);
  }

  return trails;
}

/** Numeric fields a node carries besides its value and its links. */
const nodeMeta = (object: HeapObject | undefined): string | undefined => {
  const extra = Object.entries(object?.fields ?? {}).filter(
    ([field, value]) =>
      typeof value === "number" && !VALUE_FIELDS.includes(field) && !TREE_LINKS.includes(field)
  );
  if (!extra.length) return undefined;
  return extra
    .slice(0, 2)
    .map(([field, value]) => `${field} ${formatPrimitive(value)}`)
    .join(" · ");
};

export function buildFailingReturns(trace: TraceStep[]): Set<string> {
  const empty = new Set<string>();
  const answered = new Set<string>();

  for (const step of trace) {
    if (step.event !== "return") continue;
    const frame = step.stack?.[step.stack.length - 1];
    if (!frame) continue;
    if (step.returns === null || step.returns === undefined) empty.add(frame.function);
    else answered.add(frame.function);
  }

  return new Set([...empty].filter((name) => answered.has(name)));
}

export interface StepModel {
  views: ViewModel[];
  variables: VariableChip[];
  frames: FrameModel[];
  caption: string;
  /** Values crossing from one drawn row into another on this step. */
  flows: Flow[];
}

/**
 * One value moving between two rows.
 *
 * A merge is the case that needs it: `res.append(a[i])` leaves `a` untouched,
 * so nothing in the heap diff says where the new element came from and no
 * shared-layout trick can move a box that still exists in both places. The
 * line does say it, though — it reads one cell and the row it writes to grows
 * by one — and a drawn connector is the honest way to show a copy.
 */
export interface Flow {
  key: string;
  /** `data-flow` handle of the cell the connector leaves. */
  from: string;
  /** `data-flow` handle of the cell it arrives at. */
  to: string;
  /**
   * What the connector is saying. A copy moved a value between rows; an
   * eviction is one element turning another out of a stack, which is the
   * whole content of a monotonic-stack step and the one thing the two
   * flashing cells do not say on their own.
   */
  kind: "copy" | "evicts";
}

// ------------------------------------------------------------ list slots

export type ListSlots = Map<string, { row: number; col: number }>;

/**
 * Stable positions for every list node across the whole trace, so pointer
 * rewiring animates arrows instead of shuffling nodes. `next` moves right and
 * `child` moves down; a node first seen just before an already-placed node is
 * put to its left. A node with no links yet (a fresh sentinel, say) waits until
 * it joins a chain, so design classes that build nodes one at a time still lay
 * out in a row.
 */
export function buildListSlots(trace: TraceStep[]): ListSlots {
  const slots: ListSlots = new Map();
  const occupied = new Map<number, Set<number>>();
  let rows = 0;

  const take = (row: number, col: number, direction: 1 | -1) => {
    const used = occupied.get(row) ?? new Set<number>();
    occupied.set(row, used);
    let c = col;
    while (used.has(c)) c += direction;
    used.add(c);
    return c;
  };

  const place = (id: string, row: number, col: number, direction: 1 | -1) => {
    const finalCol = take(row, col, direction);
    slots.set(id, { row, col: finalCol });
  };

  const LINKS = ["next", "prev", "child"];
  const loose: string[] = [];

  for (const step of trace) {
    const heap = step.heap;
    const linked = new Set<string>();
    for (const [id, object] of Object.entries(heap)) {
      if (!isListNode(object)) continue;
      for (const field of LINKS) {
        const target = object.fields?.[field];
        if (isRef(target, heap)) {
          linked.add(id);
          linked.add(target);
        }
      }
    }
    const roots: string[] = [];
    const addRoots = (variables: Record<string, SerializedValue>) => {
      for (const value of Object.values(variables)) {
        if (isRef(value, heap)) roots.push(value);
      }
    };
    addRoots(step.variables);
    for (const frame of step.stack ?? []) addRoots(frame.variables);
    // Nodes reachable only through containers or objects (e.g. this.head).
    for (const [id, object] of Object.entries(heap)) {
      if (!isListNode(object)) {
        for (const value of [...Object.values(object.fields ?? {}), ...(object.items ?? [])]) {
          if (isRef(value, heap) && isListNode(heap[value])) roots.push(value);
        }
      } else if (!roots.includes(id)) {
        roots.push(id);
      }
    }

    for (const root of roots) {
      if (!isListNode(heap[root])) continue;
      // Walk the chain along `next`.
      const chain: string[] = [];
      const seen = new Set<string>();
      let current: string | null = root;
      while (current && isListNode(heap[current]) && !seen.has(current) && chain.length < 200) {
        seen.add(current);
        chain.push(current);
        const next: SerializedValue | undefined = heap[current].fields?.next;
        current = isRef(next, heap) ? next : null;
      }

      if (chain.length === 1 && !linked.has(root) && !slots.has(root)) {
        if (!loose.includes(root)) loose.push(root);
        continue;
      }

      chain.forEach((id, index) => {
        if (slots.has(id)) return;
        const before = index > 0 ? slots.get(chain[index - 1]) : undefined;
        if (before) {
          place(id, before.row, before.col + 1, 1);
          return;
        }
        const afterIndex = chain.findIndex((other, k) => k > index && slots.has(other));
        if (afterIndex > 0) {
          // Left of the node it points at; if that slot is taken (a node being
          // spliced in mid-list), drop to the first free row beneath instead.
          const after = slots.get(chain[afterIndex])!;
          const col = after.col - (afterIndex - index);
          let row = after.row;
          while (occupied.get(row)?.has(col)) row += 1;
          rows = Math.max(rows, row + 1);
          place(id, row, col, -1);
          return;
        }
        // A child column hangs under its parent.
        const parent = Object.entries(heap).find(([, object]) => object.fields?.child === id);
        const parentSlot = parent ? slots.get(parent[0]) : undefined;
        if (parentSlot) {
          const row = parentSlot.row + 1;
          rows = Math.max(rows, row + 1);
          place(id, row, parentSlot.col, 1);
          return;
        }
        place(id, rows, 0, 1);
        rows += 1;
      });

      // Child columns (flattening problems).
      for (const id of chain) {
        let child = heap[id]?.fields?.child;
        let parent = id;
        while (isRef(child, heap) && !slots.has(child)) {
          const parentSlot = slots.get(parent)!;
          const row = parentSlot.row + 1;
          rows = Math.max(rows, row + 1);
          place(child, row, parentSlot.col, 1);
          parent = child;
          child = heap[child]?.fields?.child;
        }
      }
    }
  }

  // Nodes that never joined a chain still get a row each.
  for (const id of loose) {
    if (slots.has(id)) continue;
    place(id, rows, 0, 1);
    rows += 1;
  }

  // Shift every row so its leftmost column is 0.
  const minByRow = new Map<number, number>();
  for (const { row, col } of slots.values()) {
    minByRow.set(row, Math.min(minByRow.get(row) ?? Infinity, col));
  }
  const globalMin = Math.min(0, ...minByRow.values());
  for (const [id, slot] of slots) slots.set(id, { row: slot.row, col: slot.col - globalMin });
  return slots;
}

// --------------------------------------------------------------- helpers

const INDEX_NAMES = new Set([
  "i", "j", "k", "l", "r", "lo", "hi", "low", "high", "left", "right", "mid", "start", "end",
  "begin", "slow", "fast", "p", "q", "p1", "p2", "ptr", "idx", "index", "pos", "write", "read",
  "w", "top", "front", "rear", "cur", "curr", "last", "first", "a", "b", "x", "y", "row", "col",
  "c", "m", "n1", "n2", "lp", "rp", "insert", "zero", "one", "two", "red", "white", "blue"
]);

const isIndexName = (name: string) =>
  INDEX_NAMES.has(name) || /(^|_)(idx|index|ptr|pos)$|(Idx|Index|Ptr|Pos)$/.test(name);

const STACK_NAMES = /^(stack|stk|st|mono|monostack|ops|operators)$/i;
const QUEUE_NAMES = /^(queue|q|dq|deque|bfs|frontier)$/i;
const HEAP_NAMES = /^(heap|pq|minheap|maxheap|min_heap|max_heap|h)$/i;
const GRAPH_NAMES = /^(adj|graph|g|adjlist|adj_list|adjacency|neighbors|neighbours|edges_of)$/i;
const PARENT_NAMES = /^(parent|parents|par|root|roots|uf|dsu|rep|leader|link)$/i;

/**
 * A disjoint-set array read as the forest it is: cell `i` names its parent, and
 * a root names itself. Both tests have to pass — the name, and every cell being
 * a valid index into the array — because an array of small integers is
 * otherwise indistinguishable from any other.
 */
const asForest = (items: SerializedValue[], baseName: string): number[] | undefined => {
  if (!PARENT_NAMES.test(baseName) || items.length < 2) return undefined;

  const parent: number[] = [];
  for (const item of items) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 0 || item >= items.length) {
      return undefined;
    }
    parent.push(item);
  }
  return parent;
};

/**
 * Pointer pairs that read as the two ends of one region rather than as two
 * unrelated cursors. `i`/`j` is deliberately absent: in a double loop it is two
 * cursors, and shading between them would invent a window that is not there.
 */
const WINDOW_PAIRS: Array<[string, string]> = [
  ["left", "right"],
  ["lo", "hi"],
  ["low", "high"],
  ["start", "end"],
  ["begin", "end"],
  ["l", "r"],
  ["lp", "rp"],
  ["first", "last"],
  ["slow", "fast"]
];

const windowSpan = (pointers: PointerModel[], length: number) => {
  if (length === 0) return undefined;
  const at = new Map(pointers.map((pointer) => [pointer.name.toLowerCase(), pointer.index]));
  for (const [start, end] of WINDOW_PAIRS) {
    const from = at.get(start);
    const to = at.get(end);
    if (from === undefined || to === undefined) continue;
    const lo = Math.max(0, Math.min(from, to));
    // A right edge often sits one past the last cell; shade up to the real end.
    const hi = Math.min(length - 1, Math.max(from, to));
    // A window of one cell is already shown by the two pointer pills.
    if (hi - lo < 1) continue;
    return { from: lo, to: hi };
  }
  return undefined;
};

/**
 * Cells a sort has already finished with.
 *
 * Read off the data rather than off the algorithm: a leading run is final when
 * it is sorted and every value to its right is at least its largest, and the
 * mirror holds for a trailing run. That is exactly the guarantee bubble sort
 * builds at the tail, selection sort at the head and heap sort at the tail, so
 * one rule dims the settled region for all of them without naming any of them.
 * The scan stops at the first cell it cannot prove, so it never over-claims.
 */
const settledRegions = (items: SerializedValue[]) => {
  const values: number[] = [];
  for (const item of items) {
    if (typeof item !== "number") return undefined;
    values.push(item);
  }

  const count = values.length;
  if (count < 2) return undefined;

  const lowestFrom = new Array<number>(count + 1).fill(Infinity);
  for (let cell = count - 1; cell >= 0; cell -= 1) {
    lowestFrom[cell] = Math.min(values[cell], lowestFrom[cell + 1]);
  }
  const highestUpTo = new Array<number>(count + 1).fill(-Infinity);
  for (let cell = 0; cell < count; cell += 1) {
    highestUpTo[cell + 1] = Math.max(values[cell], highestUpTo[cell]);
  }

  let prefix = 0;
  for (let size = 1; size <= count; size += 1) {
    if (size > 1 && values[size - 2] > values[size - 1]) break;
    if (highestUpTo[size] > lowestFrom[size]) break;
    prefix = size;
  }

  let suffix = 0;
  for (let size = 1; size <= count; size += 1) {
    const start = count - size;
    if (size > 1 && values[start] > values[start + 1]) break;
    if (lowestFrom[start] < highestUpTo[start]) break;
    suffix = size;
  }

  suffix = Math.min(suffix, count - prefix);
  return prefix + suffix > 0 ? { prefix, suffix } : undefined;
};

const bagOf = (items: SerializedValue[]) => {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = JSON.stringify(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

const sameBag = (before: Map<string, number>, after: Map<string, number>) => {
  if (before.size !== after.size) return false;
  for (const [key, count] of before) if (after.get(key) !== count) return false;
  return true;
};

/**
 * Arrays that get rearranged rather than rewritten.
 *
 * A sort permutes a multiset: the same values come out, only their order moved.
 * Those cells are keyed by value, so framer carries each box to its new slot and
 * a swap reads as two cells trading places. Every other array — a DP table, a
 * prefix sum, a result being appended to — keeps index keys, where a write
 * should read as that cell changing in place rather than one value leaving and
 * another arriving. Decided once for the whole trace so the keys never change
 * scheme mid-replay, which would turn every move into a fade.
 */
/**
 * Which objects are ranges on a timeline, and what axis they share.
 *
 * A pair of numbers is not enough on its own — an edge list has the same
 * shape — so a name has to vouch for the first one. After that the shape
 * carries it: any other collection whose rows all appear in a vouched-for one
 * is the accepted subset of it, and belongs on the same axis.
 *
 * The axis is fixed for the whole run. A result list that grows would
 * otherwise rescale its own picture on every accept.
 */
/**
 * Which arrays are running totals of which others.
 *
 * Checked, not guessed: `p` is a prefix sum of `a` when every one of its cells
 * is the one before it plus a cell of `a`. That is a property of the numbers,
 * so it holds or it does not, and no name has to vouch for it.
 *
 * It matters because `p[j] - p[i]` is the one line in a prefix-sum solution
 * that means anything, and on its own it is two cells of an array of numbers
 * nobody can read. Knowing what `p` is turns it into a stretch of `a`.
 */
export type PrefixSums = Map<string, { source: string; offset: 0 | 1 }>;

/**
 * One row tried against another, and where it currently sits.
 *
 * String matching is two rows or it is nothing: a pattern drawn on its own
 * line, starting at column zero, shows none of the sliding that is the whole
 * algorithm. The alignment does not have to be inferred from the algorithm
 * though — the comparison says it outright. `text[i] == pat[j]` puts the
 * pattern's `j` under the text's `i`, so the offset between the rows is the
 * difference of the two subscripts, whatever arithmetic produced them.
 * `text[i + j] == pat[j]` gives `i` for the naive search by the same sum.
 */
export interface Alignment {
  text: string;
  pattern: string;
  /** Columns the pattern is shifted right, per step. */
  offsets: number[];
  /** Leading pattern cells confirmed to match, per step. */
  matched: number[];
}

export function buildAlignment(trace: TraceStep[], source?: string): Alignment | null {
  if (!source) return null;

  const readAt = (step: TraceStep, line: number | undefined) => {
    const heap = step.heap;
    const touched = lineCells(
      source,
      line,
      step.variables,
      (name, at) => {
        const target = step.variables[name];
        if (!isRef(target, heap)) return undefined;
        const item = heap[target].items?.[at];
        return typeof item === "number" && Number.isInteger(item) ? item : undefined;
      },
      (name) => {
        const target = step.variables[name];
        return isRef(target, heap) ? heap[target].items?.length : undefined;
      }
    );

    // Exactly one cell from each of two different rows: that is the pairing.
    const hits: Array<{ id: string; row: number; length: number }> = [];
    for (const [name, refs] of touched.compared.cells) {
      const id = step.variables[name];
      if (!isRef(id, heap)) continue;
      const items = heap[id].items;
      if (!items || hits.some((hit) => hit.id === id)) continue;
      const flat = refs.filter((ref) => ref.col === undefined);
      if (flat.length !== 1) continue;
      hits.push({ id, row: flat[0].row, length: items.length });
    }
    if (hits.length !== 2 || hits[0].length === hits[1].length) return null;

    // The shorter row is the one being slid along the longer.
    const [text, pattern] = hits[0].length > hits[1].length ? hits : [hits[1], hits[0]];
    return { text: text.id, pattern: pattern.id, offset: text.row - pattern.row, matched: pattern.row };
  };

  // Which line does the matching, and which two rows it pairs.
  const tally = new Map<string, number>();
  for (const step of trace) {
    const hit = readAt(step, step.line);
    if (hit) tally.set(`${step.line}|${hit.text}|${hit.pattern}`, (tally.get(`${step.line}|${hit.text}|${hit.pattern}`) ?? 0) + 1);
  }
  if (tally.size === 0) return null;
  const [best] = [...tally].sort((a, b) => b[1] - a[1]);
  const [lineText, text, pattern] = best[0].split("|");
  const line = Number(lineText);

  /**
   * Read that one line at every step, not only where it runs.
   *
   * The cursors move on the steps in between — KMP's whole trick is changing
   * `j` without comparing anything — and a row that only caught up when the
   * comparison came round again would sit a move behind the pointers drawn on
   * it. Re-evaluating the line's own subscripts against each step's variables
   * costs nothing and is always current.
   */
  const offsets: number[] = [];
  const matched: number[] = [];
  let offset: number | undefined;
  let count = 0;
  for (const step of trace) {
    const hit = readAt(step, line);
    if (hit && hit.text === text && hit.pattern === pattern && hit.offset >= 0) {
      // Only if it is true. `i` and `j` advance on separate lines, so between
      // the two the pair says the pattern has matched more than it has, and a
      // row drawn on that would jump a column and come back. Checking the
      // claim against the two rows costs a few comparisons and means the
      // drawing never asserts a match that is not there.
      const above = step.heap[text]?.items ?? [];
      const below = step.heap[pattern]?.items ?? [];
      let holds = true;
      for (let k = 0; k < hit.matched && holds; k += 1) {
        holds = above[hit.offset + k] !== undefined && above[hit.offset + k] === below[k];
      }
      if (holds) {
        offset = hit.offset;
        count = hit.matched;
      }
    }
    offsets.push(Math.max(0, offset ?? 0));
    matched.push(count);
  }

  // Backwards too, so the first steps are not drawn at a zero that was never
  // true. Whatever it settles on first is where it started.
  const first = offsets.findIndex((_, at) => at > 0 && offsets[at] !== 0);
  if (first > 0) {
    for (let at = 0; at < first; at += 1) matched[at] = matched[first];
  }

  return { text, pattern, offsets, matched };
}

export function buildPrefixSums(trace: TraceStep[]): PrefixSums {
  const widest = new Map<string, SerializedValue[]>();
  for (const step of trace) {
    for (const [id, object] of Object.entries(step.heap)) {
      const items = object.items;
      if (!items || !items.every((item) => typeof item === "number")) continue;
      // The latest state at the fullest size, not the first: a total that is
      // filled in place starts as a row of zeros the same length as it ends.
      if (items.length >= (widest.get(id)?.length ?? -1)) widest.set(id, items);
    }
  }

  const sums: PrefixSums = new Map();
  for (const [id, totals] of widest) {
    if (totals.length < 3) continue;
    for (const [other, values] of widest) {
      if (other === id || values.length < 2) continue;

      // `p[0] = 0, p[i] = p[i-1] + a[i-1]` — the form with room for the
      // empty prefix, which is what makes `p[j] - p[i]` come out right.
      if (totals.length === values.length + 1 && totals[0] === 0) {
        let holds = true;
        for (let k = 1; k < totals.length && holds; k += 1) {
          holds = (totals[k] as number) === (totals[k - 1] as number) + (values[k - 1] as number);
        }
        if (holds) {
          sums.set(id, { source: other, offset: 1 });
          break;
        }
      }

      // `p[i] = p[i-1] + a[i]` — the same length, accumulated in step.
      if (totals.length === values.length && totals[0] === values[0]) {
        let holds = true;
        for (let k = 1; k < totals.length && holds; k += 1) {
          holds = (totals[k] as number) === (totals[k - 1] as number) + (values[k] as number);
        }
        if (holds) {
          sums.set(id, { source: other, offset: 0 });
          break;
        }
      }
    }
  }
  return sums;
}

/**
 * Which objects are ranges on a timeline, and what axis they share.
 *
 * A pair of numbers is not enough on its own — an edge list has the same
 * shape — so a name has to vouch for the first one. After that the shape
 * carries it: any other collection whose rows all appear in a vouched-for one
 * is the accepted subset of it, and belongs on the same axis.
 *
 * The axis is fixed for the whole run. A result list that grows would
 * otherwise rescale its own picture on every accept.
 */
export interface TimelinePlan {
  ids: Set<string>;
  from: number;
  to: number;
}

const INTERVAL_NAMES =
  /^(intervals?|jobs?|meetings?|tasks?|events?|ranges?|slots?|bookings?|segments?|appointments?|lectures?)$/i;

const intervalRows = (object: HeapObject | undefined, heap: Heap): number[][] | undefined => {
  const items = object?.items;
  if (!items) return undefined;
  const rows: number[][] = [];
  for (const item of items) {
    if (!isRef(item, heap)) return undefined;
    const pair = heap[item].items;
    if (!pair || pair.length !== 2) return undefined;
    const [start, end] = pair;
    if (typeof start !== "number" || typeof end !== "number" || start > end) return undefined;
    rows.push([start, end]);
  }
  return rows;
};

export function buildTimelinePlan(trace: TraceStep[]): TimelinePlan | null {
  // The fullest each object ever got: a result list starts empty, and judging
  // it on that would say nothing.
  const widest = new Map<string, { object: HeapObject; heap: Heap }>();
  const vouched = new Set<string>();
  for (const step of trace) {
    for (const [id, object] of Object.entries(step.heap)) {
      const count = object.items?.length ?? 0;
      if (count > (widest.get(id)?.object.items?.length ?? -1)) widest.set(id, { object, heap: step.heap });
    }
    const frames = [step.variables, ...(step.stack ?? []).map((frame) => frame.variables)];
    for (const variables of frames) {
      for (const [name, value] of Object.entries(variables)) {
        if (INTERVAL_NAMES.test(name) && isRef(value, step.heap)) vouched.add(value);
      }
    }
  }

  const seeds: number[][] = [];
  for (const id of vouched) {
    const held = widest.get(id);
    const rows = intervalRows(held?.object, held!.heap);
    if (rows && rows.length > 0) seeds.push(...rows);
  }
  if (seeds.length === 0) return null;

  const known = new Set(seeds.map((row) => row.join(",")));
  const ids = new Set<string>();
  for (const [id, held] of widest) {
    const rows = intervalRows(held.object, held.heap);
    if (!rows || rows.length === 0) continue;
    if (rows.every((row) => known.has(row.join(",")))) ids.add(id);
  }
  if (ids.size === 0) return null;

  return {
    ids,
    from: Math.min(...seeds.map((row) => row[0])),
    to: Math.max(...seeds.map((row) => row[1]))
  };
}

export interface ArrayRoles {
  /** Gets rearranged, so its cells are keyed by value and swaps animate. */
  permuting: Set<string>;
  /** Ends up in order, so a proven-final run may be dimmed as settled. */
  sorting: Set<string>;
  /**
   * Has at least one cell overwritten more than once — the signature of a
   * rolling array. Those cells show what they held before, because a table
   * being reused in place is the thing learners miss about the O(n) form.
   */
  rolling: Set<string>;
  /**
   * Indexed as a binary heap somewhere in the program.
   *
   * A heap is a tree that happens to be stored in a row, and the giveaway is
   * the arithmetic: `arr[2 * i + 1]` or `arr[(i - 1) // 2]` is a program
   * walking parents and children. Reading that off the source means a sort
   * over plain `nums` draws as the tree it is being treated as, instead of
   * waiting to be called `heap`.
   *
   * Held as object ids, not names: a heapify takes the row as `arr` and the
   * caller knows it as `nums`, and a view that turned into a tree on entering
   * the function and back into a row on leaving it would be unreadable.
   */
  heapShaped: Set<string>;
}

/**
 * Index expressions that are parent/child arithmetic.
 *
 * `i // 2` on its own is left out on purpose: a midpoint is written exactly
 * that way, and a binary search drawn as a heap would be worse than a heap
 * drawn as a row.
 */
const HEAP_INDEX = [
  /^\s*2\s*\*\s*\w+\s*\+\s*[12]\s*$/,
  /^\s*\w+\s*\*\s*2\s*\+\s*[12]\s*$/,
  /^\s*\(\s*\w+\s*-\s*1\s*\)\s*\/\/?\s*2\s*$/,
  /^\s*\(\s*\w+\s*\+\s*1\s*\)\s*\/\/?\s*2\s*-\s*1\s*$/
];

const heapShapedNames = (source?: string): Set<string> => {
  const names = new Set<string>();
  if (!source) return names;
  const isHeapIndex = (text: string) => HEAP_INDEX.some((shape) => shape.test(text));

  // The arithmetic is usually one line away from the subscript: `l = 2*i+1`
  // and then `arr[l]`. Follow the name, or a heapify never matches.
  const carriers = new Set<string>();
  for (const match of source.matchAll(/(?:^|[;{(\s])(\w+)\s*=\s*([^=;\n][^;\n]*)/g)) {
    if (isHeapIndex(match[2])) carriers.add(match[1]);
  }

  for (const match of source.matchAll(/(\w+)\s*\[([^\[\]]*)\]/g)) {
    const inner = match[2].trim();
    if (isHeapIndex(inner) || carriers.has(inner)) names.add(match[1]);
  }
  return names;
};

export function buildArrayRoles(trace: TraceStep[], source?: string): ArrayRoles {
  const permuting = new Set<string>();
  const first = new Map<string, SerializedValue[]>();
  const last = new Map<string, SerializedValue[]>();
  const rewritten = new Set<string>();
  const writes = new Map<string, Map<number, number>>();

  for (let index = 0; index < trace.length; index += 1) {
    const before = index > 0 ? trace[index - 1].heap : {};
    for (const [id, object] of Object.entries(trace[index].heap)) {
      if (!object.items) continue;
      if (!first.has(id)) first.set(id, object.items);
      last.set(id, object.items);

      const previous = before[id];
      // Delta heaps share unchanged objects by reference.
      if (!previous?.items || previous === object) continue;
      const moved =
        previous.items.length !== object.items.length ||
        object.items.some((item, cell) => JSON.stringify(item) !== JSON.stringify(previous.items![cell]));
      if (!moved) continue;

      rewritten.add(id);
      if (previous.items.length === object.items.length && sameBag(bagOf(previous.items), bagOf(object.items))) {
        permuting.add(id);
      }

      const perCell = writes.get(id) ?? new Map<number, number>();
      object.items.forEach((item, cell) => {
        if (JSON.stringify(item) === JSON.stringify(previous.items![cell])) return;
        perCell.set(cell, (perCell.get(cell) ?? 0) + 1);
      });
      writes.set(id, perCell);
    }
  }

  // A sort that shifts rather than swaps passes through states holding a
  // duplicate, so no single step is a permutation — but it still ends up with
  // exactly the values it began with. Insertion sort is the common case.
  for (const id of rewritten) {
    if (permuting.has(id)) continue;
    const start = first.get(id);
    const end = last.get(id);
    if (start && end && start.length === end.length && sameBag(bagOf(start), bagOf(end))) permuting.add(id);
  }

  // Rearranging is not the same as sorting: a two-pointer reverse begins sorted
  // and ends anything but. Only an array that finishes in order may claim cells
  // are settled, or the replay would dim the whole row on step one and undim it.
  const sorting = new Set<string>();
  for (const id of permuting) {
    const end = last.get(id);
    if (!end || end.some((item) => typeof item !== "number")) continue;
    const values = end as number[];
    if (values.every((value, cell) => cell === 0 || values[cell - 1] <= value)) sorting.add(id);
  }

  // A swap already shows a value moving, so only a rewritten-in-place array
  // needs to say what it held before.
  const rolling = new Set<string>();
  for (const [id, perCell] of writes) {
    if (permuting.has(id)) continue;
    if ([...perCell.values()].some((count) => count > 1)) rolling.add(id);
  }

  // The names the arithmetic named, resolved to whatever objects they ever
  // held, in any frame.
  const heapNames = heapShapedNames(source);
  const heapShaped = new Set<string>();
  if (heapNames.size > 0) {
    for (const step of trace) {
      const frames = [step.variables, ...(step.stack ?? []).map((frame) => frame.variables)];
      for (const variables of frames) {
        for (const [name, value] of Object.entries(variables)) {
          if (heapNames.has(name) && isRef(value, step.heap) && step.heap[value].items) {
            heapShaped.add(value);
          }
        }
      }
    }
  }

  return { permuting, sorting, rolling, heapShaped };
}

const changedIds = (diff: TraceDiff | undefined) => {
  const ids = new Set<string>();
  for (const id of diff?.created ?? []) ids.add(id);
  for (const mutation of diff?.mutated ?? []) ids.add(mutation.id);
  return ids;
};

const changedIndices = (id: string, diff: TraceDiff | undefined, current: HeapObject) => {
  const out = new Set<number>();
  const mutation = diff?.mutated.find((entry) => entry.id === id);
  if (diff?.created.includes(id)) return out;
  if (!mutation) return out;
  const before = mutation.before.items ?? [];
  const after = current.items ?? [];
  for (let index = 0; index < after.length; index += 1) {
    if (JSON.stringify(before[index]) !== JSON.stringify(after[index])) out.add(index);
  }
  return out;
};

const changedKeys = (id: string, diff: TraceDiff | undefined, current: HeapObject) => {
  const out = new Set<string>();
  const mutation = diff?.mutated.find((entry) => entry.id === id);
  if (!mutation) return out;
  for (const [key, value] of Object.entries(current.fields ?? {})) {
    if (JSON.stringify(mutation.before.fields?.[key]) !== JSON.stringify(value)) out.add(key);
  }
  return out;
};

const isPrimitiveList = (object: HeapObject | undefined, heap: Heap) =>
  Boolean(object?.items) && object!.items!.every((item) => !isRef(item, heap));

const isGrid = (object: HeapObject, heap: Heap) =>
  Boolean(object.items?.length) &&
  object.items!.every((item) => isRef(item, heap) && isPrimitiveList(heap[item], heap) && heap[item].type !== "set");

const isEdgePairList = (object: HeapObject, heap: Heap) =>
  Boolean(object.items?.length) &&
  object.items!.every((item) => {
    if (!isRef(item, heap)) return false;
    const inner = heap[item].items;
    return Boolean(inner && inner.length >= 2 && inner.length <= 3 && inner.every((v) => typeof v === "number"));
  });

// ------------------------------------------------------------ tree layout

/**
 * A trie laid out by prefix: depth is how many characters in you are, x runs
 * left to right across the leaves. Requires two levels before it claims the
 * shape, so a plain dict of single-letter keys is not mistaken for one.
 */
function layoutTrie(
  rootId: string,
  heap: Heap,
  changed: Set<string>,
  tagsFor: (id: string) => Tag[],
  attentionOn: (id: string) => Attention
): { nodes: TrieNodeModel[]; edges: TrieViewModel["edges"]; width: number; depth: number } | null {
  const nodes: TrieNodeModel[] = [];
  const edges: TrieViewModel["edges"] = [];
  const placed = new Set<string>();
  let cursor = 0;
  let deepest = 0;

  const walk = (id: string, char: string, depth: number): number => {
    if (placed.has(id) || depth > 12) return cursor;
    placed.add(id);
    deepest = Math.max(deepest, depth);

    const kids = trieChildren(id, heap).filter((kid) => !placed.has(kid.to));
    let x: number;
    if (kids.length === 0) {
      x = cursor;
      cursor += 1;
    } else {
      const spread = kids.map((kid) => {
        edges.push({ key: `${id}-${kid.char}-${kid.to}`, from: id, to: kid.to, char: kid.char });
        return walk(kid.to, kid.char, depth + 1);
      });
      x = (Math.min(...spread) + Math.max(...spread)) / 2;
    }

    nodes.push({
      id,
      char,
      x,
      depth,
      end: trieEnds(id, heap),
      changed: changed.has(id),
      tags: tagsFor(id),
      ...attentionOn(id)
    });
    return x;
  };

  walk(rootId, "", 0);
  if (deepest < 2) return null;
  return { nodes, edges, width: Math.max(cursor, 1), depth: deepest };
}

function layoutTrees(
  roots: Array<{ id: string; names: string[] }>,
  heap: Heap,
  changed: Set<string>,
  tagsFor: (id: string) => Tag[],
  attentionOn: (id: string) => Attention,
  visits: Map<string, number>
) {
  const nodes: TreeNodeModel[] = [];
  const edges: TreeViewModel["edges"] = [];
  const placed = new Set<string>();
  let cursor = 0;
  let maxDepth = 0;

  const walk = (id: string, depth: number) => {
    if (placed.has(id) || depth > 12) return;
    placed.add(id);
    const object = heap[id];
    const left = object.fields?.left;
    const right = object.fields?.right;
    if (isRef(left, heap) && isTreeNode(heap[left]) && !placed.has(left)) {
      walk(left, depth + 1);
      edges.push({ key: `${id}-L-${left}`, from: id, to: left, side: "left" });
    }
    nodes.push({
      id,
      label: nodeValue(object),
      x: cursor,
      depth,
      changed: changed.has(id),
      tags: tagsFor(id),
      visit: visits.get(id),
      meta: nodeMeta(object),
      ...attentionOn(id)
    });
    cursor += 1;
    maxDepth = Math.max(maxDepth, depth);
    if (isRef(right, heap) && isTreeNode(heap[right]) && !placed.has(right)) {
      walk(right, depth + 1);
      edges.push({ key: `${id}-R-${right}`, from: id, to: right, side: "right" });
    }
  };

  for (const root of roots) {
    if (placed.has(root.id)) continue;
    walk(root.id, 0);
    cursor += 1; // gap between separate trees
  }
  return { nodes, edges, width: Math.max(1, cursor - 1), depth: maxDepth };
}

// ---------------------------------------------------------------- caption

function describeValue(value: SerializedValue | undefined, heap: Heap): string {
  if (isRef(value, heap)) {
    const object = heap[value];
    if (isListNode(object) || isTreeNode(object)) return `node ${nodeValue(object)}`;
    return inlineLabel(value, heap);
  }
  return typeof value === "string" ? JSON.stringify(value) : formatPrimitive(value);
}

export function describeStep(
  trace: TraceStep[],
  diffs: TraceDiff[],
  index: number,
  names: Map<string, string>
): string {
  const step = trace[index];
  if (!step) return "";
  const heap = step.heap;
  const diff = diffs[index];
  const parts: string[] = [];

  for (const mutation of diff?.mutated ?? []) {
    const object = mutation.after;
    const label = names.get(mutation.id) ?? (isListNode(object) || isTreeNode(object) ? `node ${nodeValue(object)}` : object.type);
    if (object.items) {
      const before = mutation.before.items ?? [];
      const after = object.items;
      if (after.length > before.length && JSON.stringify(after.slice(0, before.length)) === JSON.stringify(before)) {
        parts.push(`${label} gained ${after.slice(before.length).map((item) => describeValue(item, heap)).join(", ")}`);
      } else if (after.length < before.length && JSON.stringify(before.slice(0, after.length)) === JSON.stringify(after)) {
        parts.push(`${label} lost ${before.slice(after.length).map((item) => describeValue(item, heap)).join(", ")}`);
      } else {
        const changedAt = after.findIndex((item, k) => JSON.stringify(item) !== JSON.stringify(before[k]));
        if (changedAt >= 0) parts.push(`${label}[${changedAt}] = ${describeValue(after[changedAt], heap)}`);
        else parts.push(`${label} changed`);
      }
      continue;
    }
    for (const field of mutation.fields) {
      if (field === "truncated" || field === "preview") continue;
      const value = object.fields?.[field];
      if (object.type === "dict" || /dict|map|counter/i.test(object.type)) {
        parts.push(value === undefined ? `${label} removed ${field}` : `${label}[${field}] = ${describeValue(value, heap)}`);
      } else {
        parts.push(`${label}.${field} → ${describeValue(value, heap)}`);
      }
    }
  }

  const created = (diff?.created ?? []).filter((id) => isListNode(heap[id]) || isTreeNode(heap[id]));
  if (index > 0 && created.length) {
    parts.push(created.length === 1 ? `new node ${nodeValue(heap[created[0]])}` : `${created.length} new nodes`);
  }

  for (const [name, change] of Object.entries(diff?.variablesChanged ?? {})) {
    if (change.after === undefined) continue;
    parts.push(`${name} = ${describeValue(change.after, heap)}`);
  }

  if (index === 0) {
    return `Called with ${Object.entries(step.variables)
      .slice(0, 3)
      .map(([name, value]) => `${name} = ${describeValue(value, heap)}`)
      .join(", ") || "no arguments"}.`;
  }

  const ran = trace[index - 1].line;
  const prefix = step.event === "exception" ? `Line ${step.line} raised an error` : `Line ${ran} ran`;
  if (!parts.length) return `${prefix}.`;
  const shown = parts.slice(0, 3).join(", ");
  const more = parts.length > 3 ? `, +${parts.length - 3} more` : "";
  return `${prefix}: ${shown}${more}.`;
}

// --------------------------------------------------------------- builder

interface BuildInput {
  trace: TraceStep[];
  diffs: TraceDiff[];
  index: number;
  slots: ListSlots;
  roles?: ArrayRoles;
  /** Functions whose empty return means a path was abandoned. */
  failing?: Set<string>;
  /** Traversal position per tree node, decided across the whole trace. */
  visits?: Map<string, number>;
  /** Cells each grid is read at once it has stopped being filled. */
  trails?: GridTrails;
  /** Integers the program works on bit by bit, and how wide to draw them. */
  bits?: BitPlan;
  /** The whole call tree, so the explored branches persist as the replay runs. */
  calls?: CallTree | null;
  /** Edges accepted and turned down, accumulated across the whole trace. */
  verdicts?: EdgeVerdicts;
  /** The cell each row is being partitioned around. */
  pivots?: Pivots;
  /** Which collections are ranges, and the axis they share. */
  timeline?: TimelinePlan | null;
  /** Which arrays are running totals of which others. */
  sums?: PrefixSums;
  /** One row being tried against another, and where it sits. */
  alignment?: Alignment | null;
  /** The program being replayed, read to find what the current line compares. */
  source?: string;
  signature?: ProblemSignature;
}

export function buildStepModel({ trace, diffs, index, slots, roles, failing, visits, trails, bits, calls, verdicts, pivots, timeline, sums, alignment, source, signature }: BuildInput): StepModel {
  const step = trace[index];
  if (!step) return { views: [], variables: [], frames: [], caption: "", flows: [] };
  const heap = step.heap;

  // Lets an index expression read through another array, as DP routinely does.
  const cellLookup = (name: string, at: number): number | undefined => {
    const target = step.variables[name];
    if (!isRef(target, heap)) return undefined;
    const item = heap[target].items?.[at];
    return typeof item === "number" && Number.isInteger(item) ? item : undefined;
  };
  /** So `stack[-1]` means the top rather than nothing. */
  const cellLength = (name: string): number | undefined => {
    const target = step.variables[name];
    return isRef(target, heap) ? heap[target].items?.length : undefined;
  };
  const touched = lineCells(source, step.line, step.variables, cellLookup, cellLength);
  const sourceLine = source?.split("\n")[step.line - 1];
  /** Plain `arr[i]` references, for the one-dimensional views. */
  const flat = (refs: CellRef[] | undefined) =>
    new Set((refs ?? []).filter((ref) => ref.col === undefined).map((ref) => ref.row));
  /** `grid[i][j]` references, for the two-dimensional ones. */
  const square = (refs: CellRef[] | undefined) =>
    (refs ?? []).filter((ref): ref is GridCell => ref.col !== undefined);

  const diff = diffs[index];
  const changed = changedIds(diff);
  const changedVars = new Set(Object.keys(diff?.variablesChanged ?? {}));
  const kindByName = new Map((signature?.parameters ?? []).map((parameter) => [parameter.name, parameter.kind]));
  const views: ViewModel[] = [];
  const shown = new Set<string>();
  const names = new Map<string, string>();

  // Variables of every frame, innermost first; outer-frame names get a prefix.
  const scopes: Array<{ prefix: string; variables: Record<string, SerializedValue> }> = [
    { prefix: "", variables: step.variables }
  ];
  const stack = step.stack ?? [];
  for (let k = stack.length - 2; k >= 0; k -= 1) {
    scopes.push({ prefix: `${stack[k].function}·`, variables: stack[k].variables });
  }

  // Which variables point at each object.
  const pointers = new Map<string, Tag[]>();
  for (const [name, value] of Object.entries(step.variables)) {
    if (isRef(value, heap)) {
      const list = pointers.get(value) ?? [];
      list.push({ name, changed: changedVars.has(name) });
      pointers.set(value, list);
      if (!names.has(value)) names.set(value, name);
    }
  }
  const tagsFor = (id: string) => pointers.get(id) ?? [];
  /** What a heap object held a step ago, for tables mutated in place. */
  const priorItems = (id: string) => diff?.mutated.find((entry) => entry.id === id)?.before.items;

  /**
   * How the current line is treating a drawn object. A node is named, never
   * indexed — `if a.val <= b.val` weighs two list nodes — so the figure lights
   * up through the variables pointing at it rather than through a subscript.
   */
  const attentionOn = (id: string): Attention => {
    const named = (tagsFor(id) as Tag[]).map((tag) => tag.name);
    if (named.some((name) => touched.compared.names.has(name))) return { comparing: true };
    if (named.some((name) => touched.read.names.has(name))) return { reading: true };
    return {};
  };

  const intVariables = Object.entries(step.variables).filter(
    ([name, value]) => typeof value === "number" && Number.isInteger(value) && isIndexName(name)
  ) as Array<[string, number]>;

  // --- linked lists: one view for every list node on the heap -------------
  const listIds = Object.keys(heap).filter((id) => isListNode(heap[id]));
  if (listIds.length) {
    const nodes: ListNodeModel[] = [];
    const edges: ListEdgeModel[] = [];
    let rows = 0;
    let cols = 0;
    // Rows only count if a live node sits in them.
    const liveRows = [...new Set(listIds.map((id) => slots.get(id)?.row ?? 0))].sort((a, b) => a - b);
    const rowIndex = new Map(liveRows.map((row, k) => [row, k]));
    for (const id of listIds) {
      const slot = slots.get(id) ?? { row: 0, col: 0 };
      const row = rowIndex.get(slot.row) ?? 0;
      rows = Math.max(rows, row + 1);
      cols = Math.max(cols, slot.col + 1);
      nodes.push({
        id,
        label: nodeValue(heap[id]),
        row,
        col: slot.col,
        changed: changed.has(id),
        tags: tagsFor(id),
        ...attentionOn(id)
      });
      shown.add(id);
      for (const field of LIST_LINKS) {
        const fields = heap[id].fields ?? {};
        if (!(field in fields)) continue;
        const target = fields[field];
        const to = isRef(target, heap) ? target : null;
        if (field !== "next" && to === null) continue;
        const mutation = diff?.mutated.find((entry) => entry.id === id);
        edges.push({
          key: `${id}:${field}:${to ?? "null"}`,
          from: id,
          to,
          field: field as ListEdgeModel["field"],
          changed: Boolean(mutation?.fields.includes(field)) || diff?.created.includes(id) === true
        });
      }
    }
    const title =
      [...new Set(nodes.flatMap((node) => node.tags.map((tag) => tag.name)))].slice(0, 3).join(", ") || "linked list";
    views.push({ kind: "list", key: "lists", title, nodes, edges, rows, cols });
  }

  // --- trees ---------------------------------------------------------------
  const treeIds = Object.keys(heap).filter((id) => isTreeNode(heap[id]));
  if (treeIds.length) {
    const children = new Set<string>();
    for (const id of treeIds) {
      for (const side of ["left", "right"]) {
        const child = heap[id].fields?.[side];
        if (isRef(child, heap)) children.add(child);
      }
    }
    const roots = treeIds
      .filter((id) => !children.has(id))
      .map((id) => ({ id, names: tagsFor(id).map((tag) => tag.name) }));
    // Detached subtrees still count; a cycle with no root falls back to any node.
    if (!roots.length) roots.push({ id: treeIds[0], names: [] });
    const layout = layoutTrees(roots, heap, changed, tagsFor, attentionOn, visits ?? new Map());
    for (const node of layout.nodes) shown.add(node.id);
    views.push({
      kind: "tree",
      key: "trees",
      title: roots.flatMap((root) => root.names).slice(0, 3).join(", ") || "tree",
      nodes: layout.nodes,
      edges: layout.edges,
      width: layout.width,
      depth: layout.depth
    });
  }

  // --- containers and objects, in variable order ---------------------------
  const describeContainer = (id: string, title: string) => {
    if (shown.has(id)) return;
    const object = heap[id];
    if (!object || isListNode(object) || isTreeNode(object)) return;
    shown.add(id);
    const baseName = title.split(".").pop()?.split("·").pop() ?? title;
    const paramKind = kindByName.get(baseName);

    // Claimed before the dict branch: a trie is a dict, and rendering it as a
    // table of keys loses the one thing that makes it a trie.
    if (!object.items) {
      const trie = layoutTrie(id, heap, changed, tagsFor, attentionOn);
      if (trie) {
        for (const node of trie.nodes) shown.add(node.id);
        views.push({
          kind: "trie",
          key: id,
          title,
          nodes: trie.nodes,
          edges: trie.edges,
          width: trie.width,
          depth: trie.depth
        });
        return;
      }
    }

    if (object.items) {
      if (paramKind === "graph" || GRAPH_NAMES.test(baseName)) {
        const graph = buildGraph(id, title, object, heap, step.variables, priorItems, verdicts?.[index]);
        if (graph) {
          views.push(graph);
          return;
        }
      }
      if (/^edges$/i.test(baseName) && isEdgePairList(object, heap)) {
        const graph = buildEdgeGraph(id, title, object, heap, step.variables, priorItems, verdicts?.[index]);
        if (graph) {
          views.push(graph);
          for (const item of object.items) if (isRef(item, heap)) shown.add(item);
          return;
        }
      }
      if (timeline?.ids.has(id)) {
        const rows = intervalRows(object, heap);
        if (rows) {
          const verdict = verdicts?.[index];
          const taken = new Set((verdict?.chosen ?? []).map((tuple) => tuple.join(",")));
          const weighed = new Set((verdict?.weighed ?? []).map((tuple) => tuple.join(",")));
          views.push({
            kind: "timeline",
            key: id,
            title,
            from: timeline.from,
            to: timeline.to,
            bars: rows.map((row, at) => {
              const held = object.items![at] as string;
              const name = row.join(",");
              return {
                key: `${held}#${at}`,
                start: row[0],
                end: row[1],
                changed: changed.has(held) || changedIndices(id, diff, object).has(at),
                verdict: taken.has(name) ? "taken" : weighed.has(name) ? "passed" : "idle",
                active: tagsFor(held).length > 0
              };
            })
          });
          for (const item of object.items!) if (isRef(item, heap)) shown.add(item);
          return;
        }
      }

      if (isGrid(object, heap) && object.type !== "set") {
        const rowsChanged = changedIndices(id, diff, object);
        const at = (refs: GridCell[]) => new Set(refs.map((cell) => `${cell.row}:${cell.col}`));
        const weighedHere = at(square(touched.compared.cells.get(baseName)));
        const lookedHere = at(square(touched.read.cells.get(baseName)));
        const rows = object.items.map((item, rowIndex) => {
          const inner = heap[item as string];
          shown.add(item as string);
          const cells = changedIndices(item as string, diff, inner);
          return (inner.items ?? []).map((cell, colIndex) => ({
            key: `${rowIndex}:${colIndex}`,
            label: formatCell(cell),
            changed: cells.has(colIndex) || rowsChanged.has(rowIndex),
            comparing: weighedHere.has(`${rowIndex}:${colIndex}`),
            reading: lookedHere.has(`${rowIndex}:${colIndex}`)
          }));
        });
        const ints = new Map(intVariables);
        const highlights: GridViewModel["highlights"] = [];
        const pairs: Array<[string, string]> = [["i", "j"], ["r", "c"], ["row", "col"], ["x", "y"], ["nr", "nc"], ["ni", "nj"]];
        for (const [a, b] of pairs) {
          const ri = ints.get(a) ?? (step.variables[a] as number | undefined);
          const ci = ints.get(b) ?? (step.variables[b] as number | undefined);
          if (typeof ri === "number" && typeof ci === "number" && rows[ri]?.[ci]) {
            highlights.push({ row: ri, col: ci, names: [`${a},${b}`] });
          }
        }
        const rowPointers = highlights.length
          ? []
          : intVariables
              .filter(([, value]) => value >= 0 && value < rows.length)
              .slice(0, 3)
              .map(([name, value]) => ({ name, index: value, changed: changedVars.has(name) }));
        // What this line is about to read, and where it is about to put it.
        // Without the link a DP table is just cells turning blue in some order.
        const inGrid = (cell: GridCell) => rows[cell.row]?.[cell.col] !== undefined;
        const target = square(touched.written.cells.get(baseName)).filter(inGrid);
        const sources = square(touched.read.cells.get(baseName))
          .filter(inGrid)
          .filter((cell) => cell.row !== target[0]?.row || cell.col !== target[0]?.col);
        const dependency = target.length === 1 && sources.length ? { from: sources, to: target[0] } : undefined;

        const walked = (trails?.get(id) ?? [])
          .filter((entry) => entry.step <= index)
          .flatMap((entry) => entry.cells)
          .filter(inGrid);
        const trail: GridCell[] = [];
        for (const cell of walked) {
          if (!trail.some((seen) => seen.row === cell.row && seen.col === cell.col)) trail.push(cell);
        }

        views.push({
          kind: "grid",
          key: id,
          title,
          rows,
          highlights,
          rowPointers,
          dependency,
          trail: trail.length > 1 ? trail : undefined
        });
        return;
      }

      const variant: ArrayVariant =
        object.type === "set"
          ? "set"
          : object.type === "stack" || STACK_NAMES.test(baseName)
            ? "stack"
            : object.type === "heap" || HEAP_NAMES.test(baseName) || roles?.heapShaped.has(id) === true
              ? "heap"
              : object.type === "queue" || object.type === "deque" || QUEUE_NAMES.test(baseName)
                ? object.type === "deque" && !QUEUE_NAMES.test(baseName) ? "deque" : "queue"
                : object.type === "tuple"
                  ? "tuple"
                  : "list";
      const cellChanges = changedIndices(id, diff, object);
      const permuting = roles?.permuting.has(id) === true;
      const rolling = roles?.rolling.has(id) === true;
      const before = rolling ? diff?.mutated.find((entry) => entry.id === id)?.before.items : undefined;
      const weighed = flat(touched.compared.cells.get(baseName));
      const looked = flat(touched.read.cells.get(baseName));
      // The nth occurrence of a value keeps its identity as the array reorders.
      const occurrences = new Map<string, number>();
      const cells = object.items.map((item, k) => {
        let key = String(k);
        if (permuting) {
          const value = JSON.stringify(item);
          const nth = occurrences.get(value) ?? 0;
          occurrences.set(value, nth + 1);
          key = `v${value}#${nth}`;
        }
        return {
          key,
          label: isRef(item, heap) ? inlineLabel(item, heap, 1) : formatCell(item),
          changed: cellChanges.has(k),
          comparing: weighed.has(k),
          reading: looked.has(k),
          previous: cellChanges.has(k) && before?.[k] !== undefined ? formatCell(before[k]) : undefined,
          ref: isRef(item, heap)
        };
      });
      for (const item of object.items) {
        if (isRef(item, heap) && !isListNode(heap[item]) && !isTreeNode(heap[item])) shown.add(item);
      }
      const indexed = variant === "list" || variant === "tuple";

      /**
       * A range query, shown on the array it is actually asking about.
       *
       * Two cells of a running total named on one line is the whole of
       * `sum(a[i..j])` in a prefix-sum solution. The subtraction happens in
       * the totals; the meaning belongs on the row underneath.
       */
      let sumSpan: ArrayViewModel["sumSpan"];
      for (const [totalsId, relation] of sums ?? []) {
        if (relation.source !== id) continue;
        const totals = heap[totalsId]?.items;
        if (!totals) continue;
        const asked = new Set<number>();
        for (const totalsName of (pointers.get(totalsId) ?? []).map((tag) => tag.name)) {
          for (const side of [touched.read, touched.compared]) {
            for (const ref of side.cells.get(totalsName) ?? []) {
              if (ref.col === undefined && ref.row >= 0 && ref.row < totals.length) asked.add(ref.row);
            }
          }
        }
        if (asked.size !== 2) continue;
        const [low, high] = [...asked].sort((a, b) => a - b);
        const from = relation.offset === 1 ? low : low + 1;
        const to = relation.offset === 1 ? high - 1 : high;
        const total = (totals[high] as number) - (totals[low] as number);
        if (from <= to) sumSpan = { from, to, total: formatPrimitive(total) };
        break;
      }

      /**
       * How far the partition has got.
       *
       * Read off the values rather than off a boundary variable, which would
       * mean guessing which of `i`, `lo` and `store` is the one that matters.
       * Everything between the window's start and the cursor has been weighed
       * against the pivot already, and in a partition that stretch is sorted
       * into a low run and a high one — so the divider is where the low run
       * ends.
       */
      const items = object.items;
      const pivot = pivots?.[index]?.get(id);
      const pivotValue = pivot === undefined ? undefined : items[pivot];
      let divider: number | undefined;
      if (pivot !== undefined && typeof pivotValue === "number") {
        const marks = intVariables
          .filter(([, value]) => value >= 0 && value <= items.length)
          .map(([name, value]) => ({ name, index: value, changed: false }));
        const from = windowSpan(marks, items.length)?.from ?? 0;
        const cursor = Math.max(-1, ...[...weighed].filter((k) => k !== pivot));
        if (cursor >= from) {
          let low = from;
          const value = (k: number) => items[k];
          while (low <= cursor && typeof value(low) === "number" && (value(low) as number) <= pivotValue) {
            low += 1;
          }
          divider = low;
        }
      }
      const pointersHere = indexed
        ? intVariables
            .filter(([, value]) => value >= 0 && value <= cells.length)
            .map(([name, value]) => ({ name, index: value, changed: changedVars.has(name) }))
        : [];
      views.push({
        kind: "array",
        key: id,
        title,
        variant,
        cells,
        truncated: object.truncated ?? 0,
        pointers: pointersHere,
        changed: changed.has(id),
        permuting,
        window: indexed ? windowSpan(pointersHere, cells.length) : undefined,
        forest: indexed ? asForest(object.items, baseName) : undefined,
        // Only a sort has a settled region; a rewritten array has no such claim.
        settled: roles?.sorting.has(id) ? settledRegions(object.items) : undefined,
        pivot,
        divider,
        sumSpan,
        merged: variant === "stack" ? operandMerge(id, trace, index, heap, source) : undefined,
        aligned:
          alignment?.pattern === id
            ? { offset: alignment.offsets[index] ?? 0, matched: alignment.matched[index] ?? 0 }
            : undefined
      });
      return;
    }

    if (object.fields) {
      const isMap = object.type === "dict" || /dict|map|counter/i.test(object.type);
      if (isMap) {
        const keys = changedKeys(id, diff, object);
        views.push({
          kind: "map",
          key: id,
          title,
          typeName: object.type,
          entries: Object.entries(object.fields).map(([key, value]) => ({
            key,
            value: inlineLabel(value, heap),
            changed: keys.has(key)
          })),
          truncated: object.truncated ?? 0
        });
        return;
      }
      const keys = changedKeys(id, diff, object);
      views.push({
        kind: "object",
        key: id,
        title,
        typeName: object.type,
        fields: Object.entries(object.fields).map(([name, value]) => ({
          name,
          value: isRef(value, heap) ? `→ ${title}.${name}` : describeValue(value, heap),
          changed: keys.has(name)
        }))
      });
      for (const [field, value] of Object.entries(object.fields)) {
        if (isRef(value, heap)) describeContainer(value, `${title}.${field}`);
      }
    }
  };

  for (const scope of scopes) {
    for (const [name, value] of Object.entries(scope.variables)) {
      if (isRef(value, heap)) describeContainer(value, `${scope.prefix}${name}`);
    }
  }

  // --- the branches recursion has explored so far --------------------------
  if (calls) {
    const seen = calls.nodes.filter((node) => node.from <= index);
    if (seen.length > 2) {
      const onStack = seen.filter((node) => node.to > index);
      views.push({
        kind: "calls",
        key: "calls",
        title: "calls",
        nodes: seen,
        width: calls.width,
        depth: calls.depth,
        activeId: onStack.length ? onStack[onStack.length - 1].id : null
      });
    }
  }

  // --- integers a program works on bit by bit ------------------------------
  if (bits && bits.names.size > 0) {
    const rows: BitRowModel[] = [];
    for (const name of bits.names) {
      const value = step.variables[name];
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0) continue;

      const before = diff?.variablesChanged[name]?.before;
      const was = typeof before === "number" && before >= 0 ? before : value;
      rows.push({
        name,
        value,
        bits: Array.from({ length: bits.width }, (_, column) => {
          const place = bits.width - 1 - column;
          const on = ((value >> place) & 1) === 1;
          return { on, flipped: on !== (((was >> place) & 1) === 1) };
        }),
        changed: changedVars.has(name),
        comparing:
          touched.compared.names.has(name) ||
          (touched.read.names.has(name) && BITWISE.test(sourceLine ?? ""))
      });
    }

    if (rows.length) {
      views.push({ kind: "bits", key: "bits", title: "bits", width: bits.width, rows });
    }
  }

  // Strings worth spelling out: string parameters, or strings an index points into.
  for (const [name, value] of Object.entries(step.variables)) {
    if (typeof value !== "string" || value in heap || value.length === 0 || value.length > 48) continue;
    const pointersHere = intVariables
      .filter(([, index]) => index >= 0 && index <= value.length)
      .map(([pointer, index]) => ({ name: pointer, index, changed: changedVars.has(pointer) }));
    const textLike = /^(s|t|s1|s2|str|text|word|pattern|pat|needle|haystack|sentence|expr|expression|num|digits|path|a|b)$/i.test(name);
    if (kindByName.get(name) !== "string" && !(textLike && pointersHere.length)) continue;
    const before = trace[index - 1]?.variables[name];
    views.push({
      kind: "array",
      key: `str:${name}`,
      title: name,
      variant: "string",
      cells: [...value].map((char, k) => ({
        key: String(k),
        label: char,
        changed: typeof before === "string" && before[k] !== char,
        comparing: flat(touched.compared.cells.get(name)).has(k),
        reading: flat(touched.read.cells.get(name)).has(k)
      })),
      truncated: 0,
      pointers: pointersHere,
      changed: changedVars.has(name),
      window: windowSpan(pointersHere, value.length)
    });
  }

  const variables: VariableChip[] = Object.entries(step.variables)
    .filter(([, value]) => !isRef(value, heap))
    .map(([name, value]) => ({
      name,
      value: typeof value === "string" ? JSON.stringify(value) : formatPrimitive(value),
      changed: changedVars.has(name),
      isNone: value === null
    }));

  const frames: FrameModel[] = stack.map((frame, depth) => {
    const handingBack = step.event === "return" && depth === stack.length - 1;
    return {
      function: frame.function,
      line: frame.line,
      args: Object.entries(frame.variables)
        .slice(0, 3)
        .map(([name, value]) => `${name}=${describeValue(value, heap)}`)
        .join(", "),
      returning: handingBack
        ? {
            value: describeValue(step.returns ?? null, heap),
            deadEnd:
              step.returns === false ||
              ((step.returns === null || step.returns === undefined) && failing?.has(frame.function) === true)
          }
        : undefined
    };
  });

  return {
    views,
    variables,
    frames,
    caption: describeStep(trace, diffs, index, names),
    flows: [
      ...crossRowFlows(views, trace, index, heap, diff, source),
      ...stackEvictions(views, trace, index, heap, touched, pointers)
    ]
  };
}

/**
 * Where a value that just landed in one row was read from in another.
 *
 * Both ends have to agree: something grew by one (or the line wrote a cell),
 * and some other row was read at a position holding exactly that value on the
 * line that just ran. Requiring the read keeps an ordinary coincidence — two
 * rows that happen to share a number — from drawing a connector between them.
 *
 * Rows of a grid count on both sides, because a bucket sort writes its
 * buckets as a list of lists and that draws as a table, not as five rows.
 */
function crossRowFlows(
  views: ViewModel[],
  trace: TraceStep[],
  index: number,
  heap: Heap,
  diff: TraceDiff | undefined,
  source: string | undefined
): Flow[] {
  // The line that did it has already run: a row grows between the step that
  // reads a cell and the step that shows the result, and the connector belongs
  // with the arrival, beside the new cell it explains.
  const cause = trace[index - 1];
  if (!cause) return [];

  const kindOf = new Map(views.map((view) => [view.key, view.kind]));
  const itemsOf = (id: string | undefined) =>
    id !== undefined && heap[id]?.items ? heap[id].items! : undefined;
  const grewBy = (id: string) => {
    const before = diff?.mutated.find((entry) => entry.id === id)?.before.items;
    const after = itemsOf(id);
    if (!before || !after || after.length !== before.length + 1) return undefined;
    for (let k = 0; k < before.length; k += 1) if (before[k] !== after[k]) return k;
    return before.length;
  };

  const touched = lineCells(
    source,
    cause.line,
    cause.variables,
    (name, at) => {
      const target = cause.variables[name];
      if (!isRef(target, cause.heap)) return undefined;
      const item = cause.heap[target].items?.[at];
      return typeof item === "number" && Number.isInteger(item) ? item : undefined;
    },
    (name) => {
      const target = cause.variables[name];
      return isRef(target, cause.heap) ? cause.heap[target].items?.length : undefined;
    }
  );

  /** Where a value arrived this step, as a handle the rendered cell carries. */
  const targets: Array<{ handle: string; owner: string; value: SerializedValue }> = [];
  for (const view of views) {
    const items = itemsOf(view.key);
    if (!items) continue;
    if (view.kind === "array") {
      const at = grewBy(view.key) ?? writtenCell(touched, view.key, cause, heap);
      if (at !== undefined && items[at] !== undefined) {
        targets.push({ handle: `${view.key}:${at}`, owner: view.key, value: items[at] });
      }
    } else if (view.kind === "grid") {
      items.forEach((rowId, row) => {
        if (!isRef(rowId, heap)) return;
        const at = grewBy(rowId);
        const cells = itemsOf(rowId);
        if (at !== undefined && cells?.[at] !== undefined) {
          targets.push({ handle: `${view.key}:${row}:${at}`, owner: view.key, value: cells[at] });
        }
      });
      // A table need not grow to receive: `b[r][c] = a[r][c]` fills a slot
      // that was already there.
      for (const [name, refs] of touched.written.cells) {
        if (cause.variables[name] !== view.key) continue;
        for (const ref of refs) {
          if (ref.col === undefined) continue;
          const cells = itemsOf(items[ref.row] as string);
          if (cells?.[ref.col] === undefined) continue;
          targets.push({
            handle: `${view.key}:${ref.row}:${ref.col}`,
            owner: view.key,
            value: cells[ref.col]
          });
        }
      }
    }
  }
  if (targets.length === 0) return [];

  /** Every cell the causing line looked at, as the same kind of handle. */
  const sources: Array<{ handle: string; owner: string; value: SerializedValue }> = [];
  for (const side of [touched.read, touched.compared]) {
    for (const [name, refs] of side.cells) {
      const id = cause.variables[name];
      if (!isRef(id, heap) || !kindOf.has(id)) continue;
      const items = itemsOf(id);
      if (!items) continue;
      for (const ref of refs) {
        if (ref.col === undefined) {
          if (kindOf.get(id) !== "array" || items[ref.row] === undefined) continue;
          sources.push({ handle: `${id}:${ref.row}`, owner: id, value: items[ref.row] });
        } else {
          const cells = itemsOf(items[ref.row] as string);
          if (kindOf.get(id) !== "grid" || cells?.[ref.col] === undefined) continue;
          sources.push({ handle: `${id}:${ref.row}:${ref.col}`, owner: id, value: cells[ref.col] });
        }
      }
    }
  }

  const flows: Flow[] = [];
  for (const target of targets) {
    const from = sources.find(
      (candidate) => candidate.owner !== target.owner && candidate.value === target.value
    );
    if (from) {
      flows.push({ key: `${from.handle}>${target.handle}`, from: from.handle, to: target.handle, kind: "copy" });
    }
  }
  return flows;
}

/**
 * Which element is turning another out of a stack.
 *
 * A monotonic stack pops on a comparison, and the line that does it names
 * both sides: `heights[stack[-1]] < heights[i]` weighs the element on top
 * against the one arriving. Which of the two is arriving is not a guess —
 * the stack says what is on top of it, so the other one is the newcomer.
 *
 * Confirmed by looking ahead. A comparison that does not actually pop
 * anything is just a comparison, and claiming an eviction for it would be
 * inventing the very thing this is supposed to show. The pop happens in the
 * loop body rather than on the condition line, so the test is what the stack
 * does next: shrink, and the condition held; grow, and it did not.
 */
function stackEvictions(
  views: ViewModel[],
  trace: TraceStep[],
  index: number,
  heap: Heap,
  touched: LineCells,
  pointers: Map<string, Tag[]>
): Flow[] {
  const out: Flow[] = [];
  for (const view of views) {
    if (view.kind !== "array" || view.variant !== "stack") continue;
    const now = heap[view.key]?.items;
    if (!now || now.length === 0) continue;

    // The next thing that happens to this stack, within a few steps — long
    // enough to cross the body of the loop, short enough that a pop much
    // later is not mistaken for this comparison's doing.
    let pops = false;
    for (let ahead = index + 1; ahead < Math.min(trace.length, index + 8); ahead += 1) {
      const later = trace[ahead].heap[view.key]?.items;
      if (!later || later.length === now.length) continue;
      pops = later.length < now.length;
      break;
    }
    if (!pops) continue;
    const top = now[now.length - 1];

    // Every cell the line weighs, the stack's own included: `stack[-1] < a[i]`
    // puts one end of the comparison inside the stack.
    const weighed: Array<{ owner: string; handle: string; row: number; value: SerializedValue }> = [];
    for (const other of views) {
      if (other.kind !== "array") continue;
      const items = heap[other.key]?.items;
      if (!items) continue;
      for (const name of (pointers.get(other.key) ?? []).map((tag) => tag.name)) {
        for (const ref of touched.compared.cells.get(name) ?? []) {
          if (ref.col === undefined && items[ref.row] !== undefined) {
            const handle = `${other.key}:${ref.row}`;
            if (!weighed.some((cell) => cell.handle === handle)) {
              weighed.push({ owner: other.key, handle, row: ref.row, value: items[ref.row] });
            }
          }
        }
      }
    }
    // `heights[stack[-1]] < heights[i]` names three cells, not two: the row
    // cell the stack stands on, the stack slot naming it, and the newcomer.
    // Everything that is the element already on the stack is set aside, and
    // whatever is left over is what arrived.
    const onTop = weighed.find((cell) => cell.owner === view.key && cell.row === now.length - 1);
    const stoodOn = weighed.find((cell) => cell.owner !== view.key && cell.row === top);

    // A stack of values whose top happens to be a valid position looks, for
    // one step, exactly like a stack of positions. Rather than guess, take
    // whichever reading leaves exactly one cell over — that one is the
    // newcomer, and a reading that leaves none or two has not understood the
    // line. The row cell is preferred as the loser: it is easier to see among
    // its neighbours than as an index sitting in a stack.
    const readings = [
      { standing: [onTop, stoodOn].filter(Boolean), victim: stoodOn ?? onTop },
      { standing: [onTop].filter(Boolean), victim: onTop },
      { standing: [stoodOn].filter(Boolean), victim: stoodOn }
    ];
    const reading = readings.find(
      (option) =>
        option.standing.length > 0 &&
        weighed.filter((cell) => !option.standing.includes(cell)).length === 1
    );
    if (!reading) continue;

    const trigger = weighed.find((cell) => !reading.standing.includes(cell))!;
    const victim = reading.victim!;
    out.push({
      key: `evicts:${trigger.handle}>${victim.handle}`,
      from: trigger.handle,
      to: victim.handle,
      kind: "evicts"
    });
  }
  return out;
}

/**
 * Two operands becoming one result.
 *
 * Evaluating an expression is a stack losing its top two and gaining a single
 * value, and the three steps that do it — pop, pop, push — say nothing on
 * their own; each is an ordinary stack move. Seen across the window they span,
 * the arithmetic is plain: whatever the stack held two deep is gone and one
 * thing stands where both were.
 *
 * Which operator did it comes from the line that pushed, not from the values,
 * because `2 + 2` and `2 * 2` leave the same trace.
 */
function operandMerge(
  id: string,
  trace: TraceStep[],
  index: number,
  heap: Heap,
  source: string | undefined
): ArrayViewModel["merged"] {
  const now = heap[id]?.items;
  const before = trace[index - 1]?.heap[id]?.items;
  if (!now || !before || now.length !== before.length + 1) return undefined;

  // Back far enough to cross both pops, and no further.
  for (let back = index - 2; back >= 0 && back >= index - 7; back -= 1) {
    const then = trace[back].heap[id]?.items;
    if (!then || then.length !== now.length + 1) continue;
    const kept = now.length - 1;
    for (let at = 0; at < kept; at += 1) if (then[at] !== now[at]) return undefined;

    const line = source?.split("\n")[(trace[index - 1].line ?? 0) - 1] ?? "";
    const operator = /\/\/|[-+*/%]/.exec(line.replace(/^[^=]*=/, ""))?.[0] ?? "?";
    return {
      left: formatCell(then[kept]),
      right: formatCell(then[kept + 1]),
      op: operator
    };
  }
  return undefined;
}

/** The cell of `id` that the line assigned to, if it named one. */
function writtenCell(touched: LineCells, id: string, cause: TraceStep, heap: Heap) {
  for (const [name, refs] of touched.written.cells) {
    if (cause.variables[name] !== id) continue;
    const at = refs.find((ref) => ref.col === undefined)?.row;
    if (at !== undefined && at < (heap[id]?.items?.length ?? 0)) return at;
  }
  return undefined;
}

const formatCell = (value: SerializedValue | undefined) =>
  typeof value === "string" && value.length !== 1 ? JSON.stringify(value) : formatPrimitive(value);

function activeGraphNodes(variables: Record<string, SerializedValue>, count: number) {
  const byNode = new Map<number, string[]>();
  for (const [name, value] of Object.entries(variables)) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= count) continue;
    if (!/^(node|u|v|cur|curr|src|source|start|nei|neighbor|neighbour|nb|nxt|next_node|city|at|w|to|frm)$/i.test(name)) continue;
    byNode.set(value, [...(byNode.get(value) ?? []), name]);
  }
  return [...byNode.entries()].map(([node, names]) => ({ node, names }));
}

function buildGraph(
  id: string,
  title: string,
  object: HeapObject,
  heap: Heap,
  variables: Record<string, SerializedValue>,
  priorItems: (id: string) => SerializedValue[] | undefined = () => undefined,
  verdicts?: EdgeVerdicts[number]
): GraphViewModel | null {
  const count = object.items?.length ?? 0;
  if (!count || count > 40) return null;
  const adjacency: Array<Array<{ to: number; weight?: string }>> = [];
  for (const item of object.items!) {
    if (!isRef(item, heap)) return null;
    const inner = heap[item].items ?? [];
    const row: Array<{ to: number; weight?: string }> = [];
    for (const entry of inner) {
      if (typeof entry === "number") row.push({ to: entry });
      else if (isRef(entry, heap)) {
        const pair = heap[entry].items ?? [];
        if (typeof pair[0] === "number") row.push({ to: pair[0], weight: pair[1] === undefined ? undefined : formatPrimitive(pair[1]) });
      }
    }
    adjacency.push(row);
  }
  return graphFromAdjacency(id, title, adjacency, variables, heap, priorItems, verdicts);
}

function buildEdgeGraph(
  id: string,
  title: string,
  object: HeapObject,
  heap: Heap,
  variables: Record<string, SerializedValue>,
  priorItems: (id: string) => SerializedValue[] | undefined = () => undefined,
  verdicts?: EdgeVerdicts[number]
): GraphViewModel | null {
  const edges = object.items!.map((item) => heap[item as string].items as number[]);
  const nVar = variables.n ?? variables.V ?? variables.nodes;

  /**
   * Which two columns hold the endpoints.
   *
   * A weighted edge list is written either way round — `(u, v, w)` reads
   * naturally, `(w, u, v)` sorts by weight for free, and Kruskal wants the
   * second. Taking the first two columns on faith draws a different graph
   * from the one the program is working on. Node columns are dense and start
   * at zero; a weight column is neither, so the readings can be told apart.
   */
  const readings = edges.some((edge) => edge.length > 2) ? [0, 1] : [0];
  const score = (at: number) => {
    const ends = edges.flatMap((edge) => [edge[at], edge[at + 1]]);
    if (ends.some((end) => !Number.isInteger(end) || end < 0)) return -1;
    const span = Math.max(...ends) + 1;
    if (span > 40) return -1;
    if (typeof nVar === "number" && span > nVar) return -1;
    return new Set(ends).size / span;
  };
  const best = readings.reduce((a, b) => (score(b) > score(a) ? b : a), readings[0]);
  if (score(best) < 0) return null;

  const ends = edges.flatMap((edge) => [edge[best], edge[best + 1]]);
  const count = typeof nVar === "number" ? nVar : Math.max(-1, ...ends) + 1;
  if (count <= 0 || count > 40) return null;
  const weightAt = edges.some((edge) => edge.length > 2) ? (best === 0 ? 2 : 0) : -1;
  const adjacency: Array<Array<{ to: number; weight?: string }>> = Array.from({ length: count }, () => []);
  for (const edge of edges) {
    const from = edge[best];
    const to = edge[best + 1];
    if (from >= 0 && from < count && to >= 0 && to < count) {
      const weight = weightAt < 0 ? undefined : edge[weightAt];
      adjacency[from].push({ to, weight: weight === undefined ? undefined : String(weight) });
    }
  }
  const graph = graphFromAdjacency(id, title, adjacency, variables, heap, priorItems, verdicts);
  // Edge lists do not say whether they are directed; draw them as given.
  return graph;
}

function graphFromAdjacency(
  id: string,
  title: string,
  adjacency: Array<Array<{ to: number; weight?: string }>>,
  variables: Record<string, SerializedValue>,
  heap: Heap,
  priorItems: (id: string) => SerializedValue[] | undefined = () => undefined,
  verdicts?: EdgeVerdicts[number]
): GraphViewModel {
  const count = adjacency.length;
  const has = (from: number, to: number) => adjacency[from]?.some((edge) => edge.to === to) ?? false;
  const edges: GraphViewModel["edges"] = [];
  const done = new Set<string>();
  adjacency.forEach((row, from) => {
    for (const edge of row) {
      if (edge.to < 0 || edge.to >= count) continue;
      const undirected = has(edge.to, from);
      const key = undirected ? `${Math.min(from, edge.to)}-${Math.max(from, edge.to)}` : `${from}>${edge.to}`;
      if (done.has(key)) continue;
      done.add(key);
      edges.push({ key, from, to: edge.to, directed: !undirected, weight: edge.weight });
    }
  });
  const active = activeGraphNodes(variables, count);

  let frontier: number[] | undefined;
  let visited: number[] | undefined;
  let labels: GraphViewModel["labels"];
  for (const [name, value] of Object.entries(variables)) {
    if (!frontier && FRONTIER_NAMES.test(name)) frontier = nodeSetFrom(value, heap, count);
    if (!visited && VISITED_NAMES.test(name)) visited = nodeSetFrom(value, heap, count);
    if (!labels && LABEL_NAMES.test(name)) {
      labels = nodeLabelsFrom(value, heap, count, priorItems);
    }
  }

  // Two nodes named at once, with an edge between them, is the edge in play.
  let hotEdge: string | undefined;
  if (active.length === 2) {
    const [a, b] = active.map((entry) => entry.node);
    hotEdge = edges.find(
      (edge) => (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a)
    )?.key;
  }

  // A tuple names an edge by two of its numbers; the rest is the weight. Only
  // a pair the graph actually has can be the one meant, so try them all.
  const resolve = (tuple: number[]) => {
    for (let a = 0; a < tuple.length; a += 1) {
      for (let b = a + 1; b < tuple.length; b += 1) {
        const found = edges.find(
          (edge) =>
            (edge.from === tuple[a] && edge.to === tuple[b]) ||
            (edge.from === tuple[b] && edge.to === tuple[a])
        );
        if (found) return found.key;
      }
    }
    return undefined;
  };
  const keysOf = (tuples: number[][]) =>
    [...new Set(tuples.map(resolve).filter((key): key is string => key !== undefined))];
  const chosen = verdicts ? keysOf(verdicts.chosen) : [];
  const taken = new Set(chosen);
  const rejected = verdicts ? keysOf(verdicts.weighed).filter((key) => !taken.has(key)) : [];

  // Candidate scoping: with a search under way, an edge neither end of which
  // the search has reached is not in the running yet, and recedes. Silent when
  // nothing is tracking reach, so an ordinary graph is drawn evenly.
  const reached = new Set([...(visited ?? []), ...(frontier ?? [])]);
  const dormant =
    reached.size > 0 && reached.size < count
      ? edges.filter((edge) => !reached.has(edge.from) && !reached.has(edge.to)).map((edge) => edge.key)
      : [];

  return {
    kind: "graph",
    key: id,
    title,
    count,
    edges,
    active,
    components: componentsOf(count, edges),
    frontier,
    visited,
    labels,
    hotEdge,
    chosen: chosen.length ? chosen : undefined,
    rejected: rejected.length ? rejected : undefined,
    dormant: dormant.length ? dormant : undefined
  };
}

const FRONTIER_NAMES = /^(queue|q|dq|deque|bfs|frontier|stack|todo|pending|pq|heap)$/i;
const VISITED_NAMES = /^(visited|seen|done|explored|marked|used|vis|in_mst|inmst|in_tree|intree)$/i;
const LABEL_NAMES = /^(dist|distance|distances|cost|costs|depth|level|d)$/i;

/**
 * A collection read as a set of graph nodes.
 *
 * Held to the same bar as the union-find forest: the name has to fit *and*
 * every element has to be a node this graph actually has. Three shapes count —
 * plain indices, a boolean array positioned by node, and the `(distance, node)`
 * tuples a priority queue holds — because guessing wrong here would paint the
 * wavefront onto an unrelated list.
 */
const nodeSetFrom = (value: SerializedValue, heap: Heap, count: number): number[] | undefined => {
  if (!isRef(value, heap)) return undefined;
  const items = heap[value].items;
  if (!items || items.length === 0) return [];

  if (items.length === count && items.every((item) => typeof item === "boolean")) {
    return items.map((on, node) => (on ? node : -1)).filter((node) => node >= 0);
  }

  const nodes: number[] = [];
  for (const item of items) {
    if (typeof item === "number" && Number.isInteger(item) && item >= 0 && item < count) {
      nodes.push(item);
      continue;
    }
    if (isRef(item, heap)) {
      const pair = heap[item].items ?? [];
      const last = pair[pair.length - 1];
      if (typeof last === "number" && Number.isInteger(last) && last >= 0 && last < count) {
        nodes.push(last);
        continue;
      }
    }
    return undefined;
  }
  return nodes;
};

/**
 * A numeric array holding one figure per node.
 *
 * The previous values come from the heap diff, not from variable rebinding: a
 * distance table is mutated in place, so the name keeps pointing at the same
 * object and `variablesChanged` never fires for it.
 */
const nodeLabelsFrom = (
  value: SerializedValue,
  heap: Heap,
  count: number,
  priorItems: (id: string) => SerializedValue[] | undefined
) => {
  if (!isRef(value, heap)) return undefined;
  const items = heap[value].items;
  if (!items || items.length !== count || !items.every((item) => typeof item === "number")) return undefined;

  const prior = priorItems(value);

  return items.map((item, node) => {
    const previous = prior?.[node];
    return {
      value: formatPrimitive(item),
      previous:
        typeof previous === "number" && previous !== item ? formatPrimitive(previous) : undefined
    };
  });
};

/**
 * The cell a partition is pivoting on, step by step.
 *
 * `pivot = nums[hi]` lifts a value out of the row, and from then on the row
 * is being sorted around a cell that no longer looks any different from its
 * neighbours. Both halves of that are on the page already: the line says
 * which cell the value came from, and the lines that follow say the name is
 * being weighed against other cells of the same row. Neither needs to know
 * the algorithm is quicksort.
 */
export type Pivots = Array<Map<string, number>>;

export function buildPivots(trace: TraceStep[], source?: string): Pivots {
  const empty: Pivots = trace.map(() => new Map());
  if (!source) return empty;
  const lines = source.split("\n");
  // `name = arr[...]` and nothing else on the right: a value lifted out of a
  // row. Anything more involved is arithmetic, not a pivot.
  const lifts = new Map<number, { name: string; array: string }>();
  lines.forEach((text, at) => {
    const match = /^\s*(?:\w+\s+)?(\w+)\s*=\s*(\w+)\s*\[[^\[\]]*\]\s*;?\s*$/.exec(text);
    if (match) lifts.set(at + 1, { name: match[1], array: match[2] });
  });
  if (lifts.size === 0) return empty;

  // It is only a pivot if the row is later weighed against it.
  const weighs = (name: string, array: string) =>
    lines.some((text) => {
      if (!/[<>]=?|[!=]=/.test(text)) return false;
      return new RegExp(String.raw`\b${name}\b`).test(text) && new RegExp(String.raw`\b${array}\s*\[`).test(text);
    });

  const held = new Map<string, { array: string; index: number; value: SerializedValue }>();
  return trace.map((step) => {
    const heap = step.heap;
    const frames = [step.variables, ...(step.stack ?? []).map((frame) => frame.variables)];
    const find = (name: string) => frames.find((variables) => name in variables)?.[name];

    const lift = lifts.get(step.line ?? -1);
    if (lift && weighs(lift.name, lift.array)) {
      const lookup = (name: string, at: number): number | undefined => {
        const target = find(name);
        if (!isRef(target, heap)) return undefined;
        const item = heap[target].items?.[at];
        return typeof item === "number" && Number.isInteger(item) ? item : undefined;
      };
      const read = lineCells(source, step.line, step.variables, lookup, (name) => {
        const target = find(name);
        return isRef(target, heap) ? heap[target].items?.length : undefined;
      }).read.cells.get(lift.array);
      const at = read?.find((ref) => ref.col === undefined)?.row;
      const from = find(lift.array);
      if (at !== undefined && isRef(from, heap)) {
        const value = heap[from].items?.[at];
        if (value !== undefined) held.set(lift.name, { array: lift.array, index: at, value });
      }
    }

    const out = new Map<string, number>();
    for (const [name, spot] of held) {
      // The name must still be live, and the cell must still hold what was
      // lifted out of it. Quicksort's last act swaps the pivot into place and
      // insertion sort shifts over the slot it took its key from; in both
      // cases the old index stops meaning anything, and a mark left behind
      // would be pointing at somebody else's value.
      if (find(name) !== spot.value) continue;
      const id = find(spot.array);
      if (!isRef(id, heap)) continue;
      if (heap[id].items?.[spot.index] === spot.value) out.set(id, spot.index);
    }
    return out;
  });
}

/**
 * Which edges a run has taken, and which it has weighed and turned down.
 *
 * Kruskal's story is the rejections: an edge dropped for closing a cycle has
 * to stay on screen or the run reads as having simply picked five edges. Both
 * halves come out of the trace without knowing the algorithm.
 *
 * Taken: a list that began empty and grew edge-shaped entries. The input edge
 * list is full from the first step, so an accumulator can never be confused
 * with it. Weighed: an entry of that input list whose every number is held by
 * some variable at once — three numbers agreeing at the same moment is the
 * loop being on that edge, not a coincidence.
 *
 * Tuples, not edge keys: the numbers are only resolvable to an edge once a
 * graph is on screen to resolve them against.
 */
export type EdgeVerdicts = Array<{ chosen: number[][]; weighed: number[][] }>;

export function buildEdgeVerdicts(trace: TraceStep[]): EdgeVerdicts {
  const tuplesOf = (id: SerializedValue, heap: Heap): number[][] | undefined => {
    if (!isRef(id, heap)) return undefined;
    const items = heap[id].items;
    if (!items) return undefined;
    const out: number[][] = [];
    for (const item of items) {
      if (!isRef(item, heap)) return undefined;
      const inner = heap[item].items;
      if (!inner || inner.length < 2 || inner.length > 3) return undefined;
      if (!inner.every((v) => typeof v === "number" && Number.isInteger(v))) return undefined;
      out.push(inner as number[]);
    }
    return out;
  };

  // Which names hold the run's edge list and which hold what it accumulates.
  let input: string | undefined;
  let inputSize = 0;
  const everEmpty = new Set<string>();
  const grew = new Set<string>();
  for (const step of trace) {
    for (const [name, value] of Object.entries(step.variables)) {
      const tuples = tuplesOf(value, step.heap);
      if (tuples === undefined) continue;
      if (tuples.length === 0) everEmpty.add(name);
      else if (everEmpty.has(name)) grew.add(name);
      else if (tuples.length > inputSize) {
        input = name;
        inputSize = tuples.length;
      }
    }
  }
  if (grew.size === 0) return trace.map(() => ({ chosen: [], weighed: [] }));

  const weighed = new Map<string, number[]>();
  return trace.map((step) => {
    const heap = step.heap;
    const listId = input === undefined ? undefined : step.variables[input];
    const items = isRef(listId, heap) ? (heap[listId].items ?? []) : [];

    // `for e in edges` binds the tuple itself, which says exactly which edge
    // the run is on. Unpacked as `for w, u, v in edges` it binds no such
    // handle, and the numbers standing together have to do — one step wide of
    // the truth at an iteration boundary, where the previous edge's values
    // are still in scope, but right for the rest of it.
    const held = new Set<number>();
    const bound = new Set<string>();
    for (const value of Object.values(step.variables)) {
      if (typeof value === "number" && Number.isInteger(value)) held.add(value);
      else if (typeof value === "string") bound.add(value);
    }
    const byHandle = items.some((item) => isRef(item, heap) && bound.has(item));
    for (const item of items) {
      if (!isRef(item, heap)) continue;
      const tuple = heap[item].items;
      if (!tuple || !tuple.every((v) => typeof v === "number")) continue;
      const on = byHandle ? bound.has(item) : (tuple as number[]).every((n) => held.has(n));
      if (on) weighed.set(item, tuple as number[]);
    }

    const chosen: number[][] = [];
    for (const name of grew) {
      const tuples = tuplesOf(step.variables[name], heap);
      if (tuples) chosen.push(...tuples);
    }
    return { chosen, weighed: [...weighed.values()] };
  });
}

/**
 * Which connected component each node belongs to.
 *
 * A property of the edges and nothing else — no need to know whether a BFS, a
 * DFS or a union-find established it. Returned only when the graph is actually
 * split: on a single connected graph the colours would say nothing and cost
 * the palette its meaning.
 */
function componentsOf(count: number, edges: GraphViewModel["edges"]): number[] | undefined {
  const parent = Array.from({ length: count }, (_, node) => node);
  const find = (node: number): number => {
    let root = node;
    while (parent[root] !== root) root = parent[root];
    while (parent[node] !== root) {
      const next = parent[node];
      parent[node] = root;
      node = next;
    }
    return root;
  };

  for (const edge of edges) {
    const a = find(edge.from);
    const b = find(edge.to);
    if (a !== b) parent[a] = b;
  }

  const label = new Map<number, number>();
  const components = Array.from({ length: count }, (_, node) => {
    const root = find(node);
    if (!label.has(root)) label.set(root, label.size);
    return label.get(root)!;
  });

  return label.size > 1 ? components : undefined;
}
