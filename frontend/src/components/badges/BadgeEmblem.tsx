import { useId } from "react";
import {
  Brackets,
  CalendarDays,
  CircleCheckBig,
  Coins,
  Crosshair,
  Flame,
  Grid3x3,
  Hash,
  Languages,
  Layers,
  Link,
  ListTree,
  Mountain,
  MountainSnow,
  Network,
  RefreshCcw,
  Rows3,
  Sigma,
  Sparkles,
  Target,
  Triangle,
  Type,
  Waypoints,
  type LucideIcon
} from "lucide-react";
import { BADGE_TIERS } from "@nodeflow/shared";
import { cn } from "../../lib/cn";

/**
 * A badge as a hexagonal medal: a metal rim for its tier (bronze, silver,
 * gold, platinum), a soft face from the same material as the rest of the
 * app, and the badge's mark in the middle. A locked badge is the outline
 * only, the way LeetCode greys out the ones still to win.
 */

const ICONS: Record<string, LucideIcon> = {
  spark: Sparkles,
  check: CircleCheckBig,
  mountain: Mountain,
  peak: MountainSnow,
  flame: Flame,
  calendar: CalendarDays,
  target: Target,
  rebound: RefreshCcw,
  crosshair: Crosshair,
  languages: Languages,
  coin: Coins,
  "topic-array": Brackets,
  "topic-string": Type,
  "topic-matrix": Grid3x3,
  "topic-linked_list": Link,
  "topic-stack": Layers,
  "topic-queue": Rows3,
  "topic-hashmap": Hash,
  "topic-tree": Network,
  "topic-heap": Triangle,
  "topic-graph": Waypoints,
  "topic-trie": ListTree,
  "topic-number": Sigma
};

/** Rim colours, light to dark, per tier; index 0 is a one-step badge. */
const METALS: Array<{ hi: string; lo: string; ink: string }> = [
  { hi: "#8fb4ff", lo: "#2d58bc", ink: "#2d58bc" },
  { hi: "#e3a77a", lo: "#8c4f24", ink: "#a0582a" },
  { hi: "#eef1f5", lo: "#8b94a3", ink: "#6b7482" },
  { hi: "#ffe08a", lo: "#b8860b", ink: "#a8790a" },
  { hi: "#d6f4ff", lo: "#6a8fd8", ink: "#4f74c4" }
];

export const tierName = (tier: number, tiers: number) => (tiers > 1 && tier > 0 ? BADGE_TIERS[tier - 1] : "");

/** A one-step badge is Noesis blue; a tiered one takes its tier's metal. */
export const metalFor = (tier: number, tiers: number) => METALS[tiers > 1 ? Math.min(Math.max(tier, 1), 4) : 0];

const HEX = "M50 3 L91 26.5 L91 73.5 L50 97 L9 73.5 L9 26.5 Z";
const HEX_INNER = "M50 13 L82.5 31.5 L82.5 68.5 L50 87 L17.5 68.5 L17.5 31.5 Z";

export function BadgeEmblem({
  icon,
  tier,
  tiers,
  size = 56,
  label,
  className
}: {
  icon: string;
  /** 0 = locked. */
  tier: number;
  tiers: number;
  size?: number;
  /** Text in place of an icon (a month badge's "OCT"). */
  label?: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const locked = tier === 0;
  const metal = metalFor(tier, tiers);
  const Icon = ICONS[icon] ?? Sparkles;
  const iconSize = Math.round(size * 0.34);

  return (
    <span
      className={cn("badge-emblem relative inline-flex shrink-0 items-center justify-center", locked && "is-locked", className)}
      // The mark is the metal's dark tone on a light face, its light tone on a dark one.
      style={{ width: size, height: size, ["--ink-light" as string]: metal.ink, ["--ink-dark" as string]: metal.hi }}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className="absolute inset-0 overflow-visible">
        <defs>
          <linearGradient id={`rim-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={metal.hi} />
            <stop offset="100%" stopColor={metal.lo} />
          </linearGradient>
          <linearGradient id={`face-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--badge-face-hi)" />
            <stop offset="100%" stopColor="var(--badge-face-lo)" />
          </linearGradient>
        </defs>
        {locked ? (
          <>
            <path d={HEX} fill="none" stroke="var(--badge-locked)" strokeWidth="3" strokeLinejoin="round" />
            <path d={HEX_INNER} fill="none" stroke="var(--badge-locked)" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="3 4" />
          </>
        ) : (
          <>
            <path d={HEX} fill={`url(#rim-${id})`} className="badge-emblem-rim" />
            <path d={HEX_INNER} fill={`url(#face-${id})`} />
            {/* A highlight across the top face: the medal catches the light. */}
            <path d="M50 13 L82.5 31.5 L82.5 40 L50 22 L17.5 40 L17.5 31.5 Z" fill="white" opacity="0.18" />
          </>
        )}
      </svg>
      {label ? (
        <span
          className="relative font-mono font-semibold uppercase leading-none tracking-wide"
          style={{ fontSize: Math.max(9, size * 0.2), color: locked ? "var(--badge-locked-ink)" : "var(--badge-ink)" }}
        >
          {label}
        </span>
      ) : (
        <Icon
          size={iconSize}
          strokeWidth={2}
          className="relative"
          style={{ color: locked ? "var(--badge-locked-ink)" : "var(--badge-ink)" }}
        />
      )}
    </span>
  );
}
