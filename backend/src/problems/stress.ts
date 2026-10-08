import fs from "node:fs";
import path from "node:path";
import type { ProblemTestCase } from "@nodeflow/shared";
import { dataDir } from "../paths.js";

/**
 * The generated stress suite (problem-src/stress.py): about a hundred more
 * hidden cases per problem, judged by Submit after the hand-written ones.
 *
 * The index (id -> batch file and count) is small and read at start, so a
 * problem can say how many cases Submit will judge. The cases themselves are
 * megabytes, so a batch file is only read the first time one of its problems
 * is submitted, and kept after that.
 */

const stressDir = path.join(dataDir, "stress");

interface StressIndex {
  [problemId: string]: { file: string; count: number };
}

const readJson = <T>(file: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
};

const index: StressIndex = (() => {
  const built = readJson<StressIndex>(path.join(stressDir, "index.json"));
  if (built) return built;
  // No index yet: work it out from the batch files themselves.
  const derived: StressIndex = {};
  if (!fs.existsSync(stressDir)) return derived;
  for (const file of fs.readdirSync(stressDir)) {
    if (!file.endsWith(".json") || file === "index.json") continue;
    const batch = readJson<Record<string, unknown[]>>(path.join(stressDir, file)) ?? {};
    for (const [id, cases] of Object.entries(batch)) derived[id] = { file, count: cases.length };
  }
  return derived;
})();

const batches = new Map<string, Record<string, Array<Omit<ProblemTestCase, "visible">>>>();

/** How many stress cases a problem has (0 for variants and skipped problems). */
export const stressCount = (problemId: string) => index[problemId]?.count ?? 0;

export const stressCases = (problemId: string): ProblemTestCase[] => {
  const entry = index[problemId];
  if (!entry) return [];
  let batch = batches.get(entry.file);
  if (!batch) {
    batch = readJson<Record<string, Array<Omit<ProblemTestCase, "visible">>>>(path.join(stressDir, entry.file)) ?? {};
    batches.set(entry.file, batch);
  }
  return (batch[problemId] ?? []).map((testCase) => ({ ...testCase, visible: false, group: "stress" }));
};
