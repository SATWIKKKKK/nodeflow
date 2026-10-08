import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { Badge } from "@nodeflow/shared";
import { BadgeEmblem } from "../badges/BadgeEmblem";
import { earnedCount, earnedOn, emblemLabel, nextBadge, progressOf, progressText, recentBadges, titleOf } from "../badges/badges";
import { todayKey, useCountUp } from "./activity";

/**
 * The badge summary beside the solved ring, laid out like LeetCode's: how
 * many badges, the latest few, and the next one still locked, with how far
 * there is to go. The locked badge's medal sits large and faint behind it.
 */
export function BadgeCard({ badges }: { badges: Badge[] }) {
  const still = useReducedMotion();
  const count = useCountUp(earnedCount(badges));
  const recent = recentBadges(badges);
  const next = nextBadge(badges, todayKey().slice(0, 7));
  const progress = next ? progressOf(next) : 1;

  return (
    <section aria-labelledby="badges-summary-heading" className="surface-card relative flex h-full flex-col overflow-hidden !p-5 sm:!p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="badges-summary-heading" className="text-[14px] text-blueprint-muted">
            Badges
          </h2>
          <p className="mt-1 font-sans text-[32px] font-semibold leading-none tracking-[-0.02em] text-primary">
            {Math.round(count)}
          </p>
        </div>
        {recent.length > 0 && (
          <ul className="flex items-center gap-1.5" aria-label="Latest badges">
            {recent.map((badge, at) => (
              <motion.li
                key={badge.id}
                title={`${titleOf(badge)} · ${earnedOn(badge)}`}
                initial={still ? false : { opacity: 0, scale: 0.6, rotate: -12 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.2 + at * 0.1, type: "spring", stiffness: 260, damping: 18 }}
              >
                <BadgeEmblem icon={badge.icon} tier={badge.tier} tiers={badge.thresholds.length} size={44} label={emblemLabel(badge)} />
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      {next ? (
        <div className="relative mt-auto pt-8">
          {/* The badge to win, large and faint, as LeetCode shows a locked one. */}
          <div className="pointer-events-none absolute -right-2 bottom-1 opacity-[0.55]">
            <BadgeEmblem icon={next.icon} tier={0} tiers={next.thresholds.length} size={92} label={emblemLabel(next)} />
          </div>
          <p className="text-[13px] text-blueprint-muted">{next.tier === 0 ? "Locked badge" : "Next tier"}</p>
          <p className="mt-1 max-w-[70%] text-[18px] font-medium leading-snug text-primary">{titleOf(next, next.tier + 1)}</p>
          <p className="mt-1 max-w-[70%] text-[12.5px] text-blueprint-muted">{next.description}</p>
          <div className="mt-3 max-w-[62%]">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-inset" aria-hidden>
              <motion.div
                className="progress-fill h-full rounded-full"
                initial={still ? false : { width: 0 }}
                animate={{ width: `${Math.round(progress * 100)}%` }}
                transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <p className="mt-1.5 font-mono text-[11.5px] text-blueprint-muted">{progressText(next)}</p>
          </div>
        </div>
      ) : (
        <p className="mt-auto pt-8 text-[14px] text-primary">Every badge is yours. Remarkable.</p>
      )}

      <a
        href="#badges"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("badges")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        className="relative mt-4 inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-[var(--fill-blue)] hover:underline"
      >
        All badges <ArrowRight size={13} aria-hidden />
      </a>
    </section>
  );
}
