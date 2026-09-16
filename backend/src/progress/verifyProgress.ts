import { getProblem } from "../problems/seeds.js";
import { submitProblem } from "../execution/service.js";
import { signUp } from "../auth/store.js";
import { progressForUser } from "./summary.js";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const main = async () => {
  const account = signUp(`progress-${Date.now()}@noesis.local`, "password123");
  const problem = getProblem("sum-array-elements") ?? getProblem("two-sum-array");
  assert(problem, "no problem available for progress verification");

  const before = progressForUser(account.user);
  assert(before.attempted === 0, "new user should start with zero attempted problems");
  assert(before.accepted === 0, "new user should start with zero accepted problems");

  const submitted = await submitProblem(problem!, problem!.referenceCode, account.user.id);
  assert(submitted.verdict === "Accepted", "reference solution should be accepted");

  const after = progressForUser(account.user);
  const problemSummary = after.problems.find((entry) => entry.id === problem!.id);
  assert(after.attempted === 1, "progress did not count attempted problem");
  assert(after.accepted === 1, "progress did not count accepted problem");
  assert(after.recentSubmissions[0]?.submissionId === submitted.submissionId, "latest submission missing");
  assert(problemSummary?.accepted, "problem summary did not mark accepted");
  assert(problemSummary?.attempts === 1, "problem summary did not count attempts");

  console.log(
    JSON.stringify(
      {
        ok: true,
        userId: account.user.id,
        attempted: after.attempted,
        accepted: after.accepted,
        latest: after.recentSubmissions[0]?.submissionId
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
