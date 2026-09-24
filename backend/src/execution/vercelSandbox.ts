import crypto from "node:crypto";
import { Sandbox } from "@vercel/sandbox";
import type { Language } from "@nodeflow/shared";
import type { RawRunnerError, RunnerPayload } from "./dockerRunner.js";

/**
 * Runs a harness inside Vercel Sandbox instead of Docker, for deployments (like
 * Vercel) that cannot start containers. One warm microVM serves every run:
 *
 *  - it boots from the image built by backend/docker/vercel/Dockerfile, which
 *    holds all three harnesses (see scripts/push-sandbox-image.mjs),
 *  - `networkPolicy: deny-all` means code inside has no network at all,
 *  - each run gets a throwaway Linux user and directory (see nf-run), so runs
 *    cannot read each other's code, and every process is killed afterwards.
 *
 * A stopped sandbox resumes on the next command, so the warm instance survives
 * idle periods between sessions.
 */

const IMAGE = process.env.NOESIS_SANDBOX_IMAGE ?? "noesis-runner:latest";
/** One sandbox per image, so a new image never reuses the old filesystem. */
const NAME = process.env.NOESIS_SANDBOX_NAME ?? `noesis-${IMAGE.replace(/[^a-zA-Z0-9]+/g, "-")}`;
const SESSION_MS = Number(process.env.NOESIS_SANDBOX_SESSION_MS ?? 15 * 60_000);
const VCPUS = Number(process.env.NOESIS_SANDBOX_VCPUS ?? 2);

const platformError = (message: string): RawRunnerError => ({ ok: false, errorType: "Platform Error", message });

/** Explicit credentials for environments without an OIDC token (optional). */
const credentials = () => {
  const token = process.env.NOESIS_VERCEL_TOKEN;
  const teamId = process.env.NOESIS_VERCEL_TEAM_ID ?? process.env.VERCEL_TEAM_ID;
  const projectId = process.env.NOESIS_VERCEL_PROJECT_ID ?? process.env.VERCEL_PROJECT_ID;
  return token && teamId && projectId ? { token, teamId, projectId } : {};
};

const settings = () => ({
  name: NAME,
  image: IMAGE as string,
  // The harnesses need no network; this also stops anything a learner writes.
  networkPolicy: "deny-all" as const,
  resources: { vcpus: VCPUS },
  timeout: SESSION_MS,
  // The image carries everything, so a session never needs a restored filesystem.
  persistent: false,
  ...credentials()
});

/** A stopped non-persistent sandbox has nothing to resume; it is replaced instead. */
const GONE = /no snapshot|cannot resume|snapshot_not_found|not running|stopped/i;

let warm: Promise<Sandbox> | null = null;

const track = (creating: Promise<Sandbox>) => {
  warm = creating.catch((error: unknown) => {
    warm = null;
    throw error;
  });
  return warm;
};

const sandbox = (): Promise<Sandbox> => warm ?? track(Sandbox.getOrCreate(settings()));

const replaceSandbox = (): Promise<Sandbox> =>
  track(
    (async () => {
      try {
        const stale = await Sandbox.get({ name: NAME, resume: false, ...credentials() });
        await stale.delete();
      } catch {
        // Nothing to clear away.
      }
      return Sandbox.create(settings());
    })()
  );

/** Runs `action`, replacing a sandbox that can no longer be resumed. */
const withSandbox = async <R>(action: (box: Sandbox) => Promise<R>): Promise<R> => {
  try {
    return await action(await sandbox());
  } catch (error) {
    if (!GONE.test(String(error))) throw error;
    return action(await replaceSandbox());
  }
};

const describe = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (/quota|limit/i.test(message)) {
    return "The Vercel Sandbox quota for this account is used up, so code cannot run right now.";
  }
  if (/image_not_ready|not_found/i.test(message)) {
    return `The sandbox image (${IMAGE}) is not ready yet. Push it with scripts/push-sandbox-image.mjs.`;
  }
  return `The sandbox could not run this: ${message}`;
};

/** Reads the harness response: the last JSON line the command printed. */
const parseResponse = <T>(stdout: string): T | RawRunnerError => {
  const line = stdout
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .at(-1);
  if (!line) return platformError("The sandbox returned no output.");
  try {
    return JSON.parse(line) as T;
  } catch {
    return platformError("The sandbox returned output that was not a result.");
  }
};

export const runInVercelSandbox = async <T>(
  payload: RunnerPayload,
  timeoutMs: number,
  language: Language
): Promise<T | RawRunnerError> => {
  const id = crypto.randomBytes(8).toString("hex");
  const seconds = Math.max(2, Math.ceil(timeoutMs / 1000));
  const inputPath = `/vercel/in/${id}.json`;

  const attempt = async (box: Sandbox) => {
    await box.writeFiles([{ path: inputPath, content: Buffer.from(JSON.stringify(payload)), mode: 0o600 }]);
    return box.runCommand({
      cmd: "bash",
      args: ["-c", `nf-run ${language} ${id} ${seconds} < ${inputPath}; rm -f ${inputPath}`],
      sudo: true,
      timeoutMs: timeoutMs + 15_000
    });
  };

  try {
    const result = await withSandbox(attempt);

    if (result.exitCode !== 0) {
      const stderr = (await result.stderr()).slice(-400);
      return platformError(`The sandbox command failed (exit ${result.exitCode}). ${stderr}`.trim());
    }
    return parseResponse<T>(await result.stdout());
  } catch (error) {
    return platformError(describe(error));
  }
};
