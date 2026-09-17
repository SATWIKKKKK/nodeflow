import cors from "cors";
import express from "express";
import { z } from "zod";
import { recordResetRequest, signIn, signOut, signUp, userForToken } from "./auth/store.js";
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
    queue: queueSnapshot()
  });
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

app.post("/api/auth/signup", (request, response) => {
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
    response.json(signUp(parsed.data.email, parsed.data.password));
  } catch (error) {
    response.status(409).json({ message: error instanceof Error ? error.message : "Sign up failed." });
  }
});

app.post("/api/auth/signin", (request, response) => {
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
    response.json(signIn(parsed.data.email, parsed.data.password));
  } catch (error) {
    response.status(401).json({ message: error instanceof Error ? error.message : "Sign in failed." });
  }
});

app.get("/api/auth/me", (request, response) => {
  response.json({ user: userForToken(authToken(request.headers.authorization)) });
});

app.get("/api/progress", (request, response) => {
  response.json(progressForUser(userForToken(authToken(request.headers.authorization))));
});

app.post("/api/auth/signout", (request, response) => {
  signOut(authToken(request.headers.authorization));
  response.json({ ok: true });
});

app.post("/api/auth/reset", (request, response) => {
  const parsed = resetSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: parsed.error.message });
    return;
  }

  recordResetRequest(parsed.data.email);
  response.json({ ok: true });
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

  const user = userForToken(authToken(request.headers.authorization));
  response.json(await submitProblem(problem, parsed.data.code, user?.id, parsed.data.language));
});

// ---------------------------------------------------------------- classrooms

type ClassroomHandler = (user: NonNullable<ReturnType<typeof userForToken>>, request: express.Request) => unknown;

/** Classroom routes need a signed-in user and turn ClassroomError into its status code. */
const classroomRoute =
  (handler: ClassroomHandler): express.RequestHandler =>
  (request, response) => {
    const user = userForToken(authToken(request.headers.authorization));
    if (!user) {
      response.status(401).json({ message: "Sign in to use classrooms." });
      return;
    }
    try {
      response.json(handler(user, request));
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

app.get("/api/classrooms", classroomRoute((user) => ({ classrooms: listClassrooms(user) })));
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
