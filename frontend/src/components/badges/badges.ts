import type { Badge } from "@nodeflow/shared";
import { tierName } from "./BadgeEmblem";

/** Every tier reached counts as a badge: a bronze then a silver Solver is two. */
export const earnedCount = (badges: Badge[]) => badges.reduce((sum, badge) => sum + badge.tier, 0);

/** The badges reached most recently, newest first. */
export const recentBadges = (badges: Badge[], count = 3) =>
  badges
    .filter((badge) => badge.tier > 0 && badge.earnedAt)
    .sort((left, right) => Date.parse(right.earnedAt!) - Date.parse(left.earnedAt!))
    .slice(0, count);

export const isComplete = (badge: Badge) => badge.tier >= badge.thresholds.length;

/** How far towards its next tier, 0 to 1. */
export const progressOf = (badge: Badge) =>
  isComplete(badge) ? 1 : Math.min(1, badge.value / Math.max(1, badge.thresholds[badge.tier]));

/**
 * The locked tier closest to being reached: what the dashboard offers as
 * "next". Earlier months are history, not goals, so only this month's counts.
 */
export const nextBadge = (badges: Badge[], thisMonth: string) => {
  const open = badges.filter(
    (badge) => !isComplete(badge) && (badge.family !== "monthly" || badge.id === `month-${thisMonth}`)
  );
  return open.sort((left, right) => progressOf(right) - progressOf(left) || left.thresholds[left.tier] - right.thresholds[right.tier])[0];
};

/** "Solver Silver", or just the name for a one-step badge. */
export const titleOf = (badge: Badge, tier = badge.tier) => {
  const name = tierName(tier, badge.thresholds.length);
  return name ? `${badge.name} ${name}` : badge.name;
};

/** "27 / 50 solved" towards the next tier. */
export const progressText = (badge: Badge) => {
  const value = Number.isInteger(badge.value) ? badge.value : badge.value.toFixed(1);
  if (isComplete(badge)) return `${value} ${badge.unit}`;
  return `${value} / ${badge.thresholds[badge.tier]} ${badge.unit}`;
};

/** "month-2026-10" → "Oct". */
export const monthLabel = (id: string) =>
  new Date(`${id.slice(6)}-01T12:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" });

export const emblemLabel = (badge: { id: string }) => (badge.id.startsWith("month-") ? monthLabel(badge.id) : undefined);

const earnedFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
export const earnedOn = (badge: Badge) => (badge.earnedAt ? earnedFormat.format(new Date(badge.earnedAt)) : "");
