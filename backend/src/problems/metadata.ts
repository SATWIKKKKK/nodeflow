import fs from "node:fs";
import path from "node:path";
import type { StructureType } from "@nodeflow/shared";
import { backendRoot, repoRoot } from "../paths.js";

interface SheetEntry {
  title: string;
  topicGroup: string | null;
  structureType: StructureType | null;
  difficulty: string | null;
  sourceLink: string | null;
}

const dsaPath = path.join(repoRoot, "DSA.json");
const bankFiles = (): string[] => {
  const bankDir = path.join(backendRoot, "data", "problems");
  const files = [path.join(backendRoot, "data", "reviewed-phase1.json")];
  if (fs.existsSync(bankDir)) {
    files.push(...fs.readdirSync(bankDir).filter((name) => name.endsWith(".json")).map((name) => path.join(bankDir, name)));
  }
  return files.filter((file) => fs.existsSync(file));
};

/** Sheet rows that are section headings or theory notes, not problems. */
const SHEET_HEADINGS = new Set(
  [
    "Java Collections/STL",
    "Maths",
    "Arrays",
    "Hashing",
    "Strings",
    "Recursion",
    "Recursion Theory",
    "Recursion Concepts with Parameters",
    "Deletion in Linked List",
    "Insertion in Linked List",
    "Introduction to Doubly LL",
    "Deletion in Doubly LL",
    "Insertion in DLL",
    "Implementation using different DS",
    "MST theory"
  ].map((title) => title.toLowerCase())
);

/** Sheet problems covered by the hand-written seeds in seeds.ts. */
const SEEDED_TITLES = ["Two Sum", "Reverse a LL", "Find Middle of Linked List", "Merge two Sorted Lists"].map((title) =>
  title.toLowerCase()
);

export const loadDsaMetadata = (): SheetEntry[] => {
  if (!fs.existsSync(dsaPath)) return [];
  const raw = fs.readFileSync(dsaPath, "utf8");
  return JSON.parse(raw) as SheetEntry[];
};

const publishedSourceTitles = (): Set<string> => {
  const titles = new Set(SEEDED_TITLES);
  for (const file of bankFiles()) {
    try {
      const records = JSON.parse(fs.readFileSync(file, "utf8")) as Array<{ sourceTitle?: string }>;
      for (const record of records) {
        if (record.sourceTitle) titles.add(record.sourceTitle.trim().toLowerCase());
      }
    } catch {
      // reviewedPhase1.ts already reports malformed batches.
    }
  }
  return titles;
};

export const dsaSummary = () => {
  const entries = loadDsaMetadata();
  const sheetProblems = entries.filter((entry) => !SHEET_HEADINGS.has(entry.title.trim().toLowerCase()));
  const published = publishedSourceTitles();
  const covered = sheetProblems.filter((entry) => published.has(entry.title.trim().toLowerCase())).length;

  return {
    total: sheetProblems.length,
    covered,
    unpublished: sheetProblems.length - covered
  };
};
