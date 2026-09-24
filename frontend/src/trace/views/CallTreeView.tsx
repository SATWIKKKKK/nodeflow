import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { CallTreeViewModel } from "../model";
import { placeAt } from "./placeAt";

/**
 * The shape a recursion actually explored, kept on screen as it goes.
 *
 * The call stack shows where you are; this shows where you have been. A branch
 * that gave up stays drawn and greys out rather than disappearing, because in
 * backtracking the abandoned paths are most of the story.
 */

const X_SPACING = 54;
const LEVEL_HEIGHT = 56;
const RADIUS = 14;
const TOP = 26;
const PAD_X = 34;

export function CallTreeView({ view }: { view: CallTreeViewModel }) {
  const at = new Map(
    view.nodes.map((node) => [node.id, { x: PAD_X + node.x * X_SPACING, y: TOP + node.depth * LEVEL_HEIGHT }])
  );
  const width = PAD_X * 2 + view.width * X_SPACING;
  const height = TOP + view.depth * LEVEL_HEIGHT + RADIUS + 18;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Call tree: ${view.nodes.length} calls explored`}
        className="mx-auto h-auto"
        style={{ width: "100%", maxWidth: width * 1.12, minWidth: Math.min(width, view.nodes.length * 26 + 60) }}
      >
        <AnimatePresence initial={false}>
          {view.nodes.map((node) => {
            if (!node.parent) return null;
            const from = at.get(node.parent);
            const to = at.get(node.id);
            if (!from || !to) return null;
            return (
              <motion.line
                key={`${node.parent}-${node.id}`}
                x1={from.x}
                y1={from.y + RADIUS}
                x2={to.x}
                y2={to.y - RADIUS}
                strokeWidth={1.4}
                className={cn(
                  node.returned?.deadEnd ? "stroke-blueprint-line" : "stroke-[var(--graphics-node)]"
                )}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: node.returned?.deadEnd ? 0.5 : 1 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              />
            );
          })}
        </AnimatePresence>

        {view.nodes.map((node) => {
          const spot = at.get(node.id)!;
          const abandoned = node.returned?.deadEnd === true;
          const running = node.id === view.activeId;
          const cached = node.cached === true;
          return (
            <g key={node.id} style={placeAt(spot.x, spot.y)}>
              <motion.g
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: abandoned ? 0.45 : 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
              >
                <title>{`${node.fn}(${node.args})${cached ? " — answered from the table" : ""}`}</title>
                <circle
                  r={RADIUS}
                  strokeWidth={running ? 2.5 : cached ? 2 : 1.5}
                  strokeDasharray={abandoned ? "3 3" : undefined}
                  className={cn(
                    "transition-[fill] duration-300",
                    running
                      ? "fill-[var(--fill-blue)] stroke-[var(--graphics-node)]"
                      : abandoned
                        ? "fill-card stroke-blueprint-line"
                        : // A call answered from the table did none of the work
                          // below it. It takes the weighed colour rather than
                          // the worked-for one, and a mark saying so.
                          cached
                          ? "fill-[var(--compare-soft)] stroke-[var(--compare)]"
                          : "fill-card stroke-[var(--graphics-node)]"
                  )}
                />
                {cached && (
                  // The subtree this call did not need. Drawn as a stub so the
                  // saving is visible as an absence, not merely as a colour.
                  <g className="stroke-[var(--compare)]" strokeWidth={1.2} strokeDasharray="2 3" fill="none">
                    <path d={`M -6 ${RADIUS} L -11 ${RADIUS + 11}`} />
                    <path d={`M 6 ${RADIUS} L 11 ${RADIUS + 11}`} />
                  </g>
                )}
                <text
                  y={4}
                  textAnchor="middle"
                  className={cn(
                    "font-mono text-[10px]",
                    running
                      ? "fill-[var(--fill-blue-text)]"
                      : abandoned
                        ? "fill-blueprint-muted"
                        : cached
                          ? "fill-[var(--compare-text)]"
                          : "fill-[var(--graphics-node)]"
                  )}
                >
                  {node.fn.slice(0, 4)}
                </text>
              </motion.g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
