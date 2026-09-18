import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { computeDiffs, expandTrace, type HeapObject } from "@nodeflow/shared";
import { cn } from "../../lib/cn";
import { Caption, Node, Null, PointerPill, Scene } from "./primitives";
import { geometry } from "./geometry";
import { useFrames, useInView } from "./useFrames";
import recorded from "./fixtures/reverseList6.json";
import type { RecordedRun } from "./fixtures/types";

/**
 * The hero band: reverse_list rewiring a six-node list, under the CTAs.
 *
 * Every arrow, pill and numeral comes from fixtures/reverseList6.json, which is
 * a real recording from POST /api/run — the same tracer the workspace uses. The
 * site says the visuals are never hand-drawn, so this one is not either.
 */

const run = recorded as unknown as RecordedRun;

/** Same expansion the workspace does: delta heaps out, per-step diffs in. */
const demo = (() => {
  const trace = expandTrace(run.trace, run.heapMode);
  return { trace, diffs: computeDiffs(trace) };
})();

const WIDTH = 1100;
const HEIGHT = 170;
const NODE_Y = 88;
const RADIUS = 28;
const SPACING = 184;
const FIRST_X = 90;

/** Pills shown on the band. `nxt` is a scratch variable and only adds noise. */
const PILLS = ["head", "previous", "current"];
const PILL_HEIGHT = 20;
const PILL_ROWS = [32, 6];

const objectIds = Object.keys(demo.trace[0].heap).sort(
  (a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""))
);

const nodeX = (id: string) => FIRST_X + objectIds.indexOf(id) * SPACING;
const valueOf = (heap: Record<string, HeapObject>, id: string) => String(heap[id]?.fields?.val ?? "?");

/**
 * The recording holds 35 steps, but nine of them only move `nxt`, which the
 * band does not draw — they would be beats where nothing visibly happens. What
 * is left is every step that rewires a node or moves a drawn pointer: 20
 * frames, about ten seconds at the pointer-hop beat.
 */
const shown = demo.trace
  .map((_, index) => index)
  .filter((index) => {
    if (index === 0 || index === demo.trace.length - 1) return true;
    const diff = demo.diffs[index];
    const movedPill = Object.keys(diff.variablesChanged ?? {}).some((name) => PILLS.includes(name));
    return diff.mutated.length > 0 || movedPill;
  });

export function ReverseListBand({
  className,
  onRewire
}: {
  className?: string;
  /**
   * Fires on each frame that rewires a node, so anything synced to the band
   * (the hero word) reacts to the real trace instead of guessing with its own
   * timer.
   */
  onRewire?: () => void;
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ amount: 0.15 });
  const { index } = useFrames(shown.length, {
    intervalMs: 400,
    holdStartMs: 1200,
    holdEndMs: 1200,
    active: inView
  });

  const stepIndex = shown[index];
  const step = demo.trace[stepIndex];
  const diff = demo.diffs[stepIndex];

  const mutated = useMemo(() => new Set(diff.mutated.map((entry) => entry.id)), [diff]);

  const rewired = diff.mutated.length > 0;
  const notify = useRef(onRewire);
  notify.current = onRewire;
  useEffect(() => {
    if (rewired) notify.current?.();
  }, [rewired, stepIndex]);
  const changedVars = useMemo(() => new Set(Object.keys(diff.variablesChanged ?? {})), [diff]);

  /** Exactly one pill is active: the one this step moved, `current` if it moved too. */
  const activePill = changedVars.has("current")
    ? "current"
    : PILLS.find((name) => changedVars.has(name));

  const edges = useMemo(
    () =>
      objectIds.map((id) => {
        const next = step.heap[id]?.fields?.next;
        const target = typeof next === "string" && step.heap[next] ? next : null;
        return { id, target, changed: mutated.has(id) };
      }),
    [step, mutated]
  );

  const pills = useMemo(() => {
    const levels = new Map<string, number>();
    return PILLS.flatMap((name) => {
      const target = step.variables[name];
      // A pointer that is None is simply not on the board yet.
      if (typeof target !== "string" || !step.heap[target]) return [];
      const level = levels.get(target) ?? 0;
      levels.set(target, level + 1);
      return [{ name, x: nodeX(target), level: Math.min(level, PILL_ROWS.length - 1) }];
    });
  }, [step]);

  const reading = objectIds
    .map((id) => {
      const next = step.heap[id]?.fields?.next;
      return `${valueOf(step.heap, id)} to ${
        typeof next === "string" ? valueOf(step.heap, next) : "null"
      }`;
    })
    .join(", ");

  return (
    <div ref={ref} className={cn("relative w-full max-w-275", className)}>
      <Scene
        width={WIDTH}
        height={HEIGHT}
        label={`reverse_list rewiring a six-node list, recorded step ${stepIndex + 1} of ${demo.trace.length}: ${reading}`}
        className="graphics-edge-fade"
      >
        <AnimatePresence initial={false}>
          {edges.map((edge) => {
            if (!edge.target) {
              return (
                <motion.g
                  key={`${edge.id}-null`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                >
                  <Null x={nodeX(edge.id)} y={NODE_Y} r={RADIUS} tone="inactive" />
                </motion.g>
              );
            }

            const from = nodeX(edge.id);
            const to = nodeX(edge.target);
            const backward = to < from;

            return (
              <motion.path
                key={`${edge.id}->${edge.target}`}
                d={
                  backward
                    ? geometry.curvedEdge(from, to, NODE_Y, RADIUS)
                    : geometry.straightEdge(from, to, NODE_Y, RADIUS)
                }
                fill="none"
                stroke={edge.changed ? "var(--graphics-accent)" : "var(--graphics-ink)"}
                strokeWidth={geometry.edge}
                strokeLinecap="round"
                markerEnd={`url(#nf-band-chevron-${edge.changed ? "accent" : "ink"})`}
                style={{ transition: "stroke 600ms linear" }}
                // A rewire reads as one motion: the old edge retracts, then the
                // replacement draws itself in.
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ pathLength: 0, opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.3, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              />
            );
          })}
        </AnimatePresence>

        {objectIds.map((id) => (
          <Node
            key={id}
            x={nodeX(id)}
            y={NODE_Y}
            r={RADIUS}
            value={valueOf(step.heap, id)}
            tone={mutated.has(id) ? "accent" : "ink"}
            changed={mutated.has(id)}
          />
        ))}

        {pills.map((pill) => {
          const y = PILL_ROWS[pill.level];
          return (
            <PointerPill
              key={pill.name}
              x={pill.x}
              y={y}
              label={pill.name}
              active={pill.name === activePill}
              stem={pill.level === 0 ? NODE_Y - RADIUS - (y + PILL_HEIGHT) : 0}
            />
          );
        })}

        <Caption x={WIDTH - 90} y={HEIGHT - 12} anchor="end">
          {`STEP ${String(stepIndex + 1).padStart(2, "0")} / ${demo.trace.length}`}
        </Caption>
      </Scene>

      {/*
        The band's chevrons are referenced by a fixed id above so the marker
        colour can switch with the edge; Scene's own generated markers stay
        unused here.
      */}
      <svg width="0" height="0" aria-hidden className="absolute">
        <defs>
          {(["ink", "accent"] as const).map((tone) => (
            <marker
              key={tone}
              id={`nf-band-chevron-${tone}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="9"
              markerHeight="9"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path
                d="M 2 1.6 L 8 5 L 2 8.4"
                fill="none"
                stroke={tone === "accent" ? "var(--graphics-accent)" : "var(--graphics-ink)"}
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>
          ))}
        </defs>
      </svg>
    </div>
  );
}
