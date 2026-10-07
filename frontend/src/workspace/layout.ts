import { useCallback, useEffect, useState } from "react";

/**
 * How the workspace is divided on a desktop, remembered between visits the
 * way LeetCode remembers it: the trace's share of the width, and the problem's
 * and the console's share of the right column's height. The editor takes
 * whatever is left. Fractions rather than pixels, so a layout set on one
 * window still makes sense on another.
 */
export interface WorkspaceLayout {
  /** The trace panel's share of the width. */
  split: number;
  /** The problem panel's share of the right column. */
  problem: number;
  /** The console's (tests, results, input, notes) share of the right column. */
  console: number;
}

export const DEFAULT_LAYOUT: WorkspaceLayout = { split: 0.5, problem: 0.32, console: 0.35 };

const KEY = "noesis:workspace-layout";

export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

const read = (): WorkspaceLayout => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<WorkspaceLayout> | null;
    if (!saved) return DEFAULT_LAYOUT;
    const pick = (value: unknown, fallback: number) =>
      typeof value === "number" && Number.isFinite(value) ? value : fallback;
    return {
      split: clamp(pick(saved.split, DEFAULT_LAYOUT.split), 0.22, 0.78),
      problem: clamp(pick(saved.problem, DEFAULT_LAYOUT.problem), 0.1, 0.7),
      console: clamp(pick(saved.console, DEFAULT_LAYOUT.console), 0.12, 0.7)
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
};

export function useWorkspaceLayout() {
  const [layout, setLayout] = useState<WorkspaceLayout>(read);

  // Written after a drag settles rather than on every pointer move.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(layout));
      } catch {
        // The layout only lasts this visit.
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [layout]);

  const update = useCallback((patch: Partial<WorkspaceLayout>) => setLayout((current) => ({ ...current, ...patch })), []);
  return [layout, update] as const;
}

/** Panels a learner can blow up to fill the workspace. */
export type PanelId = "trace" | "problem" | "code" | "console";
