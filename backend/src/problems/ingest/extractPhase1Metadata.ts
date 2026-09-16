import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDsaMetadata } from "../metadata.js";

const backendRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const outputDir = path.join(backendRoot, "data");
const outputPath = path.join(outputDir, "phase1-metadata.json");

const phaseOne = loadDsaMetadata()
  .filter((entry) => entry.structureType === "array" || entry.structureType === "linked_list")
  .map((entry) => ({
    title: entry.title,
    topic: entry.topicGroup,
    difficulty: entry.difficulty,
    sourceLink: entry.sourceLink,
    structureType: entry.structureType,
    status: "metadata_only"
  }));

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(phaseOne, null, 2)}\n`, "utf8");

console.log(`Wrote ${phaseOne.length} Phase 1 metadata entries to ${outputPath}`);
