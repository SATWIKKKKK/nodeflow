import fs from "node:fs";
import path from "node:path";
import type { Problem } from "@nodeflow/shared";
import { reviewedProblemListSchema, reviewedProblemToProblem } from "./ingest/schema.js";
import { backendRoot } from "../paths.js";

const reviewedPath = path.join(backendRoot, "data", "reviewed-phase1.json");
/** One JSON file per topic batch; each holds an array of verified problem records. */
const bankDir = path.join(backendRoot, "data", "problems");

const loadFile = (file: string): Problem[] => {
  try {
    const records = reviewedProblemListSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
    return records.map(reviewedProblemToProblem);
  } catch (error) {
    // A malformed batch must not take the whole bank down; report it loudly instead.
    console.error(`Skipping problem file ${path.basename(file)}:`, error instanceof Error ? error.message : error);
    return [];
  }
};

export const loadReviewedPhaseOneProblems = (): Problem[] => {
  const problems: Problem[] = [];
  if (fs.existsSync(reviewedPath)) problems.push(...loadFile(reviewedPath));

  if (fs.existsSync(bankDir)) {
    for (const name of fs.readdirSync(bankDir).sort()) {
      if (name.endsWith(".json")) problems.push(...loadFile(path.join(bankDir, name)));
    }
  }

  return problems;
};

export const reviewedPhaseOneProblems: Problem[] = loadReviewedPhaseOneProblems();
