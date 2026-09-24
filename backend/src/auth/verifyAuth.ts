import { getProblem } from "../problems/seeds.js";
import { submitProblem } from "../execution/service.js";
import { completePasswordReset, signIn, signOut, signUp, startPasswordReset, userForToken } from "./store.js";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertRejects = async (action: () => Promise<unknown>, message: string) => {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error(message);
};

const main = async () => {
  const email = `verify-${Date.now()}@noesis.local`;
  const password = "password123";
  const created = await signUp(email, password);
  assert(created.user.email === email, "created user email mismatch");
  assert((await userForToken(created.token))?.id === created.user.id, "created session lookup failed");

  const signedIn = await signIn(email, password);
  assert(signedIn.user.id === created.user.id, "sign in returned a different user");
  assert((await userForToken(signedIn.token))?.id === created.user.id, "sign in session lookup failed");

  const problem = getProblem("sum-array-elements") ?? getProblem("two-sum-array");
  assert(problem, "no problem available for auth verification");
  const submitted = await submitProblem(problem!, problem!.referenceCode, created.user.id);
  assert(submitted.persisted, "authenticated submit was not persisted");
  assert(submitted.userId === created.user.id, "authenticated submit missed user id");

  await signOut(signedIn.token);
  assert(!(await userForToken(signedIn.token)), "sign out did not clear session");

  // Password reset: a one-time token, a new session, and every old one dropped.
  const resetSession = await signIn(email, password);
  const reset = await startPasswordReset(email);
  assert(reset?.token, "reset did not issue a token");
  assert((await startPasswordReset(`missing-${email}`)) === null, "reset leaked that an email is unknown");

  const afterReset = await completePasswordReset(reset!.token, "changed-password");
  assert(afterReset.user.id === created.user.id, "reset signed in as the wrong user");
  assert(!(await userForToken(resetSession.token)), "reset left an old session alive");
  assert((await signIn(email, "changed-password")).user.id === created.user.id, "new password does not work");
  await assertRejects(() => completePasswordReset(reset!.token, "again"), "a reset token was reusable");
  await assertRejects(() => signIn(email, password), "the old password still works after a reset");

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
