import type { CompareMode, HeapObject, MutatedObject, TraceDiff, TraceStep } from "./types.js";

/**
 * Trace helpers shared by the backend (judge) and the frontend (replay).
 */

const stableJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
};

/**
 * Tracers send heap deltas: each step lists only the objects that changed and
 * the ids that disappeared. Rebuild the full heap per step. Unchanged objects
 * are shared by reference between steps, so memory stays proportional to the
 * number of changes, not steps × heap size.
 */
export function expandTrace(steps: TraceStep[], heapMode: "delta" | "full" | undefined): TraceStep[] {
  if (heapMode !== "delta") return steps;

  let heap: Record<string, HeapObject> = {};
  return steps.map((step) => {
    const next: Record<string, HeapObject> = { ...heap, ...step.heap };
    for (const id of step.removed ?? []) delete next[id];
    heap = next;
    const { removed: _removed, ...rest } = step;
    return { ...rest, heap: next };
  });
}

const changedFields = (before: HeapObject, after: HeapObject): string[] => {
  if (before === after) return [];
  const fields = new Set<string>();

  for (const key of Object.keys(before.fields ?? {})) fields.add(key);
  for (const key of Object.keys(after.fields ?? {})) fields.add(key);

  if (before.items || after.items) fields.add("items");
  if (before.truncated !== after.truncated) fields.add("truncated");
  if (before.preview !== after.preview) fields.add("preview");

  return [...fields].filter((field) => {
    if (field === "items") return stableJson(before.items ?? []) !== stableJson(after.items ?? []);
    if (field === "truncated") return before.truncated !== after.truncated;
    if (field === "preview") return before.preview !== after.preview;
    return stableJson(before.fields?.[field]) !== stableJson(after.fields?.[field]);
  });
};

/** Per-step change sets over a fully expanded trace. */
export function computeDiffs(steps: TraceStep[]): TraceDiff[] {
  return steps.map((step, index) => {
    const previous = steps[index - 1];
    const previousHeap = previous?.heap ?? {};
    const currentHeap = step.heap;

    const created = Object.keys(currentHeap).filter((id) => !(id in previousHeap));
    const deleted = Object.keys(previousHeap).filter((id) => !(id in currentHeap));
    const mutated: MutatedObject[] = [];

    for (const [id, after] of Object.entries(currentHeap)) {
      const before = previousHeap[id];
      if (!before || before === after) continue;

      const fields = changedFields(before, after);
      if (fields.length > 0) {
        mutated.push({ id, fields, before, after });
      }
    }

    const variablesChanged: TraceDiff["variablesChanged"] = {};
    const variableNames = new Set([
      ...Object.keys(previous?.variables ?? {}),
      ...Object.keys(step.variables)
    ]);

    for (const name of variableNames) {
      const before = previous?.variables[name];
      const after = step.variables[name];
      if (stableJson(before) !== stableJson(after)) {
        variablesChanged[name] = { before, after };
      }
    }

    return { created, deleted, mutated, variablesChanged };
  });
}

const sortKey = (value: unknown) => stableJson(value);

const normalise = (value: unknown, mode: CompareMode): unknown => {
  if (!Array.isArray(value)) return value;
  if (mode === "unordered") {
    return [...value].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  }
  if (mode === "unordered_deep") {
    return value
      .map((item) => normalise(item, "unordered_deep"))
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  }
  return value;
};

const closeEnough = (left: unknown, right: unknown): boolean => {
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) <= 1e-5 * Math.max(1, Math.abs(right));
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => closeEnough(item, right[index]));
  }
  return stableJson(left) === stableJson(right);
};

/** Judge comparison between a program's output and the expected output. */
export function outputsMatch(actual: unknown, expected: unknown, mode: CompareMode = "exact"): boolean {
  if (mode === "float") return closeEnough(actual, expected);
  return stableJson(normalise(actual, mode)) === stableJson(normalise(expected, mode));
}
