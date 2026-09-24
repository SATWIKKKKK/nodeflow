import type { TraceStep } from "@nodeflow/shared";

/**
 * A fixture is the response POST /api/run returned, stored as it arrived:
 * delta heaps, no precomputed diffs. Components expand it with expandTrace and
 * computeDiffs — the same helpers the workspace uses — so what the landing page
 * draws goes through exactly the path a real run does.
 */
export interface RecordedRun {
  recordedFrom: string;
  problemId: string;
  input: Record<string, unknown>;
  result: unknown;
  runtimeMs: number;
  heapMode: "delta" | "full";
  trace: TraceStep[];
}
