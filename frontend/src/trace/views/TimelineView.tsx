import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { TimelineViewModel } from "../model";

/**
 * Ranges laid on the axis they actually occupy.
 *
 * A list of `[start, end]` pairs drawn as a two-column table hides the only
 * thing interval scheduling is about: which ranges overlap. On an axis, an
 * accepted run and the ones it ruled out are the picture the problem is
 * taught with, and no extra state is needed to say which is which — the
 * accepted list has already said so by holding them.
 *
 * A range that was weighed and passed over stays on the axis, faded and
 * hatched, because the reason it was passed over is visible only next to what
 * beat it.
 */

const LANE = 26;
const BAR = 16;
const PAD_LEFT = 6;
const AXIS = 18;

export function TimelineView({ view }: { view: TimelineViewModel }) {
  const span = Math.max(1, view.to - view.from);
  const height = view.bars.length * LANE + AXIS;
  const at = (value: number) => ((value - view.from) / span) * 100;

  // Whole numbers if the axis is short enough to label them all.
  const ticks =
    span <= 24
      ? Array.from({ length: span + 1 }, (_, k) => view.from + k)
      : [view.from, view.from + span / 2, view.to];

  return (
    <div>
      <p className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-[13px] text-primary">{view.title}</span>
        <span className="text-technical-mono text-blueprint-muted">
          timeline · {view.bars.length} {view.bars.length === 1 ? "range" : "ranges"}
        </span>
      </p>

      <div className="relative" style={{ height, paddingLeft: PAD_LEFT }}>
        {/* Gridlines first, so a bar always sits over them. */}
        <div className="absolute inset-0" style={{ bottom: AXIS }} aria-hidden>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute top-0 bottom-0 w-px bg-blueprint-line opacity-40"
              style={{ left: `${at(tick)}%` }}
            />
          ))}
        </div>

        {view.bars.map((bar, lane) => (
          <motion.div
            key={bar.key}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: bar.verdict === "passed" ? 0.5 : 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="absolute"
            style={{
              top: lane * LANE + (LANE - BAR) / 2,
              left: `${at(bar.start)}%`,
              width: `${Math.max(1.5, at(bar.end) - at(bar.start))}%`,
              height: BAR
            }}
          >
            <span
              className={cn(
                "flex h-full items-center justify-center rounded-[3px] border-[1.25px] px-1 font-mono text-[10px] leading-none transition-colors duration-300",
                bar.verdict === "taken"
                  ? "border-transparent bg-[var(--fill-blue)] text-[var(--fill-blue-text)]"
                  : bar.verdict === "passed"
                    ? "border-dashed border-blueprint-line bg-surface-inset text-blueprint-muted"
                    : "border-blueprint-line bg-card text-primary",
                // Being looked at outranks the verdict: it is the newer news.
                bar.active && "outline-2 outline-offset-2 outline-[var(--compare)]"
              )}
            >
              <span className={cn("truncate", bar.changed && "value-commit")}>
                {bar.start}–{bar.end}
              </span>
            </span>
          </motion.div>
        ))}

        <div className="absolute right-0 bottom-0 left-0" style={{ height: AXIS }} aria-hidden>
          <span className="absolute top-0 right-0 left-0 h-px bg-blueprint-line" />
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute top-1 -translate-x-1/2 font-mono text-[9px] text-blueprint-muted"
              style={{ left: `${at(tick)}%` }}
            >
              {Number.isInteger(tick) ? tick : tick.toFixed(1)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
