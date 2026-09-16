import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reviewedProblemListSchema } from "./schema.js";
import { loadDsaMetadata } from "../metadata.js";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const unsupportedLinkedListTitle = (title: string) => {
  const normalized = title.toLowerCase();
  return (
    normalized.includes("doubly") ||
    normalized.includes("dll") ||
    normalized.includes("random") ||
    normalized.includes("loop") ||
    normalized.includes("cycle") ||
    normalized.includes("intersection") ||
    normalized.includes("flatten")
  );
};

const unsupportedArrayTitle = (title: string) => {
  const normalized = title.toLowerCase();
  return (
    normalized.includes("matrix") ||
    normalized.includes("2d") ||
    normalized.includes("stack") ||
    normalized.includes("queue") ||
    normalized.includes("heap") ||
    normalized.includes("kmp") ||
    normalized.includes("lps")
  );
};

const main = () => {
  const backendRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
  const reviewedPath = path.join(backendRoot, "data", "reviewed-phase1.json");
  const reviewedRecords = reviewedProblemListSchema.parse(
    JSON.parse(fs.readFileSync(reviewedPath, "utf8"))
  );
  const phaseOneTitles = new Set(
    loadDsaMetadata()
      .filter((entry) => entry.structureType === "array" || entry.structureType === "linked_list")
      .map((entry) => entry.title.trim().toLowerCase())
  );
  const ids = new Set<string>();

  for (const record of reviewedRecords) {
    assert(!ids.has(record.id), `Duplicate reviewed id: ${record.id}`);
    ids.add(record.id);
    assert(
      record.structureType === "array" || record.structureType === "linked_list",
      `${record.id} is outside Phase 1 structure support`
    );
    assert(record.reviewStatus === "reviewed", `${record.id} is not reviewed`);
    assert(record.testCases.filter((testCase) => testCase.visible).length >= 2, `${record.id} needs two visible cases`);
    assert(record.testCases.filter((testCase) => !testCase.visible).length >= 2, `${record.id} needs two hidden cases`);
    if (record.structureType === "array") {
      assert(!unsupportedArrayTitle(record.sourceTitle), `${record.id} uses array metadata outside current Phase 1 support`);
    }
    if (record.structureType === "linked_list") {
      assert(
        !unsupportedLinkedListTitle(record.sourceTitle),
        `${record.id} uses linked-list metadata outside singly linked-list support`
      );
      assert(
        record.signature.parameters.every((parameter) => parameter.kind === "linked_list" || parameter.kind === "int"),
        `${record.id} has unsupported linked-list parameters`
      );
      assert(
        record.signature.returnKind === "linked_list" || record.signature.returnKind === "array" || record.signature.returnKind === "int" || record.signature.returnKind === "bool",
        `${record.id} has unsupported linked-list return kind`
      );
    }
  }

  const matched = reviewedRecords.filter((record) =>
    phaseOneTitles.has(record.sourceTitle.trim().toLowerCase())
  ).length;

  console.log(
    JSON.stringify(
      {
        ok: true,
        reviewed: reviewedRecords.length,
        arrays: reviewedRecords.filter((record) => record.structureType === "array").length,
        linkedLists: reviewedRecords.filter((record) => record.structureType === "linked_list").length,
        matchedMetadataTitles: matched
      },
      null,
      2
    )
  );
};

main();
