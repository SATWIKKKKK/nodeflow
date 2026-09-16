import fs from "node:fs";
import path from "node:path";
import { STRUCTURE_TYPES, type Language, type Problem } from "@nodeflow/shared";
import { problems } from "./seeds.js";
import { reviewedProblemListSchema, reviewedProblemToProblem } from "./ingest/schema.js";
import { verifyProblemReference } from "../execution/service.js";

/**
 * Runs every problem's reference solution against its test cases *and* its
 * written examples, in the sandbox.
 *
 *   npm run verify:problems                       whole live bank
 *   npm run verify:problems -- --file data/problems/strings.json
 *   npm run verify:problems -- --id two-sum-array
 *   npm run verify:problems -- --language cpp --solutions path/to/solutions.json
 *
 * --solutions maps problem id -> code, for checking the C++/Java harnesses with
 * hand-written reference solutions.
 */

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const selectProblems = (): Problem[] => {
  const file = option("file");
  if (file) {
    const records = reviewedProblemListSchema.parse(JSON.parse(fs.readFileSync(path.resolve(file), "utf8")));
    return records.map(reviewedProblemToProblem);
  }
  const id = option("id");
  return id ? problems.filter((problem) => id.split(",").includes(problem.id)) : problems;
};

const checkShape = (problem: Problem) => {
  assert(problem.visibleTestCases.length >= 1, `${problem.id} has no visible test cases`);
  assert(problem.testCases.some((testCase) => !testCase.visible), `${problem.id} has no hidden test cases`);
  assert(STRUCTURE_TYPES.includes(problem.structureType), `${problem.id} uses unknown structure ${problem.structureType}`);
  const ids = new Set(problem.testCases.map((testCase) => testCase.id));
  assert(ids.size === problem.testCases.length, `${problem.id} has duplicate test case ids`);
  for (const parameter of problem.signature.parameters) {
    assert(parameter.name in problem.defaultInput, `${problem.id} defaultInput is missing ${parameter.name}`);
  }
};

const main = async () => {
  const selected = selectProblems();
  const language = (option("language") ?? "python") as Language;
  const solutions = option("solutions")
    ? (JSON.parse(fs.readFileSync(path.resolve(option("solutions")!), "utf8")) as Record<string, string>)
    : null;

  const seen = new Set<string>();
  for (const problem of problems) {
    assert(!seen.has(problem.id), `Duplicate problem id in live bank: ${problem.id}`);
    seen.add(problem.id);
  }

  const failures: string[] = [];
  const results: Array<{ id: string; verdict: string; cases: number }> = [];
  const queue = selected.filter((problem) => !solutions || problem.id in solutions);
  const concurrency = Number(option("concurrency") ?? 2);

  const worker = async () => {
    while (queue.length) {
      const problem = queue.shift()!;
      try {
        checkShape(problem);
        const code = solutions ? solutions[problem.id] : problem.referenceCode;
        // Written examples are checked too, so the statement never shows a wrong answer.
        const withExamples: Problem = {
          ...problem,
          testCases: [
            ...problem.testCases,
            ...problem.examples.map((example, index) => ({
              id: `example-${index + 1}`,
              input: example.input,
              expectedOutput: example.output,
              visible: false
            }))
          ]
        };
        const judged = await verifyProblemReference(withExamples, code, language);
        results.push({ id: problem.id, verdict: judged.verdict, cases: withExamples.testCases.length });
        if (judged.verdict !== "Accepted") {
          const failed = judged.cases.at(-1);
          const detail = failed?.execution && !failed.execution.ok ? failed.execution.message : "";
          failures.push(
            `${problem.id}: ${judged.verdict} on ${failed?.id} ` +
              `expected=${JSON.stringify(failed?.expectedOutput)} actual=${JSON.stringify(failed?.actualOutput)} ${detail}`
          );
        }
      } catch (error) {
        failures.push(`${problem.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));

  const byStructure: Record<string, number> = {};
  for (const problem of selected) byStructure[problem.structureType] = (byStructure[problem.structureType] ?? 0) + 1;

  console.log(
    JSON.stringify(
      { ok: failures.length === 0, language, checked: results.length, byStructure, failures },
      null,
      2
    )
  );
  if (failures.length) process.exit(1);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
