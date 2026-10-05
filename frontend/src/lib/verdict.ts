import type { JudgeVerdict } from "@nodeflow/shared";

/**
 * One colour per kind of outcome, everywhere a verdict is shown: blue for
 * solved, red for code that failed, amber for code that ran out of room. The
 * classes are theme-aware (index.css), so each reads in light and dark.
 */
/**
 * A verdict in the learner's words. The internal names stay as they are (the
 * judge and the records use them); only what is shown changes, so "Platform
 * Error" never appears on screen as if the learner had caused it.
 */
export const verdictLabel = (verdict: JudgeVerdict | "Solved" | string | undefined) => {
  if (verdict === "Platform Error") return "Couldn't run";
  if (verdict === "Sandbox Violation") return "Not allowed";
  if (verdict === "Execution Limit") return "Step limit";
  return verdict ?? "";
};

export const verdictTone = (verdict: JudgeVerdict | "Solved" | string | undefined) => {
  if (!verdict) return "border-blueprint-line text-blueprint-muted";
  if (verdict === "Platform Error") return "status-warning";
  if (verdict === "Accepted" || verdict === "Solved") return "status-solved";
  if (verdict === "Time Limit Exceeded" || verdict === "Execution Limit") return "status-warning";
  return "status-error";
};
