import { useLayoutEffect, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Flow } from "../model";
import { ArrowMarkers } from "./ArrowMarkers";

/**
 * Connectors between rows: where a value that just arrived came from.
 *
 * A merge is what this is for. `out.append(left[i])` leaves `left` untouched,
 * so the value now exists in two places at once and no shared-layout trick can
 * move a box that has not gone anywhere. Drawing the copy is the honest
 * picture, and it is the same picture a merge is taught with.
 *
 * Measured rather than calculated, for the same reason the dependency arrows
 * in a grid are: the rows sit in separate sections, size themselves to their
 * contents and wrap, so the only trustworthy geometry is what the browser laid
 * out. The overlay lives inside the scrolling content, not over it, so the
 * connectors travel with the rows.
 */
export function FlowLinks({
  flows,
  host,
  revision
}: {
  flows: Flow[];
  host: RefObject<HTMLElement | null>;
  revision: unknown;
}) {
  const [paths, setPaths] = useState<Array<{ key: string; d: string; kind: Flow["kind"] }>>([]);

  useLayoutEffect(() => {
    const container = host.current;
    if (!container || flows.length === 0) {
      setPaths([]);
      return;
    }
    const box = container.getBoundingClientRect();
    const boxOf = (handle: string) => {
      const cell = container.querySelector<HTMLElement>(`[data-flow="${handle}"]`);
      if (!cell) return null;
      const rect = cell.getBoundingClientRect();
      return {
        x: rect.left - box.left + rect.width / 2,
        top: rect.top - box.top,
        bottom: rect.bottom - box.top
      };
    };

    const next: Array<{ key: string; d: string; kind: Flow["kind"] }> = [];
    for (const flow of flows) {
      const from = boxOf(flow.from);
      const to = boxOf(flow.to);
      if (!from || !to) continue;

      // Within one row — a monotonic stack turning out its neighbour — a
      // connector drawn bottom-to-top collapses into a hook nobody can read.
      // It arcs over the row instead, which is also how the eviction reads:
      // one cell reaching back across the ones between.
      if (Math.abs(from.top - to.top) < 12) {
        const rise = Math.min(34, 14 + Math.abs(to.x - from.x) * 0.3);
        next.push({
          key: flow.key,
          kind: flow.kind,
          d: `M ${from.x} ${from.top - 3} C ${from.x} ${from.top - rise} ${to.x} ${to.top - rise} ${to.x} ${to.top - 4}`
        });
        continue;
      }

      // Between rows the useful bow is vertical: two sources feeding one
      // result stay tellable apart instead of overlapping.
      const lift = Math.max(18, Math.abs(to.top - from.bottom) * 0.45);
      next.push({
        key: flow.key,
        kind: flow.kind,
        d: `M ${from.x} ${from.bottom + 2} C ${from.x} ${from.bottom + lift} ${to.x} ${to.top - lift} ${to.x} ${to.top - 3}`
      });
    }
    setPaths(next);
  }, [flows, host, revision]);

  return (
    <svg
      aria-hidden
      // No z-index on purpose: the rows above it are positioned, so a cell
      // occludes the line and a connector passing a row in between reads as
      // going behind it rather than scribbling over it.
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    >
      <ArrowMarkers />
      <AnimatePresence initial={false}>
        {paths.map((path) => (
          <motion.path
            key={path.key}
            d={path.d}
            fill="none"
            strokeWidth={1.6}
            strokeLinecap="round"
            markerEnd={path.kind === "evicts" ? "url(#nf-arrow-soft)" : "url(#nf-arrow-strong)"}
            strokeDasharray={path.kind === "evicts" ? "5 3" : undefined}
            className={path.kind === "evicts" ? "stroke-[var(--compare)]" : "stroke-[var(--graphics-node)]"}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.9 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.4, 0, 0.2, 1] }}
          />
        ))}
      </AnimatePresence>
    </svg>
  );
}
