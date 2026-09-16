import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StructureType } from "@nodeflow/shared";

interface SheetEntry {
  title: string;
  topicGroup: string | null;
  structureType: StructureType | null;
  difficulty: string | null;
  sourceLink: string | null;
}

const backendRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const repoRoot = path.resolve(backendRoot, "..");
const dsaPath = path.join(repoRoot, "DSA.json");

export const loadDsaMetadata = (): SheetEntry[] => {
  if (!fs.existsSync(dsaPath)) return [];
  const raw = fs.readFileSync(dsaPath, "utf8");
  return JSON.parse(raw) as SheetEntry[];
};

export const dsaSummary = () => {
  const entries = loadDsaMetadata();
  const phaseOne = entries.filter(
    (entry) => entry.structureType === "array" || entry.structureType === "linked_list"
  );

  return {
    total: entries.length,
    phaseOne: phaseOne.length,
    arrays: phaseOne.filter((entry) => entry.structureType === "array").length,
    linkedLists: phaseOne.filter((entry) => entry.structureType === "linked_list").length,
    unpublished: entries.length - phaseOne.length
  };
};
