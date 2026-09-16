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

export function buildSceneGraph(step: TraceStep | undefined): SceneGraph {
  if (!step) return { nodes: [], edges: [], extent: 1 };

  const heap = step.heap ?? {};
  const nodes: SceneNode[] = [];
  const edges: SceneEdge[] = [];

  // Variables pointing into the heap give us deterministic entry points.
  const rootsById = new Map<string, string[]>();
  const rootOrder: string[] = [];
  for (const [name, value] of Object.entries(step.variables ?? {})) {
    if (!isRef(value, heap)) continue;
    if (!rootsById.has(value)) {
      rootsById.set(value, []);
      rootOrder.push(value);
    }
    rootsById.get(value)!.push(name);
  }

  // Unreferenced heap objects still get drawn, after the reachable ones.
  const seeds = [...rootOrder, ...Object.keys(heap).filter((id) => !rootsById.has(id))];

  // BFS assigns a depth per node; discovery order fixes sibling order so that
  // positions stay stable from one trace step to the next.
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const seed of seeds) {
    if (depth.has(seed)) continue;
    depth.set(seed, 0);
    queue.push(seed);

    while (queue.length) {
      const current = queue.shift()!;
      const object = heap[current];
      if (!object) continue;

      for (const edge of outgoingRefs(current, object, heap)) {
        if (!depth.has(edge.to)) {
          depth.set(edge.to, (depth.get(current) ?? 0) + 1);
          queue.push(edge.to);
        }
      }
    }
  }

  const ordered = [...depth.keys()];
  const branching = ordered.some((id) => {
    const object = heap[id];
    return object ? outgoingRefs(id, object, heap).length > 1 : false;
  });

  // Slot bookkeeping: chains run along +X, branching structures layer back along -Z.
  const perDepth = new Map<number, number>();
  const takeSlot = (level: number) => {
    const used = perDepth.get(level) ?? 0;
    perDepth.set(level, used + 1);
    return used;
  };
  const depthCounts = new Map<number, number>();
  for (const id of ordered) {
    const level = depth.get(id) ?? 0;
    depthCounts.set(level, (depthCounts.get(level) ?? 0) + 1);
  }

  let maxAbsX = 1;
  let maxAbsZ = 1;

  for (const id of ordered) {
    const object = heap[id];
    if (!object) continue;

    const level = depth.get(id) ?? 0;
    const roots = rootsById.get(id) ?? [];

    if (isPrimitiveArray(object, heap)) {
      // One sphere per cell. Long arrays wrap into rows, read left-to-right like
      // text — a single 56-wide line is unreadable at any camera distance.
      const items = object.items!;
      const perRow = Math.min(items.length, ROW_WRAP);
      const rows = Math.ceil(items.length / perRow);
      const xOffset = ((perRow - 1) * X_SPACING) / 2;
      const zOffset = ((rows - 1) * Z_SPACING) / 2;
      const baseZ = branching ? -level * Z_SPACING : 0;

      items.forEach((item, itemIndex) => {
        const column = itemIndex % perRow;
        const row = Math.floor(itemIndex / perRow);
        const x = column * X_SPACING - xOffset;
        const z = baseZ + row * Z_SPACING - zOffset;

        nodes.push({
          id: `${id}#${itemIndex}`,
          label: primitiveLabel(item),
          roots: itemIndex === 0 ? roots : [],
          position: [x, 0, z]
        });
        maxAbsX = Math.max(maxAbsX, Math.abs(x));
        maxAbsZ = Math.max(maxAbsZ, Math.abs(z));
      });

      // Connect neighbours within a row only; a wrap-around dash would cut
      // straight back across the grid.
      for (let itemIndex = 0; itemIndex < items.length - 1; itemIndex += 1) {
        if ((itemIndex + 1) % perRow === 0) continue;
        edges.push({
          id: `${id}#${itemIndex}->`,
          from: `${id}#${itemIndex}`,
          to: `${id}#${itemIndex + 1}`
        });
      }
      continue;
    }

    const slot = takeSlot(level);
    const siblings = depthCounts.get(level) ?? 1;
    const spread = ((siblings - 1) * X_SPACING) / 2;
    const position: [number, number, number] = branching
      ? [slot * X_SPACING - spread, 0, -level * Z_SPACING]
      : [level * X_SPACING, 0, slot * Z_SPACING];

    nodes.push({ id, label: labelForObject(object, heap), roots, position });
    edges.push(...outgoingRefs(id, object, heap));
    maxAbsX = Math.max(maxAbsX, Math.abs(position[0]));
    maxAbsZ = Math.max(maxAbsZ, Math.abs(position[2]));
  }

  // Drop edges whose target was expanded into cells or never materialised.
  const present = new Set(nodes.map((node) => node.id));
  const resolved = edges.filter((edge) => present.has(edge.from) && present.has(edge.to));

  // Chains are centred so the structure grows around the origin the camera looks at.
  if (!branching && nodes.length) {
    const shift = maxAbsX / 2;
    for (const node of nodes) node.position[0] -= shift;
  }

  // Report the true half-span of the final layout, plus headroom for the sphere
  // radius and the floating label, so the camera can fit it exactly.
  let halfX = 1;
  let halfZ = 1;
  for (const node of nodes) {
    halfX = Math.max(halfX, Math.abs(node.position[0]));
    halfZ = Math.max(halfZ, Math.abs(node.position[2]));
  }

  return {
    nodes,
    edges: resolved,
    extent: Math.max(halfX, halfZ) + 1.3
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
