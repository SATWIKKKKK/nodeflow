import cors from "cors";
import express from "express";
import { z } from "zod";
import { recordResetRequest, signIn, signOut, signUp, userForToken } from "./auth/store.js";
import { dsaSummary } from "./problems/metadata.js";
import { getProblem, problems, publicProblem } from "./problems/seeds.js";
import { previewProblem, runProblemCase, submitProblem, testProblem } from "./execution/service.js";
import { queueSnapshot } from "./execution/queue.js";
import { progressForUser } from "./progress/summary.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);

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

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "noesis-backend", queue: queueSnapshot() });
});

app.get("/api/dsa-summary", (_request, response) => {
  response.json(dsaSummary());
});

app.get("/api/problems", (_request, response) => {
  response.json(problems.map(publicProblem));
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

  const input = parsed.data.input ?? problem.defaultInput;
  const result = await runProblemCase(problem, parsed.data.code, input, {
    language: parsed.data.language
  });
  response.json(result);
});

app.post("/api/live-preview", async (request, response) => {
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

  response.json(await previewProblem(problem, parsed.data.code, parsed.data.language));
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

app.listen(port, () => {
  console.log(`Noesis backend listening on http://localhost:${port}`);
});
