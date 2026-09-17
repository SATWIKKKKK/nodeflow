import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Language, ProblemParameter, ProblemSignature, TraceStep } from "@nodeflow/shared";
import { configFor, type LanguageConfig } from "./languages.js";
import { backendRoot } from "../paths.js";

export interface RunnerPayload {
  code: string;
  entrypoint: string;
  parameters: ProblemParameter[];
  returnKind: ProblemSignature["returnKind"];
  sharedTail?: string;
  design?: ProblemSignature["design"];
  /** Single-case mode (Run / live preview). */
  input?: Record<string, unknown>;
  /** Batch mode (Test / Submit): one untraced result per case. */
  cases?: Array<{ input: Record<string, unknown> }>;
  trace?: boolean;
  stepLimit: number;
  /** Live preview: stop at stepLimit instead of finishing the run untraced (Python). */
  stopAtStepLimit?: boolean;
  visualizeLimit: number;
  caseTimeoutMs?: number;
}

type ErrorType =
  | "Compile Error"
  | "Runtime Error"
  | "Sandbox Violation"
  | "Execution Limit"
  | "Time Limit Exceeded"
  | "Platform Error";

export interface RawRunnerError {
  ok: false;
  errorType: ErrorType;
  message: string;
  traceback?: string;
  stdout?: string;
  runtimeMs?: number;
  trace?: TraceStep[];
  heapMode?: "delta" | "full";
  line?: number;
}

export interface RawRunnerSuccess {
  ok: true;
  result: unknown;
  stdout: string;
  runtimeMs: number;
  trace: TraceStep[];
  stepsCaptured: number;
  traceTruncated?: boolean;
  heapMode?: "delta" | "full";
  traceNote?: string;
}

export type RawRunnerResponse = RawRunnerSuccess | RawRunnerError;

/** Batch mode: every case's own outcome, or one error that stopped them all (e.g. compile). */
export type RawBatchResponse =
  | { ok: true; cases: Array<RawRunnerSuccess | RawRunnerError> }
  | RawRunnerError;

/** Images are checked (and built if missing) once per process, per content hash. */
const readyImages = new Set<string>();

const filesUnder = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "__pycache__" ? [] : filesUnder(full);
      return [full];
    })
    .sort();
};

/**
 * The image tag carries a hash of the Dockerfile and every harness file it
 * copies, so editing a tracer rebuilds the sandbox instead of silently running
 * a stale image.
 */
const imageTag = (config: LanguageConfig) => {
  const hash = crypto.createHash("sha1");
  const inputs = [config.dockerfile, ...config.contextFiles.flatMap((entry) => filesUnder(path.join(backendRoot, entry)))];
  for (const file of inputs) {
    hash.update(file.replace(backendRoot, ""));
    hash.update(fs.readFileSync(file));
  }
  return `${config.image}:${hash.digest("hex").slice(0, 12)}`;
};

const tagCache = new Map<string, string>();

const ensureImage = (config: LanguageConfig): string => {
  const tag = tagCache.get(config.id) ?? imageTag(config);
  tagCache.set(config.id, tag);
  if (readyImages.has(tag)) return tag;

  const exists = spawnSync("docker", ["image", "inspect", tag], { stdio: "ignore" });
  if (exists.status !== 0) {
    const build = spawnSync("docker", ["build", "-t", tag, "-f", config.dockerfile, backendRoot], {
      stdio: "inherit"
    });

    if (build.status !== 0) {
      throw new Error(`Docker sandbox image for ${config.id} could not be built.`);
    }
  }

  readyImages.add(tag);
  return tag;
};

export const runInDocker = async <T = RawRunnerResponse>(
  payload: RunnerPayload,
  timeoutMs?: number,
  language: Language = "python"
): Promise<T | RawRunnerError> => {
  if (process.env.NOESIS_SANDBOX === "off") {
    // Hosted builds without Docker (e.g. the Vercel preview) answer every run the same way.
    return {
      ok: false,
      errorType: "Platform Error",
      message:
        "This deployment has no code sandbox, so Run, Test and Submit are unavailable here. Run Noesis locally with Docker to execute code."
    };
  }
  const config = configFor(language);
  const effectiveTimeout = timeoutMs ?? config.timeoutMs;

  let tag: string;
  try {
    tag = ensureImage(config);
  } catch (error) {
    return {
      ok: false,
      errorType: "Platform Error",
      message: error instanceof Error ? error.message : "Docker sandbox is unavailable."
    };
  }

  return new Promise<T | RawRunnerError>((resolve) => {
    const started = performance.now();
    const child = spawn(
      "docker",
      [
        "run",
        "--rm",
        "-i",
        "--network",
        "none",
        "--memory",
        config.memoryLimit,
        "--cpus",
        "1",
        "--pids-limit",
        String(config.pidsLimit),
        "--read-only",
        "--tmpfs",
        config.tmpfs,
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        ...config.extraRunArgs,
        tag
      ],
      {
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve({
        ok: false,
        errorType: "Time Limit Exceeded",
        message: "The sandbox timed out before your code finished.",
        runtimeMs: Math.round(performance.now() - started)
      });
    }, effectiveTimeout);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (stdout.length > 8_000_000) {
        stdout = stdout.slice(-8_000_000);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 1_000_000) {
        stderr = stderr.slice(-1_000_000);
      }
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        errorType: "Platform Error",
        message: error.message
      });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        resolve({
          ok: false,
          errorType: "Platform Error",
          message: stderr.trim() || `Sandbox exited with code ${code}.`,
          runtimeMs: Math.round(performance.now() - started)
        });
        return;
      }

      try {
        resolve(JSON.parse(stdout) as T);
      } catch {
        resolve({
          ok: false,
          errorType: "Platform Error",
          message: "Sandbox returned malformed JSON.",
          traceback: stderr || stdout,
          runtimeMs: Math.round(performance.now() - started)
        });
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
};
