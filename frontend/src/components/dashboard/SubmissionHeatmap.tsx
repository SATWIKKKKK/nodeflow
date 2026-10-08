import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Info } from "lucide-react";
import { HoverSelect } from "../HoverSelect";
import { cn } from "../../lib/cn";
import { activityIn, addDays, dateOf, spanFor, todayKey, useCountUp } from "./activity";

/**
 * A year of submissions, one square per day, LeetCode's way: each month is
 * its own block of week columns (Sunday at the top), with a gap between
 * months and the month's name underneath. A day's colour is one hue, light
 * to dark, by how many submissions it had relative to the busiest day shown,
 * so a quiet year still shows its shape. Hovering a day says exactly what
 * happened on it.
 *
 * "Current" is the past year ending today; earlier years run January to
 * December. The totals above it follow the choice.
 */

const CELL = 11;
const GAP = 3;
const MONTH_GAP = 9;

const monthName = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const dayName = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

interface Cell {
  key: string;
  count: number;
  column: number;
  row: number;
}

interface MonthBlock {
  label: string;
  columns: number;
  cells: Cell[];
}

const buildMonths = (calendar: Record<string, number>, start: string, end: string): MonthBlock[] => {
  const months: MonthBlock[] = [];
  let key = start;
  while (key <= end) {
    const month = key.slice(0, 7);
    const first = dateOf(key);
    const lead = first.getUTCDay();
    const cells: Cell[] = [];
    let offset = 0;
    while (key <= end && key.slice(0, 7) === month) {
      const day = dateOf(key).getUTCDay();
      cells.push({ key, count: calendar[key] ?? 0, column: Math.floor((offset + lead) / 7), row: day });
      offset += 1;
      key = addDays(key, 1);
    }
    months.push({
      label: monthName.format(first),
      columns: (cells.at(-1)?.column ?? 0) + 1,
      cells
    });
  }
  return months;
};

const levelOf = (count: number, busiest: number) => {
  if (count <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / busiest) * 4)));
};

export function SubmissionHeatmap({ calendar }: { calendar: Record<string, number> }) {
  const still = useReducedMotion();
  const [choice, setChoice] = useState("current");
  const [hover, setHover] = useState<{ cell: Cell; x: number; y: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);

  const years = useMemo(() => {
    const found = new Set(Object.keys(calendar).map((key) => key.slice(0, 4)));
    found.add(todayKey().slice(0, 4));
    return [...found].sort().reverse();
  }, [calendar]);

  const span = spanFor(choice);
  const months = useMemo(() => buildMonths(calendar, span.start, span.end), [calendar, span.start, span.end]);
  const activity = useMemo(() => activityIn(calendar, { start: span.start, end: span.end }), [calendar, span.start, span.end]);
  const busiest = Math.max(4, ...months.flatMap((month) => month.cells.map((cell) => cell.count)));
  const shownSubmissions = useCountUp(activity.submissions);
  const today = todayKey();

  // On a narrow screen the strip scrolls; it opens on the latest months.
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [choice]);

  let columnBase = 0;

  return (
    <section aria-labelledby="activity-heading" className="surface-card !p-5 sm:!p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h2 id="activity-heading" className="flex items-center gap-2 text-[17px] text-blueprint-muted">
          <span className="font-sans text-[22px] font-semibold tracking-[-0.01em] text-primary">
            {Math.round(shownSubmissions)}
          </span>
          {activity.submissions === 1 ? "submission" : "submissions"} {choice === "current" ? "in the past year" : `in ${choice}`}
          <span
            className="tool-button relative inline-flex text-blueprint-muted"
            data-tip="Every Submit you make counts, accepted or not."
            data-tip-side="left"
            tabIndex={0}
          >
            <Info size={14} aria-label="About this count" />
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-blueprint-muted">
          <span>
            Active days: <span className="font-semibold text-primary">{activity.activeDays}</span>
          </span>
          <span>
            Max streak: <span className="font-semibold text-primary">{activity.maxStreak}</span>
          </span>
          {choice === "current" && (
            <span>
              Current streak: <span className="font-semibold text-primary">{activity.currentStreak}</span>
            </span>
          )}
          <HoverSelect
            label="Which year"
            value={choice}
            align="right"
            options={[
              { value: "current", label: "Current" },
              ...years.map((year) => ({ value: year, label: year }))
            ]}
            onChange={setChoice}
            triggerClassName="neu-trigger h-8 rounded-lg px-3 text-[13px] font-medium text-primary"
          />
        </div>
      </div>

      <div ref={frame} className="relative mt-5">
        <div ref={scroller} className="overflow-x-auto overflow-y-hidden pb-1">
          <div
            key={choice}
            className={cn("heatmap mx-auto flex w-max", !still && "is-entering")}
            role="img"
            aria-label={`${activity.submissions} submissions on ${activity.activeDays} days ${choice === "current" ? "in the past year" : `in ${choice}`}`}
            onMouseLeave={() => setHover(null)}
          >
            {months.map((month, monthIndex) => {
              const base = columnBase;
              columnBase += month.columns;
              return (
                <div key={`${month.label}-${monthIndex}`} style={{ marginRight: monthIndex < months.length - 1 ? MONTH_GAP : 0 }}>
                  <div
                    className="relative"
                    style={{ width: month.columns * (CELL + GAP) - GAP, height: 7 * (CELL + GAP) - GAP }}
                  >
                    {month.cells.map((cell) => (
                      <span
                        key={cell.key}
                        className={cn("heat-cell", `heat-${levelOf(cell.count, busiest)}`, cell.key === today && "is-today")}
                        style={{
                          left: cell.column * (CELL + GAP),
                          top: cell.row * (CELL + GAP),
                          animationDelay: still ? undefined : `${(base + cell.column) * 14}ms`
                        }}
                        onMouseEnter={(event) => {
                          const box = frame.current?.getBoundingClientRect();
                          const target = event.currentTarget.getBoundingClientRect();
                          if (box) setHover({ cell, x: target.left - box.left + CELL / 2, y: target.top - box.top });
                        }}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-center text-[12px] text-blueprint-muted">{month.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {hover && (
          <div
            className="heat-tip pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md px-2 py-1 text-[11.5px] font-medium"
            style={{ left: hover.x, top: hover.y - 6 }}
            role="tooltip"
          >
            {hover.cell.count === 0
              ? "No submissions"
              : `${hover.cell.count} submission${hover.cell.count === 1 ? "" : "s"}`}{" "}
            on {dayName.format(dateOf(hover.cell.key))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-blueprint-muted" aria-hidden>
        Less
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className={cn("heat-cell is-legend", `heat-${level}`)} />
        ))}
        More
      </div>
    </section>
  );
}
