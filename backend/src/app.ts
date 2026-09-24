import cors from "cors";
import express from "express";
import { z } from "zod";
import { AuthError, completePasswordReset, signIn, signOut, signUp, startPasswordReset, userForToken } from "./auth/store.js";
import { appUrl, emailsEnabled, sendEmail } from "./auth/email.js";
import { dsaSummary } from "./problems/metadata.js";
import { getProblem, problems, publicProblem } from "./problems/seeds.js";
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
import { AskError, MAX_QUESTION, answerQuestion, askEnabled, withinRateLimit } from "./ask/deepseek.js";

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

const authToken = (header: string | undefined) => {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length);
};

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const sandboxEnabled = process.env.NOESIS_SANDBOX !== "off";
const accountsEnabled = process.env.NOESIS_ACCOUNTS !== "off";
const accountsOff = (response: express.Response) =>
  response.status(503).json({
    message: "Accounts are not available on this deployment yet. Run Noesis locally to sign up and save progress."
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

const askSchema = z.object({
  question: z.string().trim().min(3).max(MAX_QUESTION)
});

/**
 * One visitor question, answered by DeepSeek. Public and metered: see
 * ask/deepseek.ts for the bounds. The key never leaves the server.
 */
app.post("/api/ask", async (request, response) => {
  const parsed = askSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      message: `Ask a question between 3 and ${MAX_QUESTION} characters.`
    });
    return;
  }

  if (!askEnabled()) {
    response.status(503).json({ message: "Questions are not enabled on this deployment." });
    return;
  }

  const caller = String(
    request.headers["x-forwarded-for"] ?? request.socket.remoteAddress ?? "unknown"
  ).split(",")[0].trim();

  if (!withinRateLimit(caller)) {
    response.status(429).json({ message: "That is a lot of questions. Try again in a few minutes." });
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

app.get("/api/problems", (_request, response) => {
  response.json(problemIndex);
});

app.get("/api/problems/:id", (request, response) => {
  const problem = getProblem(request.params.id);
  if (!problem) {
    response.status(404).json({ message: "Problem not found." });
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
    response.status(400).json({ message: parsed.error.message });
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
    response.status(400).json({ message: parsed.error.message });
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
    response.status(400).json({ message: parsed.error.message });
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
    response.status(400).json({ message: parsed.error.message });
    return;
  }

  const problem = getProblem(parsed.data.problemId);
  if (!problem) {
    response.status(404).json({ message: "Problem not found." });
    return;
  }

  if (parsed.data.input) {
    const invalid = validateCustomInput(problem, parsed.data.input);
    if (invalid) {
      response.status(400).json({ message: `Custom input: ${invalid}` });
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
    response.status(400).json({ message: parsed.error.message });
    return;
  }

  const problem = getProblem(parsed.data.problemId);
  if (!problem) {
    response.status(404).json({ message: "Problem not found." });
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
        execution: { ok: false, errorType: "Platform Error", message: `Custom input: ${invalid}` }
      });
      return;
    }
  }

  response.json(await previewProblem(problem, parsed.data.code, parsed.data.language, parsed.data.input));
});

app.post("/api/expected", async (request, response) => {
  const parsed = expectedSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: parsed.error.message });
    return;
  }

  const problem = getProblem(parsed.data.problemId);
  if (!problem) {
    response.status(404).json({ message: "Problem not found." });
    return;
  }

  const invalid = validateCustomInput(problem, parsed.data.input);
  if (invalid) {
    response.json({ ok: false, message: `Custom input: ${invalid}` });
    return;
  }

  response.json(await expectedOutput(problem, parsed.data.input));
});

app.post("/api/test", async (request, response) => {
  const parsed = codeSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: parsed.error.message });
    return;
  }

  const problem = getProblem(parsed.data.problemId);
  if (!problem) {
    response.status(404).json({ message: "Problem not found." });
    return;
  }

  response.json(await testProblem(problem, parsed.data.code, parsed.data.language));
});

app.post("/api/submit", async (request, response) => {
  const parsed = codeSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: parsed.error.message });
    return;
  }

  const problem = getProblem(parsed.data.problemId);
  if (!problem) {
    response.status(404).json({ message: "Problem not found." });
    return;
  }

  const user = await userForToken(authToken(request.headers.authorization));
  response.json(await submitProblem(problem, parsed.data.code, user?.id, parsed.data.language));
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
