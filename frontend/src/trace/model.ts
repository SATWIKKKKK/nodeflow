import type {
  HeapObject,
  ProblemSignature,
  SerializedValue,
  TraceDiff,
  TraceStep
} from "@nodeflow/shared";

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

export interface ListNodeModel {
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

export interface TreeNodeModel {
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
}

export interface GridViewModel {
  kind: "grid";
  key: string;
  title: string;
  rows: CellModel[][];
  highlights: Array<{ row: number; col: number; names: string[] }>;
  rowPointers: PointerModel[];
}

export interface GraphViewModel {
  kind: "graph";
  key: string;
  title: string;
  count: number;
  edges: Array<{ key: string; from: number; to: number; directed: boolean; weight?: string }>;
  active: Array<{ node: number; names: string[] }>;
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
  | ArrayViewModel
  | GridViewModel
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
}

export interface StepModel {
  views: ViewModel[];
  variables: VariableChip[];
  frames: FrameModel[];
  caption: string;
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

function layoutTrees(roots: Array<{ id: string; names: string[] }>, heap: Heap, changed: Set<string>, tagsFor: (id: string) => Tag[]) {
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
    nodes.push({ id, label: nodeValue(object), x: cursor, depth, changed: changed.has(id), tags: tagsFor(id) });
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
  signature?: ProblemSignature;
}

export function buildStepModel({ trace, diffs, index, slots, signature }: BuildInput): StepModel {
  const step = trace[index];
  if (!step) return { views: [], variables: [], frames: [], caption: "" };

  const heap = step.heap;
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
      nodes.push({ id, label: nodeValue(heap[id]), row, col: slot.col, changed: changed.has(id), tags: tagsFor(id) });
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
    const layout = layoutTrees(roots, heap, changed, tagsFor);
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

    if (object.items) {
      if (paramKind === "graph" || GRAPH_NAMES.test(baseName)) {
        const graph = buildGraph(id, title, object, heap, step.variables);
        if (graph) {
          views.push(graph);
          return;
        }
      }
      if (/^edges$/i.test(baseName) && isEdgePairList(object, heap)) {
        const graph = buildEdgeGraph(id, title, object, heap, step.variables);
        if (graph) {
          views.push(graph);
          for (const item of object.items) if (isRef(item, heap)) shown.add(item);
          return;
        }
      }
      if (isGrid(object, heap) && object.type !== "set") {
        const rowsChanged = changedIndices(id, diff, object);
        const rows = object.items.map((item, rowIndex) => {
          const inner = heap[item as string];
          shown.add(item as string);
          const cells = changedIndices(item as string, diff, inner);
          return (inner.items ?? []).map((cell, colIndex) => ({
            key: `${rowIndex}:${colIndex}`,
            label: formatCell(cell),
            changed: cells.has(colIndex) || rowsChanged.has(rowIndex)
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
        views.push({ kind: "grid", key: id, title, rows, highlights, rowPointers });
        return;
      }

      const variant: ArrayVariant =
        object.type === "set"
          ? "set"
          : object.type === "stack" || STACK_NAMES.test(baseName)
            ? "stack"
            : object.type === "heap" || HEAP_NAMES.test(baseName)
              ? "heap"
              : object.type === "queue" || object.type === "deque" || QUEUE_NAMES.test(baseName)
                ? object.type === "deque" && !QUEUE_NAMES.test(baseName) ? "deque" : "queue"
                : object.type === "tuple"
                  ? "tuple"
                  : "list";
      const cellChanges = changedIndices(id, diff, object);
      const cells = object.items.map((item, k) => ({
        key: String(k),
        label: isRef(item, heap) ? inlineLabel(item, heap, 1) : formatCell(item),
        changed: cellChanges.has(k),
        ref: isRef(item, heap)
      }));
      for (const item of object.items) {
        if (isRef(item, heap) && !isListNode(heap[item]) && !isTreeNode(heap[item])) shown.add(item);
      }
      const indexed = variant === "list" || variant === "tuple";
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
        changed: changed.has(id)
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
        changed: typeof before === "string" && before[k] !== char
      })),
      truncated: 0,
      pointers: pointersHere,
      changed: changedVars.has(name)
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

  const frames: FrameModel[] = stack.map((frame) => ({
    function: frame.function,
    line: frame.line,
    args: Object.entries(frame.variables)
      .slice(0, 3)
      .map(([name, value]) => `${name}=${describeValue(value, heap)}`)
      .join(", ")
  }));

  return { views, variables, frames, caption: describeStep(trace, diffs, index, names) };
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
  variables: Record<string, SerializedValue>
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
  return graphFromAdjacency(id, title, adjacency, variables);
}

function buildEdgeGraph(
  id: string,
  title: string,
  object: HeapObject,
  heap: Heap,
  variables: Record<string, SerializedValue>
): GraphViewModel | null {
  const edges = object.items!.map((item) => heap[item as string].items as number[]);
  const nVar = variables.n ?? variables.V ?? variables.nodes;
  const count = typeof nVar === "number" ? nVar : Math.max(-1, ...edges.flatMap((edge) => [edge[0], edge[1]])) + 1;
  if (count <= 0 || count > 40) return null;
  const adjacency: Array<Array<{ to: number; weight?: string }>> = Array.from({ length: count }, () => []);
  for (const edge of edges) {
    if (edge[0] >= 0 && edge[0] < count) {
      adjacency[edge[0]].push({ to: edge[1], weight: edge[2] === undefined ? undefined : String(edge[2]) });
    }
  }
  const graph = graphFromAdjacency(id, title, adjacency, variables);
  // Edge lists do not say whether they are directed; draw them as given.
  return graph;
}

function graphFromAdjacency(
  id: string,
  title: string,
  adjacency: Array<Array<{ to: number; weight?: string }>>,
  variables: Record<string, SerializedValue>
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
  return { kind: "graph", key: id, title, count, edges, active: activeGraphNodes(variables, count) };
}
