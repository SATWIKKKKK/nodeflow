import { problems } from "../problems/seeds.js";
import { runProblemCase } from "./service.js";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const main = async () => {
  const problem = problems.find((entry) => entry.id === "reverse-linked-list");
  assert(problem, "reverse-linked-list seed is missing");

  const runs = await Promise.all([
    runProblemCase(problem!, problem!.referenceCode, problem!.defaultInput),
    runProblemCase(problem!, problem!.referenceCode, problem!.defaultInput),
    runProblemCase(problem!, problem!.referenceCode, problem!.defaultInput)
  ]);

  for (const [index, run] of runs.entries()) {
    assert(run.ok, `queued run ${index + 1} failed`);
    assert(typeof run.queuedMs === "number", `queued run ${index + 1} missed queuedMs`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        queuedMs: runs.map((run) => run.queuedMs ?? 0),
        serialized: runs.some((run) => (run.queuedMs ?? 0) > 0)
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
