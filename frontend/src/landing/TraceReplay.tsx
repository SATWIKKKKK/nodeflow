import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import type { HeapObject, TraceDiff, TraceStep } from "@nodeflow/shared";
import { cn } from "../lib/cn";
import recorded from "./reverseListTrace.json";

/**
 * Landing-page proof: a trace recorded from the Noesis tracer (see
 * reverseListTrace.json), replayed as a 2D diagram. Nothing here is scripted:
 * node positions, arrows and pointer tags are all derived from each step's heap.
 */

interface DemoTrace {
  code: string;
  input: { head: number[] };
  result: number[];
  trace: TraceStep[];
  diffs: TraceDiff[];
}

const demo = recorded as unknown as DemoTrace;
const codeLines = demo.code.replace(/\n$/, "").split("\n");
const STEP_MS = 620;
const END_HOLD_MS = 900;

const HEIGHT = 236;
const NODE_Y = 124;
const TAG_ORDER = ["head", "previous", "current", "nxt"];

const objectIds = Object.keys(demo.trace[0].heap).sort(
  (a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""))
);

/** Two geometries: the wide one for tablets and up, a tighter one so labels stay legible on phones. */
interface Layout {
  width: number;
  spacing: number;
  firstX: number;
  radius: number;
  tagFont: number;
  tagChar: number;
}

const WIDE: Layout = { width: 560, spacing: 140, firstX: 70, radius: 25, tagFont: 11, tagChar: 7.4 };
const COMPACT: Layout = { width: 392, spacing: 100, firstX: 46, radius: 22, tagFont: 12.5, tagChar: 8.2 };

const nodeX = (id: string, layout: Layout) => layout.firstX + objectIds.indexOf(id) * layout.spacing;

function useCompact() {
  const query = "(max-width: 639px)";
  const [compact, setCompact] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return compact;
}

const valueOf = (heap: Record<string, HeapObject>, id: string) => String(heap[id]?.fields?.val ?? "?");

const describeTarget = (heap: Record<string, HeapObject>, target: unknown) =>
  typeof target === "string" && heap[target] ? `node ${valueOf(heap, target)}` : "None";

/** One sentence per step, built from the diff that produced it. */
function describeStep(index: number): string {
  const step = demo.trace[index];
  const diff = demo.diffs[index];

  if (index === 0) return `Input list built: ${demo.input.head.join(" → ")}. head points at node 1.`;

  const parts: string[] = [];
  for (const mutation of diff?.mutated ?? []) {
    for (const field of mutation.fields) {
      parts.push(
        `node ${valueOf(step.heap, mutation.id)}.${field} now points to ${describeTarget(
          step.heap,
          mutation.after.fields?.[field]
        )}`
      );
    }
  }
  for (const [name, change] of Object.entries(diff?.variablesChanged ?? {})) {
    parts.push(`${name} → ${describeTarget(step.heap, change.after)}`);
  }

  const ranLine = demo.trace[index - 1].line;
  if (step.event === "return") {
    return `Returned previous: ${demo.result.join(" → ")}.`;
  }
  return parts.length ? `Line ${ranLine} ran: ${parts.join(", ")}.` : `Line ${ranLine} ran: loop condition checked.`;
}

interface Arrow {
  key: string;
  d: string;
  from: string;
}

function arrowFor(fromId: string, toId: string | null, layout: Layout): Arrow {
  const { radius, spacing } = layout;
  const stub = Math.min(26, spacing * 0.2);
  const x1 = nodeX(fromId, layout);

  if (!toId) {
    // Null pointer: a short stub ending in a bar.
    return {
      key: `${fromId}->null`,
      from: fromId,
      d: `M ${x1 + radius + 3} ${NODE_Y} H ${x1 + radius + stub} M ${x1 + radius + stub} ${NODE_Y - 8} V ${NODE_Y + 8}`
    };
  }

  const x2 = nodeX(toId, layout);
  const forward = x2 > x1;
  const adjacent = Math.abs(x2 - x1) === spacing;

  if (forward && adjacent) {
    return {
      key: `${fromId}->${toId}`,
      from: fromId,
      d: `M ${x1 + radius + 4} ${NODE_Y} L ${x2 - radius - 7} ${NODE_Y}`
    };
  }

  // Backward (or long) pointers arc underneath so they never cross a forward arrow.
  const lift = 34 + Math.abs(x2 - x1) * 0.08;
  const sx = x1 - 8;
  const ex = x2 + (forward ? -8 : 8);
  const sy = NODE_Y + radius - 2;
  const ey = NODE_Y + radius + 5;
  return {
    key: `${fromId}->${toId}`,
    from: fromId,
    d: `M ${sx} ${sy} C ${sx} ${sy + lift}, ${ex} ${ey + lift}, ${ex} ${ey}`
  };
}

/**
 * Loops the recording forever while it is on screen: each step holds for
 * STEP_MS, the finished list holds a little longer, then it starts over.
 * Nothing pauses it; scrolling it out of view only saves the timers.
 */
function useLoopingPlayback(count: number, active: boolean) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    const atEnd = index >= count - 1;
    const timer = window.setTimeout(() => setIndex(atEnd ? 0 : index + 1), atEnd ? END_HOLD_MS : STEP_MS);
    return () => window.clearTimeout(timer);
  }, [active, index, count]);

  return index;
}

export function TraceReplay() {
  const count = demo.trace.length;
  const root = useRef<HTMLDivElement>(null);
  // A small margin starts playback just before the replay scrolls into view.
  const inView = useInView(root, { amount: 0.05, margin: "0px 0px 200px 0px" });
  const layout = useCompact() ? COMPACT : WIDE;
  const index = useLoopingPlayback(count, inView);

  const step = demo.trace[index];
  const diff = demo.diffs[index];

  const mutatedIds = useMemo(() => new Set((diff?.mutated ?? []).map((entry) => entry.id)), [diff]);
  const changedVars = useMemo(() => new Set(Object.keys(diff?.variablesChanged ?? {})), [diff]);

  const arrows = useMemo(
    () =>
      objectIds.map((id) => {
        const next = step.heap[id]?.fields?.next;
        return arrowFor(id, typeof next === "string" && step.heap[next] ? next : null, layout);
      }),
    [step, layout]
  );

  const tags = useMemo(() => {
    const stacks = new Map<string, number>();
    const pointing: Array<{ name: string; x: number; level: number }> = [];
    const nulls: string[] = [];

    const names = Object.keys(step.variables).sort(
      (a, b) => ((TAG_ORDER.indexOf(a) + 99) % 99) - ((TAG_ORDER.indexOf(b) + 99) % 99)
    );

    for (const name of names) {
      const target = step.variables[name];
      if (typeof target === "string" && step.heap[target]) {
        const level = stacks.get(target) ?? 0;
        stacks.set(target, level + 1);
        pointing.push({ name, x: nodeX(target, layout), level });
      } else {
        nulls.push(name);
      }
    }
    return { pointing, nulls };
  }, [step, layout]);

  const caption = describeStep(index);
  const listState = objectIds
    .map((id) => `${valueOf(step.heap, id)} → ${describeTarget(step.heap, step.heap[id]?.fields?.next)}`)
    .join("; ");

  return (
    <div ref={root} className="surface-frame overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blueprint-line px-5 py-3.5 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-technical-mono text-primary">reverse_list.py</span>
          <span className="language-tag rounded-full border px-2.5 py-1 text-xs font-semibold leading-none">
            Python
          </span>
        </div>
        <span className="rounded-full border border-blueprint-line px-3 py-1 text-technical-mono text-blueprint-muted">
          Recorded trace · {count} steps
        </span>
      </div>

      <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
        {/* Source, with the line about to run highlighted. */}
        <div className="border-b border-blueprint-line bg-surface-inset py-4 lg:border-b-0 lg:border-r">
          <pre className="overflow-x-auto font-mono text-[13px] leading-[1.75]" aria-label="Source code">
            {codeLines.map((line, lineIndex) => {
              const number = lineIndex + 1;
              const active = number === step.line;
              return (
                <div
                  key={number}
                  className={cn(
                    "flex pr-5 transition-colors duration-200",
                    active ? "bg-card text-primary shadow-[inset_2px_0_0_var(--primary)]" : "text-blueprint-muted"
                  )}
                >
                  <span
                    className={cn(
                      "w-11 shrink-0 select-none pr-4 text-right",
                      active ? "text-primary" : "text-blueprint-muted/60"
                    )}
                  >
                    {number}
                  </span>
                  <code className={cn(active && "font-medium")}>{line || " "}</code>
                </div>
              );
            })}
          </pre>
        </div>

        {/* Heap diagram. */}
        <div className="flex flex-col justify-center gap-5 p-5 sm:p-6">
          <svg
            viewBox={`0 0 ${layout.width} ${HEIGHT}`}
            role="img"
            aria-label={`Linked list at step ${index + 1}: ${listState}`}
            className="h-auto w-full text-primary"
          >
            <defs>
              <marker
                id="trace-arrow"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </marker>
            </defs>

            <AnimatePresence initial={false}>
              {arrows.map((arrow) => {
                const changed = mutatedIds.has(arrow.from);
                return (
                  <motion.path
                    key={arrow.key}
                    d={arrow.d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={changed ? 2.25 : 1.5}
                    strokeLinecap="round"
                    markerEnd={arrow.key.endsWith("null") ? undefined : "url(#trace-arrow)"}
                    className={changed ? "text-[var(--graphics-node)]" : "text-[var(--graphics-inactive)]"}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.18 } }}
                    transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  />
                );
              })}
            </AnimatePresence>

            {objectIds.map((id) => {
              const x = nodeX(id, layout);
              const changed = mutatedIds.has(id) || (index === 0 && diff?.created.includes(id));
              return (
                <g key={id}>
                  <circle
                    cx={x}
                    cy={NODE_Y}
                    r={layout.radius}
                    strokeWidth={1.75}
                    className={cn(
                      "stroke-[var(--graphics-node)] transition-[fill] duration-300",
                      changed ? "fill-[var(--fill-blue)]" : "fill-card"
                    )}
                  />
                  <text
                    x={x}
                    y={NODE_Y + 5}
                    textAnchor="middle"
                    className={cn(
                      "font-mono text-[15px] font-medium transition-[fill] duration-300",
                      changed ? "fill-[var(--fill-blue-text)]" : "fill-[var(--graphics-node)]"
                    )}
                  >
                    {valueOf(step.heap, id)}
                  </text>
                </g>
              );
            })}

            {tags.pointing.map((tag) => {
              const width = tag.name.length * layout.tagChar + 18;
              const tagHeight = layout.tagFont + 6;
              const y = NODE_Y - layout.radius - tagHeight - 13 - tag.level * (tagHeight + 5);
              const active = changedVars.has(tag.name);
              return (
                <motion.g
                  key={tag.name}
                  initial={false}
                  animate={{ x: tag.x, y }}
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                >
                  {tag.level === 0 && (
                    <line
                      x1={0}
                      y1={tagHeight}
                      x2={0}
                      y2={tagHeight + 6}
                      strokeWidth={1.5}
                      className="stroke-blueprint-muted"
                    />
                  )}
                  <rect
                    x={-width / 2}
                    y={0}
                    width={width}
                    height={tagHeight}
                    rx={tagHeight / 2}
                    strokeWidth={1}
                    className={cn(
                      "transition-[fill] duration-300",
                      active ? "fill-[var(--fill-blue)] stroke-[var(--fill-blue)]" : "fill-card stroke-blueprint-line"
                    )}
                  />
                  <text
                    x={0}
                    y={tagHeight / 2 + layout.tagFont * 0.35}
                    textAnchor="middle"
                    fontSize={layout.tagFont}
                    className={cn("font-mono", active ? "fill-[var(--fill-blue-text)]" : "fill-blueprint-muted")}
                  >
                    {tag.name}
                  </text>
                </motion.g>
              );
            })}
          </svg>

          <div className="flex min-h-7 flex-wrap items-center gap-2">
            {tags.nulls.length > 0 ? (
              tags.nulls.map((name) => (
                <span
                  key={name}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[11px] leading-none",
                    changedVars.has(name)
                      ? "border-transparent bg-[var(--fill-blue)] text-[var(--fill-blue-text)]"
                      : "border-blueprint-line text-blueprint-muted"
                  )}
                >
                  {name} = None
                </span>
              ))
            ) : (
              <span className="text-technical-mono text-blueprint-muted">No variable is None</span>
            )}
          </div>

          <p className="min-h-12 text-body-md text-primary">{caption}</p>
        </div>
      </div>

    </div>
  );
}
