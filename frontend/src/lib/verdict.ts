import type { JudgeVerdict } from "@nodeflow/shared";

/**
 * One colour per kind of outcome, everywhere a verdict is shown: blue for
 * solved, red for code that failed, amber for code that ran out of room. The
 * classes are theme-aware (index.css), so each reads in light and dark.
 */
export const verdictTone = (verdict: JudgeVerdict | "Solved" | string | undefined) => {
  if (!verdict) return "border-blueprint-line text-blueprint-muted";
  if (verdict === "Accepted" || verdict === "Solved") return "status-solved";
  if (verdict === "Time Limit Exceeded" || verdict === "Execution Limit") return "status-warning";
  return "status-error";
};
