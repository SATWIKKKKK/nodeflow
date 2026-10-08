import { useEffect, useRef, useState } from "react";

/**
 * Day arithmetic for the activity calendar. Days are "YYYY-MM-DD" keys in
 * the viewer's time zone (the server buckets submissions with the same zone),
 * and all date maths happens on those keys at UTC noon, so no daylight-saving
 * shift can move a day.
 */

export const DAY_MS = 86_400_000;

export const keyOf = (date: Date) => date.toISOString().slice(0, 10);

export const dateOf = (key: string) => new Date(`${key}T12:00:00Z`);

export const addDays = (key: string, days: number) => keyOf(new Date(dateOf(key).getTime() + days * DAY_MS));

/** Today in the viewer's own calendar. */
export const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export interface Span {
  start: string;
  end: string;
}

/** "current" is the past year ending today, as LeetCode shows it; a year is January to December. */
export const spanFor = (choice: string): Span => {
  if (choice === "current") {
    const end = todayKey();
    return { start: addDays(end, -364), end };
  }
  return { start: `${choice}-01-01`, end: `${choice}-12-31` };
};

export interface Activity {
  submissions: number;
  activeDays: number;
  maxStreak: number;
  /** Days in a row up to today (or yesterday, with today still to come). */
  currentStreak: number;
}

export const activityIn = (calendar: Record<string, number>, span: Span): Activity => {
  let submissions = 0;
  let activeDays = 0;
  let run = 0;
  let maxStreak = 0;
  for (let key = span.start; key <= span.end; key = addDays(key, 1)) {
    const count = calendar[key] ?? 0;
    submissions += count;
    if (count > 0) {
      activeDays += 1;
      run += 1;
      maxStreak = Math.max(maxStreak, run);
    } else {
      run = 0;
    }
  }
  const today = todayKey();
  let currentStreak = 0;
  let key = (calendar[today] ?? 0) > 0 ? today : addDays(today, -1);
  while ((calendar[key] ?? 0) > 0) {
    currentStreak += 1;
    key = addDays(key, -1);
  }
  return { submissions, activeDays, maxStreak, currentStreak };
};

const reduced = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/** A number that counts up to its value when it first appears, then follows it. */
export function useCountUp(target: number, duration = 750) {
  const [shown, setShown] = useState(() => (reduced() ? target : 0));
  const from = useRef(shown);
  useEffect(() => {
    if (reduced()) {
      setShown(target);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const value = origin + (target - origin) * eased;
      from.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return shown;
}
