import { getProblem } from "../problems/seeds.js";
import { submitProblem } from "../execution/service.js";
import { signIn, signOut, signUp, userForToken } from "./store.js";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const main = async () => {
  const email = `verify-${Date.now()}@noesis.local`;
  const password = "password123";
  const created = signUp(email, password);
  assert(created.user.email === email, "created user email mismatch");
  assert(userForToken(created.token)?.id === created.user.id, "created session lookup failed");

  const signedIn = signIn(email, password);
  assert(signedIn.user.id === created.user.id, "sign in returned a different user");
  assert(userForToken(signedIn.token)?.id === created.user.id, "sign in session lookup failed");

  const problem = getProblem("sum-array-elements") ?? getProblem("two-sum-array");
  assert(problem, "no problem available for auth verification");
  const submitted = await submitProblem(problem!, problem!.referenceCode, created.user.id);
  assert(submitted.persisted, "authenticated submit was not persisted");
  assert(submitted.userId === created.user.id, "authenticated submit missed user id");

  signOut(signedIn.token);
  assert(!userForToken(signedIn.token), "sign out did not clear session");

  console.log(
    JSON.stringify(
      {
        ok: true,
        userId: created.user.id,
        submitted: submitted.submissionId
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
