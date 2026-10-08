import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import type { Difficulty, ProgressSummary } from "@nodeflow/shared";
import { cn } from "../../lib/cn";
import { useCountUp } from "./activity";

/**
 * How much of the bank is solved, LeetCode's way: one open ring split into
 * Easy, Medium and Hard (each arc as long as that difficulty's share of the
 * bank, filled as far as it is solved), the count in the middle, and a tile
 * per difficulty beside it. Hovering a tile or an arc puts that difficulty in
 * the middle instead. Under them: acceptance rate, submissions and completion.
 *
 * The arcs use their own validated steps of the difficulty colours
 * (--arc-easy and friends): the text colours sit too close together for a
 * colour-blind reader. The arcs are also always in the same order, with gaps
 * between them, and labelled by the tiles, so colour never carries it alone.
 */

const LEVELS: Array<{ key: Difficulty; short: string; arc: string; text: string }> = [
  { key: "Easy", short: "Easy", arc: "var(--arc-easy)", text: "var(--difficulty-easy)" },
  { key: "Medium", short: "Med.", arc: "var(--arc-medium)", text: "var(--difficulty-medium)" },
  { key: "Hard", short: "Hard", arc: "var(--arc-hard)", text: "var(--difficulty-hard)" }
];

const SIZE = 168;
const STROKE = 7;
const RADIUS = (SIZE - STROKE * 2) / 2;
/** The ring is open at the bottom: it runs 280°, from lower left round to lower right. */
const SWEEP = 280;
const START = 90 + (360 - SWEEP) / 2;
const GAP = 7;

const point = (degrees: number) => {
  const radians = (degrees * Math.PI) / 180;
  return [SIZE / 2 + RADIUS * Math.cos(radians), SIZE / 2 + RADIUS * Math.sin(radians)];
};

const arcPath = (from: number, to: number) => {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};

const percent = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);
const formatPercent = (value: number) => `${value >= 10 || value === 0 ? Math.round(value) : value.toFixed(1)}%`;

export function SolvedCard({ progress, attempting }: { progress: ProgressSummary; attempting: number }) {
  const still = useReducedMotion();
  const [focus, setFocus] = useState<Difficulty | null>(null);
  const counts = progress.byDifficulty;
  const total = progress.totalProblems;
  const solved = progress.accepted;
  const submissions = progress.submissionCount ?? 0;
  const acceptance = percent(progress.acceptedCount ?? 0, submissions);

  const shownSolved = useCountUp(focus && counts ? counts[focus].solved : solved);
  const shownAcceptance = useCountUp(acceptance);
  const shownCompletion = useCountUp(percent(solved, total));

  // Each difficulty's arc, in degrees, sized by its share of the bank.
  let cursor = START;
  const arcs = LEVELS.map((level) => {
    const entry = counts?.[level.key] ?? { solved: 0, total: 0 };
    const length = total ? (entry.total / total) * (SWEEP - GAP * (LEVELS.length - 1)) : 0;
    const from = cursor;
    cursor += length + GAP;
    return { ...level, ...entry, from, to: from + length };
  });

  const centreTotal = focus && counts ? counts[focus].total : total;
  const centreLabel = focus ? `${focus} solved` : "Solved";
  const focusLevel = LEVELS.find((level) => level.key === focus);

  return (
    <section aria-labelledby="solved-heading" className="surface-card flex h-full flex-col gap-6 !p-5 sm:!p-6">
      <h2 id="solved-heading" className="sr-only">
        Problems solved
      </h2>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="relative shrink-0"
          style={{ width: SIZE, height: SIZE }}
          onMouseLeave={() => setFocus(null)}
          role="img"
          aria-label={`${solved} of ${total} problems solved: ${arcs.map((arc) => `${arc.key} ${arc.solved} of ${arc.total}`).join(", ")}`}
        >
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="overflow-visible">
            {arcs.map((arc, index) =>
              arc.to > arc.from ? (
                <g key={arc.key} onMouseEnter={() => setFocus(arc.key)} className="cursor-default">
                  {/* A wide invisible stroke: the hover target is bigger than the mark. */}
                  <path d={arcPath(arc.from, arc.to)} fill="none" stroke="transparent" strokeWidth={STROKE * 3.5} />
                  <path
                    d={arcPath(arc.from, arc.to)}
                    fill="none"
                    stroke={arc.arc}
                    strokeOpacity={0.2}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                  />
                  {arc.solved > 0 && (
                    <motion.path
                      d={arcPath(arc.from, arc.to)}
                      fill="none"
                      stroke={arc.arc}
                      strokeWidth={focus === arc.key ? STROKE + 2 : STROKE}
                      strokeLinecap="round"
                      initial={still ? false : { pathLength: 0 }}
                      animate={{ pathLength: Math.max(0.02, arc.solved / Math.max(arc.total, 1)) }}
                      transition={{ duration: 1.1, delay: 0.15 + index * 0.18, ease: [0.22, 1, 0.36, 1] }}
                      style={{ transition: "stroke-width 160ms ease" }}
                    />
                  )}
                  {/* The start of every arc gets a dot, LeetCode's mark of where a level begins. */}
                  <circle
                    cx={point(arc.from)[0]}
                    cy={point(arc.from)[1]}
                    r={STROKE / 2 + 0.5}
                    fill={arc.arc}
                    opacity={arc.solved > 0 ? 1 : 0.45}
                  />
                </g>
              ) : null
            )}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="leading-none">
              <span className="font-sans text-[34px] font-semibold tracking-[-0.02em] text-primary">
                {Math.round(shownSolved)}
              </span>
              <span className="ml-0.5 text-[15px] font-medium text-blueprint-muted">/{centreTotal}</span>
            </p>
            <p
              className="mt-2 flex items-center gap-1 text-[13px] font-medium"
              style={{ color: focusLevel ? focusLevel.text : "var(--muted-foreground)" }}
            >
              {!focus && <Check size={14} strokeWidth={2.5} aria-hidden className="text-[var(--verdict-pass)]" />}
              {centreLabel}
            </p>
            <p className="mt-3 text-[12px] text-blueprint-muted">
              {focus && counts ? (
                `${formatPercent(percent(counts[focus].solved, counts[focus].total))} of ${focus}`
              ) : (
                <>
                  <span className="font-semibold text-primary">{attempting}</span> attempting
                </>
              )}
            </p>
          </div>
        </div>

        <ul className="grid w-full max-w-[220px] gap-2.5 sm:w-[44%]">
          {arcs.map((arc) => (
            <li key={arc.key}>
              <button
                type="button"
                onMouseEnter={() => setFocus(arc.key)}
                onMouseLeave={() => setFocus(null)}
                onFocus={() => setFocus(arc.key)}
                onBlur={() => setFocus(null)}
                aria-label={`${arc.key}: ${arc.solved} of ${arc.total} solved`}
                className={cn(
                  "difficulty-tile no-lift flex w-full flex-col items-center rounded-xl px-3 py-2.5 text-center",
                  focus === arc.key && "is-focused"
                )}
                style={{ minHeight: 0 }}
              >
                <span className="text-[13px] font-semibold" style={{ color: arc.text }}>
                  {arc.short}
                </span>
                <span className="mt-0.5 font-mono text-[13.5px] font-semibold text-primary">
                  {arc.solved}
                  <span className="text-blueprint-muted">/{arc.total}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <dl className="neu-groove-t grid grid-cols-3 gap-2 border-t border-blueprint-line pt-4 text-center">
        <div>
          <dt className="text-[11.5px] text-blueprint-muted">Acceptance</dt>
          <dd className="mt-1 font-mono text-[15px] font-semibold text-primary">
            {submissions ? formatPercent(shownAcceptance) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[11.5px] text-blueprint-muted">Submissions</dt>
          <dd className="mt-1 font-mono text-[15px] font-semibold text-primary">{submissions}</dd>
        </div>
        <div>
          <dt className="text-[11.5px] text-blueprint-muted">Completed</dt>
          <dd className="mt-1 font-mono text-[15px] font-semibold text-primary">{formatPercent(shownCompletion)}</dd>
        </div>
      </dl>
    </section>
  );
}
