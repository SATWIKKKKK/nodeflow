import cors from "cors";
import express from "express";
import { z } from "zod";
import { AuthError, completePasswordReset, signIn, signOut, signUp, startPasswordReset, userForToken } from "./auth/store.js";
import { appUrl, emailsEnabled, sendEmail } from "./auth/email.js";
import { dsaSummary } from "./problems/metadata.js";
import { getProblem, problems, publicProblem } from "./problems/seeds.js";
import {
  MAX_TERM,
  createVariant,
  fetchVariant,
  loadVariants,
  variantProblems,
  variantsEnabled
} from "./problems/variants.js";
import { expectedOutput, previewProblem, runProblemCase, submitProblem, testProblem } from "./execution/service.js";
import { validateCustomInput } from "./problems/inputValidation.js";
import {
  ClassroomError,
  createClassroom,
  deleteClassroom,
  getClassroom,
  joinClassroom,
  listClassrooms,
  removeMember,
  renameClassroom,
  rotateJoinCode,
  setAssignments
} from "./classrooms/store.js";
import { queueSnapshot } from "./execution/queue.js";
import { progressForUser } from "./progress/summary.js";
import { clearDraft, draftFor, saveDraft, touchDraft, unfinishedFor } from "./progress/drafts.js";
import { addCoins, breakdownFor, coinsFor, rewardSolve } from "./progress/coins.js";
import { readSubmissions } from "./progress/summary.js";
import { AskError, MAX_QUESTION, answerQuestion, askEnabled, cachedAnswer, greetingReply, rateLimitWait } from "./ask/deepseek.js";

export const app = express();

const languageSchema = z.enum(["python", "cpp", "java"]).default("python");

const runSchema = z.object({
  problemId: z.string(),
  code: z.string().min(1),
  language: languageSchema,
  input: z.record(z.string(), z.unknown()).optional()
});

const codeSchema = z.object({
  problemId: z.string(),
  code: z.string().min(1),
  language: languageSchema
});

const previewSchema = codeSchema.extend({
  input: z.record(z.string(), z.unknown()).optional()
});

const expectedSchema = z.object({
  problemId: z.string(),
  input: z.record(z.string(), z.unknown())
});

const classroomNameSchema = z.object({ name: z.string().max(200) });
const joinSchema = z.object({ code: z.string().min(1).max(40) });
const assignmentsSchema = z.object({ problemIds: z.array(z.string()).max(500) });

const coinsSchema = z.object({ delta: z.number().int() });
const draftSchema = z.object({ language: languageSchema, code: z.string().max(60_000) });
const touchSchema = z.object({ language: languageSchema, at: z.string().max(40).optional() });
const syncSchema = z.object({
  entries: z
    .array(z.object({ problemId: z.string().max(200), language: languageSchema, at: z.string().max(40).optional() }))
    .max(300)
});

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const resetSchema = z.object({
  email: z.string().email()
});

const resetConfirmSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8).max(200)
});

/**
 * A rejected request, said the way a person would say it. The validator's own
 * message is a JSON list of field codes, which means nothing to a learner.
 */
const unclear = (error: z.ZodError) => {
  const field = String(error.issues[0]?.path[0] ?? "");
  if (field === "email") return "Enter a valid email address.";
  if (field === "password") return "Use a password of at least 8 characters.";
  if (field === "code") return "Your code is too long to run. Trim it down and try again.";
  return "Something in that request was missing. Reload the page and try again.";
};

const authToken = (header: string | undefined) => {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length);
};

app.use(cors());
app.use(express.json({ limit: "1mb" }));

/**
 * Running code, and changing a problem, are for signed-in learners only. The
 * landing page, the explainers and the assistant stay public; everything that
 * starts a sandbox or a rewrite needs an account, checked here rather than
 * trusted to the browser.
 */
const SIGNED_IN_ONLY = [
  "/api/run",
  "/api/live-preview",
  "/api/expected",
  "/api/test",
  "/api/submit"
];
app.use(async (request, response, next) => {
  const gated =
    request.method === "POST" &&
    (SIGNED_IN_ONLY.includes(request.path) || /^\/api\/problems\/[^/]+\/variant$/.test(request.path));
  if (!gated || process.env.NOESIS_ACCOUNTS === "off") {
    next();
    return;
  }
  try {
    if (await userForToken(authToken(request.headers.authorization))) {
      next();
      return;
    }
  } catch (error) {
    console.error("Could not check the session", error);
    response.status(503).json({ message: "Sign-in could not be checked just now. Try again in a moment." });
    return;
  }
  response.status(401).json({ message: "Sign in to run code on Noesis." });
});

const sandboxEnabled = process.env.NOESIS_SANDBOX !== "off";
const accountsEnabled = process.env.NOESIS_ACCOUNTS !== "off";
const accountsOff = (response: express.Response) =>
  response.status(503).json({
    message: "Accounts aren't available right now. Please try again later."
  });

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "noesis-backend",
    sandbox: sandboxEnabled,
    accounts: accountsEnabled,
    emails: emailsEnabled(),
    ask: askEnabled(),
    queue: queueSnapshot()
  });
});

const variantSchema = z.object({
  term: z.string().min(1).max(MAX_TERM),
  replacement: z.string().min(1).max(MAX_TERM)
});

const askSchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION)
});

/**
 * One visitor question, answered by DeepSeek. Public and metered: see
 * ask/deepseek.ts for the bounds. The key never leaves the server.
 */
app.post("/api/ask", async (request, response) => {
  const parsed = askSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      message: `Type a question about Noesis, up to ${MAX_QUESTION} characters.`
    });
    return;
  }

  // A greeting, or a question already answered, needs no model call and
  // spends no one's budget.
  const ready = greetingReply(parsed.data.question) ?? cachedAnswer(parsed.data.question);
  if (ready) {
    response.json({ answer: ready });
    return;
  }

  if (!askEnabled()) {
    response.status(503).json({ message: "The assistant isn't available right now. Please try again later." });
    return;
  }

  const caller = String(
    request.headers["x-forwarded-for"] ?? request.socket.remoteAddress ?? "unknown"
  ).split(",")[0].trim();

  const askWait = rateLimitWait("ask", caller);
  if (askWait) {
    response.status(429).json({
      message: `That is 20 questions in ten minutes, the most one person can ask in that time. Ask again in ${askWait} minute${askWait === 1 ? "" : "s"}.`
    });
    return;
  }

  try {
    response.json({ answer: await answerQuestion(parsed.data.question) });
  } catch (error) {
    if (error instanceof AskError) {
      response.status(error.status).json({ message: error.message });
      return;
    }
    response.status(502).json({ message: "The assistant is unreachable right now." });
  }
});

app.get("/api/dsa-summary", (_request, response) => {
  response.json(dsaSummary());
});

// The list is a lightweight index (372 problems in ~40KB); pages fetch one full problem by id.
const problemIndex = problems.map(({ id, title, topic, difficulty, structureType }) => ({
  id,
  title,
  topic,
  difficulty,
  structureType
}));

/** A variant is a problem like any other once it exists. */
/** A seeded problem, or a variant from any instance (see loadVariants). */
const findProblem = async (id: string) => getProblem(id) ?? (await fetchVariant(id));

const indexEntry = (problem: { id: string; title: string; topic: string; difficulty: string; structureType: string }) => ({
  id: problem.id,
  title: problem.title,
  topic: problem.topic,
  difficulty: problem.difficulty,
  structureType: problem.structureType
});

app.get("/api/problems", async (_request, response) => {
  await loadVariants();
  response.json([...problemIndex, ...variantProblems().map(indexEntry)]);
});

/**
 * Change one word of a statement and get the problem that follows from it.
 *
 * Slow on purpose: the reply waits for a rewrite and for that rewrite's own
 * solution to be run against every input, because a variant whose answers were
 * asserted rather than computed would fail learners who were right.
 */
app.post("/api/problems/:id/variant", async (request, response) => {
  const parsed = variantSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: `Pick a word of up to ${MAX_TERM} characters.` });
    return;
  }
  if (!variantsEnabled()) {
    response.status(503).json({ message: "Changing a word isn't available right now. Please try again later." });
    return;
  }

  await loadVariants(true);
  const source = await findProblem(request.params.id);
  if (!source) {
    response.status(404).json({ message: "We couldn't find that problem. Pick one from the problem list." });
    return;
  }

  const caller = String(request.headers["x-forwarded-for"] ?? request.socket.remoteAddress ?? "unknown");
  const changeWait = rateLimitWait("variant", caller.split(",")[0].trim());
  if (changeWait) {
    response.status(429).json({
      message: `That is the most changes one person can make in ten minutes. Try again in ${changeWait} minute${changeWait === 1 ? "" : "s"}.`
    });
    return;
  }

  // Streamed line by line, because the wait is long enough that a learner
  // deserves to know which part of it they are in. A duplicate answers before
  // the first line is written; a rewrite takes the best part of half a minute.
  response.setHeader("content-type", "application/x-ndjson");
  response.setHeader("cache-control", "no-store");
  const send = (payload: unknown) => {
    response.write(`${JSON.stringify(payload)}\n`);
    // Nothing buffers a half-finished answer while the model is still thinking.
    (response as unknown as { flush?: () => void }).flush?.();
  };

  const outcome = await createVariant(
    source,
    parsed.data.term,
    parsed.data.replacement,
    [...problems, ...variantProblems()],
    send
  );
  send({ outcome });
  response.end();
});

app.get("/api/problems/:id", async (request, response) => {
  const problem = await findProblem(request.params.id);
  if (!problem) {
    response.status(404).json({ message: "We couldn't find that problem. Pick one from the problem list." });
    return;
  }
  response.json(publicProblem(problem));
});

app.post("/api/auth/signup", async (request, response) => {
  if (!accountsEnabled) {
    accountsOff(response);
    return;
  }
  const parsed = authSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: unclear(parsed.error) });
    return;
  }

  try {
    response.json(await signUp(parsed.data.email, parsed.data.password));
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    response.status(status).json({ message: error instanceof Error ? error.message : "Sign up failed." });
  }
});

app.post("/api/auth/signin", async (request, response) => {
  if (!accountsEnabled) {
    accountsOff(response);
    return;
  }
  const parsed = authSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: unclear(parsed.error) });
    return;
  }

  try {
    response.json(await signIn(parsed.data.email, parsed.data.password));
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    response.status(status).json({ message: error instanceof Error ? error.message : "Sign in failed." });
  }
});

app.get("/api/auth/me", async (request, response) => {
  response.json({ user: await userForToken(authToken(request.headers.authorization)) });
});

app.get("/api/progress", async (request, response) => {
  response.json(await progressForUser(await userForToken(authToken(request.headers.authorization))));
});

app.post("/api/auth/signout", async (request, response) => {
  await signOut(authToken(request.headers.authorization));
  response.json({ ok: true });
});

app.post("/api/auth/reset", async (request, response) => {
  const parsed = resetSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: unclear(parsed.error) });
    return;
  }

  if (!accountsEnabled) {
    accountsOff(response);
    return;
  }

  const reset = await startPasswordReset(parsed.data.email);
  if (reset) {
    const link = `${appUrl()}/reset-password?token=${encodeURIComponent(reset.token)}`;
    await sendEmail(
      reset.email,
      "Reset your Noesis password",
      `Someone asked to reset the password for this Noesis account.

${link}

` +
        "The link works once and expires in an hour. If this was not you, ignore this email; nothing changes."
    );
  }
  // The same answer either way: whether an address has an account is not public.
  response.json({ ok: true });
});

app.post("/api/auth/reset/confirm", async (request, response) => {
  if (!accountsEnabled) {
    accountsOff(response);
    return;
  }
  const parsed = resetConfirmSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Choose a password of at least 8 characters." });
    return;
  }

  try {
    response.json(await completePasswordReset(parsed.data.token, parsed.data.password));
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    response.status(status).json({ message: error instanceof Error ? error.message : "Could not reset the password." });
  }
});

app.post("/api/run", async (request, response) => {
  const parsed = runSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: unclear(parsed.error) });
    return;
  }

  const problem = await findProblem(parsed.data.problemId);
  if (!problem) {
    response.status(404).json({ message: "We couldn't find that problem. Pick one from the problem list." });
    return;
  }

  if (parsed.data.input) {
    const invalid = validateCustomInput(problem, parsed.data.input);
    if (invalid) {
      response.status(400).json({ message: `Your custom input doesn't fit this problem: ${invalid}` });
      return;
    }
  }

  const input = parsed.data.input ?? problem.defaultInput;
  const result = await runProblemCase(problem, parsed.data.code, input, {
    language: parsed.data.language
  });
  response.json(result);
});

app.post("/api/live-preview", async (request, response) => {
  const parsed = previewSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: unclear(parsed.error) });
    return;
  }

  const problem = await findProblem(parsed.data.problemId);
  if (!problem) {
    response.status(404).json({ message: "We couldn't find that problem. Pick one from the problem list." });
    return;
  }

  if (parsed.data.input) {
    const invalid = validateCustomInput(problem, parsed.data.input);
    if (invalid) {
      // A 200: the preview fires on every keystroke, and a half-typed input is not an error worth logging.
      response.json({
        mode: "live",
        ok: false,
        quiet: true,
        source: "custom_input",
        inputError: invalid,
        execution: { ok: false, errorType: "Platform Error", message: `Your custom input doesn't fit this problem: ${invalid}` }
      });
      return;
    }
  }

  response.json(await previewProblem(problem, parsed.data.code, parsed.data.language, parsed.data.input));
});

app.post("/api/expected", async (request, response) => {
  const parsed = expectedSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: unclear(parsed.error) });
    return;
  }

  const problem = await findProblem(parsed.data.problemId);
  if (!problem) {
    response.status(404).json({ message: "We couldn't find that problem. Pick one from the problem list." });
    return;
  }

  const invalid = validateCustomInput(problem, parsed.data.input);
  if (invalid) {
    response.json({ ok: false, message: `Your custom input doesn't fit this problem: ${invalid}` });
    return;
  }

  response.json(await expectedOutput(problem, parsed.data.input));
});

app.post("/api/test", async (request, response) => {
  const parsed = codeSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: unclear(parsed.error) });
    return;
  }

  const problem = await findProblem(parsed.data.problemId);
  if (!problem) {
    response.status(404).json({ message: "We couldn't find that problem. Pick one from the problem list." });
    return;
  }

  response.json(await testProblem(problem, parsed.data.code, parsed.data.language));
});

app.post("/api/submit", async (request, response) => {
  const parsed = codeSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: unclear(parsed.error) });
    return;
  }

  const problem = await findProblem(parsed.data.problemId);
  if (!problem) {
    response.status(404).json({ message: "We couldn't find that problem. Pick one from the problem list." });
    return;
  }

  const user = await userForToken(authToken(request.headers.authorization));
  // Asked before this submission is recorded: was the problem already solved?
  // A problem pays coins for its first accepted submission only, and one
  // solved before coins existed has had its first.
  const solvedBefore = user
    ? (await readSubmissions([user.id])).some(
        (entry) => entry.problemId === problem.id && entry.verdict === "Accepted"
      )
    : true;
  const result = await submitProblem(problem, parsed.data.code, user?.id, parsed.data.language);
  let coinsAwarded = 0;
  if (user && result.verdict === "Accepted") {
    // Solved is finished: it leaves Continue Solving.
    await clearDraft(user.id, problem.id).catch(() => undefined);
    if (!solvedBefore) coinsAwarded = await rewardSolve(user.id, problem.id, problem.difficulty).catch(() => 0);
  }
  response.json({ ...result, coinsAwarded });
});

// ---------------------------------------------------------------- coins

app.get("/api/coins", async (request, response) => {
  const user = await userForToken(authToken(request.headers.authorization));
  response.json({ coins: user ? await coinsFor(user.id) : 0 });
});

app.get("/api/coins/breakdown", async (request, response) => {
  const user = await userForToken(authToken(request.headers.authorization));
  if (!user) {
    response.status(401).json({ message: "Sign in to see where your coins came from." });
    return;
  }
  response.json(await breakdownFor(user.id));
});

app.post("/api/coins", async (request, response) => {
  const user = await userForToken(authToken(request.headers.authorization));
  if (!user) {
    response.status(401).json({ message: "Sign in to keep coins." });
    return;
  }
  const parsed = coinsSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "That coin update could not be saved." });
    return;
  }
  response.json({ coins: await addCoins(user.id, parsed.data.delta) });
});

// ---------------------------------------------------------------- drafts

/** Problems started and not solved, for Continue Solving. Signed-in only. */
app.get("/api/unfinished", async (request, response) => {
  const user = await userForToken(authToken(request.headers.authorization));
  response.json({ problems: user ? await unfinishedFor(user.id) : [] });
});

app.get("/api/drafts/:problemId", async (request, response) => {
  const user = await userForToken(authToken(request.headers.authorization));
  response.json({ draft: user ? await draftFor(user.id, String(request.params.problemId)) : null });
});

app.put("/api/drafts/:problemId", async (request, response) => {
  const user = await userForToken(authToken(request.headers.authorization));
  if (!user) {
    response.status(401).json({ message: "Sign in to keep drafts." });
    return;
  }
  const problemId = String(request.params.problemId);
  if (!await findProblem(problemId)) {
    response.status(404).json({ message: "We couldn't find that problem. Pick one from the problem list." });
    return;
  }
  const parsed = draftSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: parsed.error.issues[0]?.message ?? "That draft could not be saved." });
    return;
  }
  response.json({ draft: await saveDraft(user.id, problemId, parsed.data.language, parsed.data.code) });
});

/** Opening a problem: it counts as started from now, typed in or not. */
app.post("/api/drafts/:problemId/touch", async (request, response) => {
  const user = await userForToken(authToken(request.headers.authorization));
  if (!user) {
    response.json({ ok: false });
    return;
  }
  const problemId = String(request.params.problemId);
  const parsed = touchSchema.safeParse(request.body ?? {});
  if (!(await findProblem(problemId)) || !parsed.success) {
    response.status(400).json({ message: "That draft could not be saved. Reload the page and try again." });
    return;
  }
  await touchDraft(user.id, problemId, parsed.data.language, parsed.data.at);
  response.json({ ok: true });
});

/** Problems opened on this device while signed out, carried over on sign-in. */
app.post("/api/drafts/sync", async (request, response) => {
  const user = await userForToken(authToken(request.headers.authorization));
  if (!user) {
    response.status(401).json({ message: "Sign in to keep your place across devices." });
    return;
  }
  const parsed = syncSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid request." });
    return;
  }
  let kept = 0;
  for (const entry of parsed.data.entries) {
    // A problem the server no longer has is skipped rather than failing the batch.
    if (!await findProblem(entry.problemId)) continue;
    await touchDraft(user.id, entry.problemId, entry.language, entry.at);
    kept += 1;
  }
  response.json({ ok: true, kept });
});

app.delete("/api/drafts/:problemId", async (request, response) => {
  const user = await userForToken(authToken(request.headers.authorization));
  if (user) await clearDraft(user.id, String(request.params.problemId));
  response.json({ ok: true });
});

// ---------------------------------------------------------------- classrooms

type ClassroomUser = NonNullable<Awaited<ReturnType<typeof userForToken>>>;
type ClassroomHandler = (user: ClassroomUser, request: express.Request) => Promise<unknown>;

/** Classroom routes need a signed-in user and turn ClassroomError into its status code. */
const classroomRoute =
  (handler: ClassroomHandler): express.RequestHandler =>
  async (request, response) => {
    const user = await userForToken(authToken(request.headers.authorization));
    if (!user) {
      response.status(401).json({ message: "Sign in to use classrooms." });
      return;
    }
    try {
      response.json(await handler(user, request));
    } catch (error) {
      if (error instanceof ClassroomError) {
        response.status(error.status).json({ message: error.message });
        return;
      }
      if (error instanceof z.ZodError) {
        response.status(400).json({ message: error.issues[0]?.message ?? "Invalid request." });
        return;
      }
      throw error;
    }
  };

const param = (request: express.Request, name: string) => String(request.params[name]);

app.get("/api/classrooms", classroomRoute(async (user) => ({ classrooms: await listClassrooms(user) })));
app.post(
  "/api/classrooms",
  classroomRoute((user, request) => createClassroom(user, classroomNameSchema.parse(request.body).name))
);
app.post(
  "/api/classrooms/join",
  classroomRoute((user, request) => joinClassroom(user, joinSchema.parse(request.body).code))
);
app.get("/api/classrooms/:id", classroomRoute((user, request) => getClassroom(user, param(request, "id"))));
app.patch(
  "/api/classrooms/:id",
  classroomRoute((user, request) =>
    renameClassroom(user, param(request, "id"), classroomNameSchema.parse(request.body).name)
  )
);
app.delete("/api/classrooms/:id", classroomRoute((user, request) => deleteClassroom(user, param(request, "id"))));
app.put(
  "/api/classrooms/:id/assignments",
  classroomRoute((user, request) =>
    setAssignments(user, param(request, "id"), assignmentsSchema.parse(request.body).problemIds)
  )
);
app.post(
  "/api/classrooms/:id/join-code",
  classroomRoute((user, request) => rotateJoinCode(user, param(request, "id")))
);
app.delete(
  "/api/classrooms/:id/members/:memberId",
  classroomRoute((user, request) => removeMember(user, param(request, "id"), param(request, "memberId")))
);
