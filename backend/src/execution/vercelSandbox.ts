import crypto from "node:crypto";
import { Sandbox } from "@vercel/sandbox";
import type { Language } from "@nodeflow/shared";
import type { RawRunnerError, RunnerPayload } from "./dockerRunner.js";
import { platformFailure } from "./messages.js";

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

/**
 * The warm sandbox is cached per server instance, but it does not live
 * forever: a session ends after SESSION_MS, and the provider then answers
 * "not found" (404) for it, or says it is stopped or cannot be resumed.
 * Before, only the last two were recognised, so an expired sandbox reached
 * learners as a raw "Status code 404" on every run until the instance died.
 * Now any sign that it is gone drops the cached handle and fetches or makes a
 * fresh one by name (getOrCreate handles not_found and stale snapshots).
 */
const GONE = /no snapshot|cannot resume|snapshot_not_found|not running|stopped|not.?found|\b404\b|\b410\b|expired|terminated|gone/i;
/** Worth one more try on a fresh handle: the network or the provider hiccuped. */
const TRANSIENT = /\b5\d\d\b|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed|network|timeout|conflict|\b409\b/i;
/** Not worth retrying: retrying would fail the same way. */
const FINAL = /quota|limit exceeded|payment|forbidden|\b401\b|\b403\b/i;

let warm: Promise<Sandbox> | null = null;

const fresh = (): Promise<Sandbox> => {
  const creating = Sandbox.getOrCreate(settings());
  warm = creating.catch((error: unknown) => {
    warm = null;
    throw error;
  });
  return warm;
};

const sandbox = (): Promise<Sandbox> => warm ?? fresh();
/** One replacement at a time per instance, shared by every run waiting on it. */
let replacing: Promise<Sandbox> | null = null;

/**
 * A brand-new sandbox under the same name. A stopped, non-persistent sandbox
 * still exists by name but has nothing to resume, so fetching it again by
 * name hands back the same dead one; it has to be deleted and made anew.
 */
const replace = (): Promise<Sandbox> => {
  const creating = (async () => {
    try {
      const stale = await Sandbox.get({ name: NAME, resume: false, ...credentials() });
      await stale.delete();
    } catch {
      // Already gone: nothing to clear away.
    }
    return Sandbox.create(settings());
  })();
  warm = creating.catch((error: unknown) => {
    warm = null;
    throw error;
  });
  return warm;
};

/**
 * Runs `action`, once more if the first attempt failed for a reason a retry
 * can fix: on a replaced sandbox if it was gone, on a fresh handle if the
 * network or the provider hiccuped.
 */
const withSandbox = async <R>(action: (box: Sandbox) => Promise<R>): Promise<R> => {
  try {
    return await action(await sandbox());
  } catch (error) {
    const text = String(error instanceof Error ? error.message : error);
    if (FINAL.test(text)) throw error;
    if (GONE.test(text)) {
      // Another server instance may already have replaced it, so look it up
      // by name first; replace it only if that one is dead too. Replacing
      // straight away would have instances deleting each other's fresh one.
      warm = null;
      try {
        return await action(await fresh());
      } catch (again) {
        const still = String(again instanceof Error ? again.message : again);
        if (!GONE.test(still)) throw again;
        console.warn(`[run] sandbox gone, replacing it: ${still.slice(0, 200)}`);
        return action(await (replacing ??= replace().finally(() => (replacing = null))));
      }
    }
    if (TRANSIENT.test(text)) {
      console.warn(`[run] sandbox call failed, retrying on a fresh handle: ${text.slice(0, 200)}`);
      warm = null;
      return action(await fresh());
    }
    throw error;
  }
};

/** Reads the harness response: the last JSON line the command printed. */
const parseResponse = <T>(stdout: string): T | RawRunnerError => {
  const line = stdout
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .at(-1);
  if (!line) return platformFailure("sandbox", "no output");
  try {
    return JSON.parse(line) as T;
  } catch {
    return platformFailure("sandbox", `output was not a result: ${line.slice(0, 200)}`);
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
      return platformFailure(`sandbox command (${language})`, `exit ${result.exitCode}: ${stderr}`);
    }
    return parseResponse<T>(await result.stdout());
  } catch (error) {
    return platformFailure(`sandbox (${language}, image ${IMAGE})`, error);
  }
};
