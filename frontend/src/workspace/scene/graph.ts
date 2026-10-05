import type { HeapObject, SerializedValue, TraceDiff, TraceStep } from "@nodeflow/shared";

/**
 * Turns a traced heap snapshot into a positioned 3D graph.
 *
 * The tracer serialises object references as strings that are also keys in the
 * heap map (`obj_1`, `obj_2`, ...), so a value is a pointer exactly when the
 * heap has an entry under it. Everything else is a primitive we render as a label.
 */

export interface SceneNode {
  id: string;
  label: string;
  /** Variable names pointing directly at this node, e.g. `head`. */
  roots: string[];
  position: [number, number, number];
  /** An empty list, drawn as one hollow cell. */
  empty?: boolean;
}

export interface SceneEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** A pointer (drawn with an arrowhead) rather than a row neighbour. */
  directed?: boolean;
}

export interface SceneGraph {
  nodes: SceneNode[];
  edges: SceneEdge[];
  /** Every position the replay ever uses, so the camera frames it once. */
  bounds: Array<[number, number, number]>;
  /** Layout radius, used once to frame the camera on first render. */
  extent: number;
}

const X_SPACING = 2.4;
const Z_SPACING = 2.4;
const VALUE_FIELDS = ["val", "value", "data", "key", "item"];
/** Cells per row before a primitive array wraps to the next row. */
const ROW_WRAP = 12;

const isRef = (value: SerializedValue, heap: Record<string, HeapObject>): value is string =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(heap, value);

const primitiveLabel = (value: SerializedValue): string => {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "string") return value.length > 8 ? `${value.slice(0, 7)}…` : value;
  return String(value);
};

/** Pick the human-meaningful label for a heap object (the `val` of a list node, etc.). */
const labelForObject = (object: HeapObject, heap: Record<string, HeapObject>): string => {
  if (object.fields) {
    for (const field of VALUE_FIELDS) {
      const candidate = object.fields[field];
      if (candidate !== undefined && !isRef(candidate, heap)) {
        return primitiveLabel(candidate);
      }
    }
  }

  if (object.type === "dict") return "{}";
  if (object.type === "list" || object.type === "tuple") return "[]";
  return object.preview ? object.preview.slice(0, 8) : object.type.slice(0, 8);
};

/** Reference fields of an object, in a stable order, as outgoing edges. */
const outgoingRefs = (
  id: string,
  object: HeapObject,
  heap: Record<string, HeapObject>
): SceneEdge[] => {
  const edges: SceneEdge[] = [];

  if (object.fields) {
    for (const [field, value] of Object.entries(object.fields)) {
      if (isRef(value, heap)) {
        edges.push({ id: `${id}:${field}`, from: id, to: value, label: field });
      }
    }
  }

  if (object.items) {
    object.items.forEach((value, index) => {
      if (isRef(value, heap)) {
        edges.push({ id: `${id}:${index}`, from: id, to: value, label: String(index) });
      }
    });
  }

  return edges;
};

/** Where every object sits, for the whole replay. */
export interface SceneLayout {
  positions: Map<string, [number, number, number]>;
  /** Cells each array is drawn with, decided once for the whole trace. */
  cells: Map<string, number>;
  extent: number;
}

const EMPTY_LAYOUT: SceneLayout = { positions: new Map(), cells: new Map(), extent: 1 };

/** Fields that make an object a tree node, in the order children are drawn. */
const TREE_FIELDS = ["left", "right"];
const CHAIN_FIELDS = ["next"];
/** Rows of empty space between two separate structures. */
const BAND_GAP = 1.4;

interface Ref {
  field: string;
  to: string;
}

/**
 * The union of everything the trace ever showed, reduced to what a layout
 * needs: which objects are arrays (and how wide they get), and, for the rest,
 * the first target each field ever pointed at.
 *
 * First-seen matters. A list being reversed rewires every `next`, and laying
 * it out from the rewired pointers would scramble it mid-replay. The shape it
 * had when it first appeared is the shape it is drawn in; the arrows carry
 * every change after that.
 */
function survey(trace: TraceStep[]) {
  const arrays = new Map<string, number>();
  const holdsRefs = new Set<string>();
  const refs = new Map<string, Ref[]>();
  const firstSeen = new Map<string, number>();
  const rooted = new Map<string, number>();

  trace.forEach((step, at) => {
    const heap = step.heap ?? {};
    for (const value of Object.values(step.variables ?? {})) {
      if (isRef(value, heap) && !rooted.has(value)) rooted.set(value, at);
    }
    for (const [id, object] of Object.entries(heap)) {
      if (!firstSeen.has(id)) firstSeen.set(id, at);
      const sequence = object.type === "list" || object.type === "tuple" || Array.isArray(object.items);
      const mapping = object.type === "dict";
      if (sequence && object.items?.some((item) => isRef(item, heap))) holdsRefs.add(id);
      if (mapping && Object.values(object.fields ?? {}).some((value) => isRef(value, heap))) holdsRefs.add(id);
      if (sequence && !object.fields) arrays.set(id, Math.max(arrays.get(id) ?? 1, object.items?.length ?? 0));
      if (mapping) arrays.set(id, Math.max(arrays.get(id) ?? 1, Object.keys(object.fields ?? {}).length));

      const known = refs.get(id) ?? [];
      for (const edge of outgoingRefs(id, object, heap)) {
        if (!known.some((entry) => entry.field === edge.label)) known.push({ field: edge.label ?? "", to: edge.to });
      }
      refs.set(id, known);
    }
  });

  // A list that ever held a reference is a container of nodes, not a row of
  // values, and is drawn as a node with arrows out to what it holds.
  for (const id of holdsRefs) arrays.delete(id);
  return { arrays, refs, firstSeen, rooted };
}

/** Integer grid coordinates for one structure, before it is placed in the scene. */
type Local = Map<string, [number, number]>;

/** A binary tree drawn the way it is on paper: in-order across, depth down. */
function layoutTree(root: string, refs: Map<string, Ref[]>, members: Set<string>): Local {
  const local: Local = new Map();
  let column = 0;
  const visit = (id: string, depth: number, seen: Set<string>) => {
    if (seen.has(id) || !members.has(id)) return;
    seen.add(id);
    const out = refs.get(id) ?? [];
    const left = out.find((ref) => ref.field === "left");
    const right = out.find((ref) => ref.field === "right");
    if (left) visit(left.to, depth + 1, seen);
    local.set(id, [column++, depth]);
    if (right) visit(right.to, depth + 1, seen);
    for (const ref of out) {
      if (!TREE_FIELDS.includes(ref.field)) visit(ref.to, depth + 1, seen);
    }
  };
  visit(root, 0, new Set());
  return local;
}

/**
 * Chains run left to right along `next` (or a node's only pointer). Anything
 * else a node points at, a child list, a random pointer's target, a graph
 * neighbour, starts its own run on the row below, under the node it hangs
 * from.
 */
function layoutChains(root: string, refs: Map<string, Ref[]>, members: Set<string>): Local {
  const local: Local = new Map();
  const taken = new Set<string>();
  let lowest = 0;

  const forward = (id: string) => {
    const out = (refs.get(id) ?? []).filter((ref) => members.has(ref.to));
    return out.find((ref) => CHAIN_FIELDS.includes(ref.field)) ?? (out.length === 1 ? out[0] : undefined);
  };

  const run = (start: string, x: number, row: number) => {
    let y = row;
    // Slide down until the whole run fits on a free row.
    for (;;) {
      let fits = true;
      let cursor: string | undefined = start;
      let column = x;
      const seen = new Set<string>();
      while (cursor && !local.has(cursor) && !seen.has(cursor)) {
        seen.add(cursor);
        if (taken.has(`${column},${y}`)) {
          fits = false;
          break;
        }
        cursor = forward(cursor)?.to;
        column += 1;
      }
      if (fits) break;
      y += 1;
    }

    const placed: string[] = [];
    let cursor: string | undefined = start;
    let column = x;
    while (cursor && !local.has(cursor)) {
      local.set(cursor, [column, y]);
      taken.add(`${column},${y}`);
      placed.push(cursor);
      cursor = forward(cursor)?.to;
      column += 1;
    }
    lowest = Math.max(lowest, y);

    for (const id of placed) {
      const [px] = local.get(id)!;
      for (const ref of refs.get(id) ?? []) {
        if (members.has(ref.to) && !local.has(ref.to)) run(ref.to, px, y + 1);
      }
    }
  };

  run(root, 0, 0);
  for (const id of members) if (!local.has(id)) run(id, 0, lowest + 1);
  return local;
}

/**
 * Freezes one layout for the entire trace.
 *
 * Positions must not be recomputed per step, or a list that is being
 * reversed would appear to scramble. Each separate structure (a list, a
 * tree, an array, the result being built) gets its own band, stacked front to
 * back in the order they first appear, every band centred, and the whole
 * scene centred on the point the camera looks at.
 */
export function buildSceneLayout(trace: TraceStep[]): SceneLayout {
  if (!trace.length) return EMPTY_LAYOUT;

  const { arrays, refs, firstSeen, rooted } = survey(trace);
  const objects = [...firstSeen.keys()].filter((id) => !arrays.has(id));

  // Separate structures: objects joined by any pointer, either direction.
  const neighbours = new Map<string, Set<string>>();
  for (const id of objects) neighbours.set(id, new Set());
  const incoming = new Map<string, number>();
  for (const id of objects) {
    for (const ref of refs.get(id) ?? []) {
      if (!neighbours.has(ref.to)) continue;
      neighbours.get(id)!.add(ref.to);
      neighbours.get(ref.to)!.add(id);
      incoming.set(ref.to, (incoming.get(ref.to) ?? 0) + 1);
    }
  }

  const bands: Array<{ at: number; local: Local; array?: string }> = [];
  const grouped = new Set<string>();
  for (const id of objects) {
    if (grouped.has(id)) continue;
    const members = new Set<string>();
    const queue = [id];
    while (queue.length) {
      const current = queue.pop()!;
      if (members.has(current)) continue;
      members.add(current);
      grouped.add(current);
      for (const next of neighbours.get(current) ?? []) queue.push(next);
    }

    // The entry point: what nothing points at, preferring what a variable
    // named first, then what appeared first.
    const order = [...members].sort((a, b) => {
      const byIncoming = (incoming.get(a) ?? 0) - (incoming.get(b) ?? 0);
      if (byIncoming) return byIncoming;
      const byRoot = (rooted.get(a) ?? Infinity) - (rooted.get(b) ?? Infinity);
      if (byRoot) return byRoot;
      return (firstSeen.get(a) ?? 0) - (firstSeen.get(b) ?? 0);
    });
    const root = order[0];
    const tree = [...members].some((member) => (refs.get(member) ?? []).some((ref) => TREE_FIELDS.includes(ref.field)));
    const local = tree ? layoutTree(root, refs, members) : layoutChains(root, refs, members);
    // Members a tree walk could not reach (a detached subtree) go on as chains.
    if (tree && local.size < members.size) {
      const rest = new Set([...members].filter((member) => !local.has(member)));
      const below = Math.max(...[...local.values()].map(([, y]) => y), 0) + 1;
      for (const [member, [x, y]] of layoutChains([...rest][0], refs, rest)) local.set(member, [x, y + below]);
    }
    bands.push({ at: Math.min(...[...members].map((member) => firstSeen.get(member) ?? 0)), local });
  }

  // Arrays are rows of cells; long ones wrap like text.
  const cells = new Map<string, number>();
  for (const [id, width] of arrays) {
    const count = Math.max(1, width);
    cells.set(id, count);
    const perRow = Math.min(count, ROW_WRAP);
    const local: Local = new Map();
    for (let cell = 0; cell < count; cell += 1) local.set(`${id}#${cell}`, [cell % perRow, Math.floor(cell / perRow)]);
    bands.push({ at: firstSeen.get(id) ?? 0, local, array: id });
  }

  bands.sort((a, b) => a.at - b.at);

  const positions = new Map<string, [number, number, number]>();
  let row = 0;
  for (const band of bands) {
    const xs = [...band.local.values()].map(([x]) => x);
    const ys = [...band.local.values()].map(([, y]) => y);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    const top = Math.min(...ys);
    for (const [id, [x, y]] of band.local) {
      positions.set(id, [(x - mid) * X_SPACING, 0, (row + y - top) * Z_SPACING]);
    }
    row += Math.max(...ys) - top + 1 + BAND_GAP;
  }

  // Centre the whole scene on the origin the camera aims at.
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, , z] of positions.values()) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  for (const position of positions.values()) {
    position[0] -= cx;
    position[2] -= cz;
  }

  const halfX = Math.max(1, (maxX - minX) / 2);
  const halfZ = Math.max(1, (maxZ - minZ) / 2);
  return { positions, cells, extent: Math.max(halfX, halfZ) + 1.3 };
}

export function buildSceneGraph(step: TraceStep | undefined, layout: SceneLayout): SceneGraph {
  const bounds = [...layout.positions.values()];
  if (!step) return { nodes: [], edges: [], bounds, extent: layout.extent };

  const heap = step.heap ?? {};
  const nodes: SceneNode[] = [];
  const edges: SceneEdge[] = [];

  const rootsById = new Map<string, string[]>();
  for (const [name, value] of Object.entries(step.variables ?? {})) {
    if (!isRef(value, heap)) continue;
    const named = rootsById.get(value) ?? [];
    named.push(name);
    rootsById.set(value, named);
  }

  // Copied, so nothing downstream can move a node by writing to its position.
  const at = (id: string): [number, number, number] | undefined => {
    const position = layout.positions.get(id);
    return position ? [position[0], position[1], position[2]] : undefined;
  };

  for (const [id, object] of Object.entries(heap)) {
    const roots = rootsById.get(id) ?? [];

    if (layout.cells.has(id)) {
      // A map reads as its entries, key: value, in insertion order.
      const labels =
        object.type === "dict"
          ? Object.entries(object.fields ?? {}).map(([key, value]) => `${primitiveLabel(key)}: ${primitiveLabel(value)}`)
          : (object.items ?? []).map(primitiveLabel);
      // An empty list or map still shows where it is, as one hollow cell.
      if (!labels.length) {
        const position = at(`${id}#0`);
        if (position) {
          nodes.push({ id: `${id}#0`, label: object.type === "dict" ? "{ }" : "[ ]", roots, position, empty: true });
        }
        continue;
      }
      const items = labels;
      items.forEach((label, cell) => {
        const position = at(`${id}#${cell}`);
        if (!position) return;
        nodes.push({ id: `${id}#${cell}`, label, roots: cell === 0 ? roots : [], position });
      });
      // Neighbours within a row only; a wrap-around dash would cut back across.
      for (let cell = 0; cell < items.length - 1; cell += 1) {
        const here = layout.positions.get(`${id}#${cell}`);
        const next = layout.positions.get(`${id}#${cell + 1}`);
        if (!here || !next || here[2] !== next[2]) continue;
        edges.push({ id: `${id}#${cell}->`, from: `${id}#${cell}`, to: `${id}#${cell + 1}`, directed: false });
      }
      continue;
    }

    const position = at(id);
    if (!position) continue;
    nodes.push({ id, label: labelForObject(object, heap), roots, position });
    edges.push(...outgoingRefs(id, object, heap).map((edge) => ({ ...edge, directed: true })));
  }

  // Drop edges whose target was never drawn.
  const present = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: edges.filter((edge) => present.has(edge.from) && present.has(edge.to)),
    bounds,
    extent: layout.extent
  };
}

/** A heap object changing at a specific point in the trace. */
export interface LineTouch {
  id: string;
  step: number;
}

export interface LineIndex {
  /** Heap id -> the source line that first created it. */
  nodeToLine: Map<string, number>;
  /** Source line -> the objects it changed, with the step each change lands on. */
  lineToNodes: Map<number, LineTouch[]>;
  /** Heap id -> every step index that touches it, for jumping playback. */
  nodeToSteps: Map<string, number[]>;
  /** Source line -> every step that executes it. Lets any line be clickable. */
  lineToSteps: Map<number, number[]>;
}

/**
 * Built once per trace (not per frame) so the bidirectional editor <-> scene
 * sync is a pair of map lookups rather than a scan.
 */
export function buildLineIndex(trace: TraceStep[], diffs: TraceDiff[]): LineIndex {
  const nodeToLine = new Map<string, number>();
  const lineToNodes = new Map<number, LineTouch[]>();
  const nodeToSteps = new Map<string, number[]>();
  const lineToSteps = new Map<number, number[]>();

  // Every executed line is clickable, whether or not it changed the heap.
  trace.forEach((step, stepIndex) => {
    const steps = lineToSteps.get(step.line) ?? [];
    steps.push(stepIndex);
    lineToSteps.set(step.line, steps);
  });

  const touch = (id: string, line: number, stepIndex: number) => {
    if (!nodeToLine.has(id)) nodeToLine.set(id, line);

    const atLine = lineToNodes.get(line) ?? [];
    if (!atLine.some((entry) => entry.id === id && entry.step === stepIndex)) {
      atLine.push({ id, step: stepIndex });
      lineToNodes.set(line, atLine);
    }

    const steps = nodeToSteps.get(id) ?? [];
    if (!steps.includes(stepIndex)) {
      steps.push(stepIndex);
      nodeToSteps.set(id, steps);
    }
  };

  diffs.forEach((diff, index) => {
    // diffs[i] describes the heap as it stands at trace[i]; the statement that
    // caused it is the one executed at the previous step.
    const line = trace[index - 1]?.line ?? trace[index]?.line;
    if (line === undefined) return;

    for (const id of diff.created ?? []) touch(id, line, index);
    for (const mutation of diff.mutated ?? []) touch(mutation.id, line, index);
  });

  return { nodeToLine, lineToNodes, nodeToSteps, lineToSteps };
}

/** Cell ids (`obj_1#3`) resolve back to their container for sync lookups. */
export const baseNodeId = (id: string): string => id.split("#")[0];
