import { testProblem } from "../execution/service.js";
import { problems } from "./seeds.js";
import type { Language } from "@nodeflow/shared";

/**
 * Compiles and runs every problem's generated C++ and Java starter against its
 * visible cases. A starter should be judged (usually Wrong Answer), never fail
 * to compile or crash the harness.
 *
 *   npm run verify:starters -- --language cpp --concurrency 3
 *   npm run verify:starters -- --id lru-cache,bst-iterator
 */

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const BROKEN = new Set(["Compile Error", "Platform Error", "Sandbox Violation"]);

const main = async () => {
  const languages = (option("language") ?? "cpp,java").split(",") as Language[];
  const ids = option("id")?.split(",");
  const selected = ids ? problems.filter((problem) => ids.includes(problem.id)) : problems;
  const concurrency = Number(option("concurrency") ?? 3);

  const queue = languages.flatMap((language) => selected.map((problem) => ({ problem, language })));
  const total = queue.length;
  const failures: string[] = [];
  const verdicts: Record<string, number> = {};
  let done = 0;

  const worker = async () => {
    while (queue.length) {
      const { problem, language } = queue.shift()!;
      const code = problem.starterCodeByLanguage[language];
      try {
        const judged = await testProblem(problem, code, language);
        verdicts[judged.verdict] = (verdicts[judged.verdict] ?? 0) + 1;
        if (BROKEN.has(judged.verdict)) {
          const execution = judged.cases[0]?.execution;
          const message = execution && !execution.ok ? execution.message : "";
          failures.push(`${language} ${problem.id}: ${judged.verdict} ${message.slice(0, 400)}`);
        }
      } catch (error) {
        failures.push(`${language} ${problem.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
      done += 1;
      if (done % 50 === 0) console.error(`${done}/${total}`);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(JSON.stringify({ ok: failures.length === 0, checked: total, verdicts, failures }, null, 2));
  process.exit(failures.length ? 1 : 0);
};

void main();
