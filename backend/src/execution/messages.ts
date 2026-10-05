import type { RawRunnerError } from "./dockerRunner.js";

/**
 * What a learner is told when Noesis, not their code, failed to run.
 *
 * One calm sentence for every infrastructure failure: they cannot act on a
 * container exit code or a provider's 404, and seeing one reads as a broken
 * product. The detail still matters to whoever fixes it, so it is logged,
 * with the context it happened in, before it is replaced.
 */
export const RUN_UNAVAILABLE =
  "We couldn't run your code just now. This is a problem on our side, not with your code. Please try again in a moment.";

export const platformFailure = (context: string, detail: unknown): RawRunnerError => {
  const text = detail instanceof Error ? detail.stack ?? detail.message : String(detail);
  console.error(`[run] ${context}: ${text}`);
  return { ok: false, errorType: "Platform Error", message: RUN_UNAVAILABLE };
};
