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
}

export interface SceneEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface SceneGraph {
  nodes: SceneNode[];
  edges: SceneEdge[];
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

/**
 * A list/tuple of plain values is the one case we expand into several spheres —
 * an array reads as a row of cells, not as a single blob.
 */
const isPrimitiveArray = (object: HeapObject, heap: Record<string, HeapObject>): boolean =>
  Boolean(object.items?.length) && object.items!.every((item) => !isRef(item, heap));

/**
 * BFS depth per object for one snapshot, seeded from the variables so the entry
 * points are deterministic. Unreferenced objects are still reached, after the
 * ones a variable can see.
 */
function discover(step: TraceStep): Map<string, number> {
  const heap = step.heap ?? {};
  const rooted = new Set<string>();
  const rootOrder: string[] = [];
  for (const value of Object.values(step.variables ?? {})) {
    if (!isRef(value, heap) || rooted.has(value)) continue;
    rooted.add(value);
    rootOrder.push(value);
  }

  const depth = new Map<string, number>();
  for (const seed of [...rootOrder, ...Object.keys(heap).filter((id) => !rooted.has(id))]) {
    if (depth.has(seed)) continue;
    depth.set(seed, 0);

    const queue = [seed];
    while (queue.length) {
      const current = queue.shift()!;
      const object = heap[current];
      if (!object) continue;

      for (const edge of outgoingRefs(current, object, heap)) {
        if (depth.has(edge.to)) continue;
        depth.set(edge.to, (depth.get(current) ?? 0) + 1);
        queue.push(edge.to);
      }
    }
  }
  return depth;
}

/** Where every object sits, for the whole replay. */
export interface SceneLayout {
  positions: Map<string, [number, number, number]>;
  extent: number;
}

const EMPTY_LAYOUT: SceneLayout = { positions: new Map(), extent: 1 };

interface Placement {
  level: number;
  slot: number;
  /** Set for a primitive array: how many cells it ever holds. */
  cells?: number;
}

/**
 * Freezes one layout for the entire trace.
 *
 * Positions must not be recomputed per step. Rewiring a pointer changes what
 * BFS reaches first, so a per-step layout makes every node in a linked list
 * teleport the moment the list starts reversing — the structure appears to
 * scramble even though only one field changed. Placing each object once, the
 * first step it appears in, leaves the arrows to carry the change.
 */
export function buildSceneLayout(trace: TraceStep[]): SceneLayout {
  if (!trace.length) return EMPTY_LAYOUT;

  // Both of these are decided across the whole trace, so a structure never
  // switches layout scheme or reflows its cells halfway through playback.
  let branching = false;
  const widest = new Map<string, number>();
  for (const step of trace) {
    const heap = step.heap ?? {};
    for (const [id, object] of Object.entries(heap)) {
      if (outgoingRefs(id, object, heap).length > 1) branching = true;
      if (isPrimitiveArray(object, heap)) {
        widest.set(id, Math.max(widest.get(id) ?? 0, object.items!.length));
      }
    }
  }

  const placement = new Map<string, Placement>();
  const usedPerLevel = new Map<number, number>();

  for (const step of trace) {
    const heap = step.heap ?? {};
    for (const [id, level] of discover(step)) {
      const object = heap[id];
      if (!object || placement.has(id)) continue;

      // An array owns a whole row of cells, so it takes no sibling slot.
      if (isPrimitiveArray(object, heap)) {
        placement.set(id, { level, slot: 0, cells: Math.max(1, widest.get(id) ?? 1) });
        continue;
      }

      const slot = usedPerLevel.get(level) ?? 0;
      usedPerLevel.set(level, slot + 1);
      placement.set(id, { level, slot });
    }
  }

  const siblings = new Map<number, number>();
  for (const spot of placement.values()) {
    if (spot.cells === undefined) siblings.set(spot.level, (siblings.get(spot.level) ?? 0) + 1);
  }

  const positions = new Map<string, [number, number, number]>();
  for (const [id, spot] of placement) {
    if (spot.cells !== undefined) {
      // Long arrays wrap into rows, read left-to-right like text — a single
      // 56-wide line is unreadable at any camera distance.
      const perRow = Math.min(spot.cells, ROW_WRAP);
      const rows = Math.ceil(spot.cells / perRow);
      const xOffset = ((perRow - 1) * X_SPACING) / 2;
      const zOffset = ((rows - 1) * Z_SPACING) / 2;
      const baseZ = branching ? -spot.level * Z_SPACING : 0;

      for (let cell = 0; cell < spot.cells; cell += 1) {
        const column = cell % perRow;
        const row = Math.floor(cell / perRow);
        positions.set(`${id}#${cell}`, [
          column * X_SPACING - xOffset,
          0,
          baseZ + row * Z_SPACING - zOffset
        ]);
      }
      continue;
    }

    // Chains run along +X, branching structures layer back along -Z.
    const spread = (((siblings.get(spot.level) ?? 1) - 1) * X_SPACING) / 2;
    positions.set(
      id,
      branching
        ? [spot.slot * X_SPACING - spread, 0, -spot.level * Z_SPACING]
        : [spot.level * X_SPACING, 0, spot.slot * Z_SPACING]
    );
  }

  // Chains are centred so the structure grows around the origin the camera looks at.
  if (!branching) {
    let maxAbsX = 0;
    for (const position of positions.values()) maxAbsX = Math.max(maxAbsX, Math.abs(position[0]));
    for (const position of positions.values()) position[0] -= maxAbsX / 2;
  }

  // The true half-span, plus headroom for the sphere radius and the floating
  // label. Taken over the whole trace, so the camera frames once and holds.
  let halfX = 1;
  let halfZ = 1;
  for (const position of positions.values()) {
    halfX = Math.max(halfX, Math.abs(position[0]));
    halfZ = Math.max(halfZ, Math.abs(position[2]));
  }

  return { positions, extent: Math.max(halfX, halfZ) + 1.3 };
}

export function buildSceneGraph(step: TraceStep | undefined, layout: SceneLayout): SceneGraph {
  if (!step) return { nodes: [], edges: [], extent: layout.extent };

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

    if (isPrimitiveArray(object, heap)) {
      const items = object.items!;
      items.forEach((item, cell) => {
        const position = at(`${id}#${cell}`);
        if (!position) return;
        nodes.push({
          id: `${id}#${cell}`,
          label: primitiveLabel(item),
          roots: cell === 0 ? roots : [],
          position
        });
      });

      // Neighbours within a row only; a wrap-around dash would cut straight
      // back across the grid.
      for (let cell = 0; cell < items.length - 1; cell += 1) {
        const here = layout.positions.get(`${id}#${cell}`);
        const next = layout.positions.get(`${id}#${cell + 1}`);
        if (!here || !next || here[2] !== next[2]) continue;
        edges.push({ id: `${id}#${cell}->`, from: `${id}#${cell}`, to: `${id}#${cell + 1}` });
      }
      continue;
    }

    const position = at(id);
    if (!position) continue;

    nodes.push({ id, label: labelForObject(object, heap), roots, position });
    edges.push(...outgoingRefs(id, object, heap));
  }

  // Drop edges whose target was expanded into cells or never materialised.
  const present = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: edges.filter((edge) => present.has(edge.from) && present.has(edge.to)),
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
