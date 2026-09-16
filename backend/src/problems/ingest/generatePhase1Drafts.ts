import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StructureType } from "@nodeflow/shared";
import { loadDsaMetadata } from "../metadata.js";

const backendRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const outputDir = path.join(backendRoot, "data");
const outputPath = path.join(outputDir, "phase1-drafts.json");

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const titleCase = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const deferredReason = (entry: { title: string; structureType: StructureType | null }) => {
  const title = entry.title.toLowerCase();
  if (entry.structureType === "linked_list") {
    if (title.includes("doubly") || title.includes("dll")) {
      return "Deferred until doubly linked-list nodes are supported.";
    }
    if (title.includes("random")) {
      return "Deferred until linked-list nodes can model random pointers.";
    }
    if (title.includes("loop") || title.includes("cycle") || title.includes("intersection")) {
      return "Deferred until the harness can construct aliasing/cyclic linked-list inputs.";
    }
    if (title.includes("flatten")) {
      return "Deferred until multi-pointer linked-list structures are supported.";
    }
  }

  if (entry.structureType === "array" && (title.includes("matrix") || title.includes("2d"))) {
    return "Deferred until the visualizer can render two-dimensional arrays clearly.";
  }
  if (entry.structureType === "array" && (title.includes("stack") || title.includes("queue"))) {
    return "Deferred until stack/queue interactions are first-class structures in the workspace.";
  }
  if (entry.structureType === "array" && title.includes("heap")) {
    return "Deferred until heap rendering and heap-specific invariants are supported.";
  }
  if (entry.structureType === "array" && title.includes("matrix chain")) {
    return "Deferred until dynamic-programming table visualization is supported.";
  }
  if (entry.structureType === "array" && (title.includes("kmp") || title.includes("lps"))) {
    return "Deferred until string/pattern-tracing problems are supported.";
  }

  return null;
};

const makeDraft = (
  entry: {
    title: string;
    topicGroup: string | null;
    difficulty: string | null;
    sourceLink: string | null;
    structureType: StructureType | null;
  },
  index: number
) => {
  const reason = deferredReason(entry);

  return {
    id: `${slugify(entry.title)}-${index + 1}`,
    sourceTitle: entry.title,
    topic: entry.topicGroup ?? (entry.structureType === "linked_list" ? "Linked List" : "Array"),
    difficulty: entry.difficulty ?? "Easy",
    sourceLink: entry.sourceLink,
    structureType: entry.structureType,
    draftStatus: reason ? "deferred_until_supported" : "needs_human_review",
    deferredReason: reason,
    generatedAt: new Date().toISOString(),
    title: titleCase(entry.title),
    description:
      entry.structureType === "linked_list"
        ? `Write original Noesis wording for "${entry.title}" as a singly linked-list problem. Keep the trace focused on node values and next-pointer movement.`
        : `Write original Noesis wording for "${entry.title}" as an array problem. Keep the trace focused on index movement, comparisons, and result updates.`,
    constraints: [
      "Replace this draft constraint during review.",
      "Keep inputs small enough for the Phase 1 visualizer.",
      "Publish only after the reference solution and all tests pass."
    ],
    examples: [],
    signature: null,
    starterCode: "",
    referenceCode: "",
    defaultInput: {},
    testCases: [],
    reviewChecklist: [
      "Problem statement is original Noesis copy, not copied from an external source.",
      "Function signature uses only Phase 1 supported kinds: array, int, bool, linked_list.",
      "At least two visible and two hidden test cases are present.",
      "Reference solution passes npm run verify:problems after ingestion.",
      "Trace stays readable under the visualization cap."
    ]
  };
};

const seenTitles = new Set<string>();
const phaseOne = loadDsaMetadata()
  .filter((entry) => entry.structureType === "array" || entry.structureType === "linked_list")
  .filter((entry) => {
    const normalized = entry.title.trim().toLowerCase();
    if (!normalized || seenTitles.has(normalized)) return false;
    seenTitles.add(normalized);
    return true;
  })
  .map((entry, index) => makeDraft(entry, index));

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(phaseOne, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      outputPath,
      drafts: phaseOne.length,
      needsReview: phaseOne.filter((entry) => entry.draftStatus === "needs_human_review").length,
      deferred: phaseOne.filter((entry) => entry.draftStatus === "deferred_until_supported").length
    },
    null,
    2
  )
);
