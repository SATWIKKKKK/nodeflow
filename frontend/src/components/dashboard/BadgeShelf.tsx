import { motion, useReducedMotion } from "framer-motion";
import { BADGE_REWARD, type Badge, type BadgeFamily } from "@nodeflow/shared";
import { cn } from "../../lib/cn";
import { BadgeEmblem, tierName } from "../badges/BadgeEmblem";
import { earnedOn, emblemLabel, isComplete, progressOf, progressText, titleOf } from "../badges/badges";

/**
 * Every badge, grouped by what earns it, each with its medal at the tier
 * reached (or the outline, still locked), the tiers as pips, and the way to
 * the next tier as a bar. Nothing here is a mystery: every tile says what it
 * takes and how far along the learner is.
 */

const GROUPS: Array<{ family: BadgeFamily[]; title: string; lead: string }> = [
  { family: ["milestone", "difficulty"], title: "Solving", lead: "Problems solved, and how hard they were." },
  { family: ["topic"], title: "Topics", lead: "A quarter, half, then all of a topic's problems: bronze, silver, gold." },
  { family: ["consistency"], title: "Consistency", lead: "Turning up: days in a row, and days in all." },
  { family: ["performance"], title: "Craft", lead: "Right first time, coming back from a fail, a high acceptance rate, many languages." },
  { family: ["coins"], title: "Coins", lead: "Coins earned by solving and in the waiting game." },
  { family: ["monthly"], title: "Months", lead: "One for every month you submit on 20 different days." }
];

const MONTH_COINS = 50;

export function BadgeShelf({ badges }: { badges: Badge[] }) {
  return (
    <section id="badges" aria-labelledby="badges-heading" className="surface-frame scroll-mt-24 overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-blueprint-line px-5 py-4 sm:px-6">
        <h2 id="badges-heading" className="text-headline-sm text-primary">
          Badges
        </h2>
        <p className="text-[12.5px] text-blueprint-muted">
          Each tier pays coins once: {BADGE_REWARD.slice(1).join(", ")} from bronze to platinum, {MONTH_COINS} a month.
        </p>
      </div>
      <div className="grid gap-8 px-5 py-6 sm:px-6">
        {GROUPS.map((group) => {
          const members = badges.filter((badge) => group.family.includes(badge.family));
          if (!members.length) return null;
          return (
            <div key={group.title}>
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-[15px] font-semibold text-primary">{group.title}</h3>
                <p className="text-[12.5px] text-blueprint-muted">{group.lead}</p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {members.map((badge, at) => (
                  <BadgeTile key={badge.id} badge={badge} order={at} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BadgeTile({ badge, order }: { badge: Badge; order: number }) {
  const still = useReducedMotion();
  const tiers = badge.thresholds.length;
  const complete = isComplete(badge);
  const progress = progressOf(badge);
  const status = badge.tier === 0 ? "Locked" : tierName(badge.tier, tiers) || "Earned";

  return (
    <motion.li
      initial={still ? false : { opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.32, delay: Math.min(order, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className={cn("badge-tile flex items-center gap-3.5 rounded-xl px-3.5 py-3", badge.tier === 0 && "is-locked")}
      title={badge.earnedAt ? `${titleOf(badge)} · reached ${earnedOn(badge)}` : badge.description}
    >
      <BadgeEmblem icon={badge.icon} tier={badge.tier} tiers={tiers} size={50} label={emblemLabel(badge)} className="badge-tile-emblem" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[14px] font-semibold text-primary">{badge.name}</p>
          <p className={cn("shrink-0 text-[11.5px] font-medium", badge.tier === 0 ? "text-blueprint-muted" : "text-primary")}>
            {status}
          </p>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-blueprint-muted">{badge.description}</p>
        <div className="mt-2 flex items-center gap-2">
          {tiers > 1 && (
            <span className="flex shrink-0 gap-1" aria-label={`${badge.tier} of ${tiers} tiers`}>
              {badge.thresholds.map((_, index) => (
                <span key={index} className={cn("tier-pip", index < badge.tier && `is-on tier-${index + 1}`)} />
              ))}
            </span>
          )}
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-inset" aria-hidden>
            <motion.div
              className="progress-fill h-full rounded-full"
              initial={still ? false : { width: 0 }}
              whileInView={{ width: `${Math.round(progress * 100)}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
        <p className="mt-1 font-mono text-[11px] text-blueprint-muted">
          {complete && badge.earnedAt ? `Complete · ${earnedOn(badge)}` : progressText(badge)}
        </p>
      </div>
    </motion.li>
  );
}
