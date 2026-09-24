import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { TrieViewModel } from "../model";
import { PointerTags } from "./PointerTags";
import { placeAt } from "./placeAt";

/**
 * A trie drawn by prefix: the character sits on the edge that reaches a node,
 * not inside it, because the character is the step and the node is the state
 * you are in after taking it. A node that finishes a word is filled.
 */

const X_SPACING = 46;
const LEVEL_HEIGHT = 62;
const RADIUS = 13;
// Clears the pointer pill that stacks above the root, which is drawn outside
// the node's own radius and would otherwise be cut off by the viewBox.
const TOP = 46;
const PAD_X = 32;

export function TrieView({ view }: { view: TrieViewModel }) {
  const at = new Map(
    view.nodes.map((node) => [node.id, { x: PAD_X + node.x * X_SPACING, y: TOP + node.depth * LEVEL_HEIGHT }])
  );
  const width = PAD_X * 2 + view.width * X_SPACING;
  const height = TOP + view.depth * LEVEL_HEIGHT + RADIUS + 20;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Trie with ${view.nodes.length} nodes`}
        className="mx-auto h-auto"
        style={{ width: "100%", maxWidth: width * 1.15, minWidth: Math.min(width, view.nodes.length * 28 + 60) }}
      >
        <AnimatePresence initial={false}>
          {view.edges.map((edge) => {
            const from = at.get(edge.from);
            const to = at.get(edge.to);
            if (!from || !to) return null;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const length = Math.hypot(dx, dy) || 1;
            return (
              <motion.g
                key={edge.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.18 } }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              >
                <line
                  x1={from.x + (dx / length) * RADIUS}
                  y1={from.y + (dy / length) * RADIUS}
                  x2={to.x - (dx / length) * RADIUS}
                  y2={to.y - (dy / length) * RADIUS}
                  strokeWidth={1.4}
                  className="stroke-blueprint-line"
                />
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 + 3}
                  textAnchor="middle"
                  paintOrder="stroke"
                  stroke="var(--card)"
                  strokeWidth={4}
                  className="fill-[var(--graphics-node)] font-mono text-[11px]"
                >
                  {edge.char}
                </text>
              </motion.g>
            );
          })}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {view.nodes.map((node) => {
            const spot = at.get(node.id)!;
            return (
              <g key={node.id} style={placeAt(spot.x, spot.y)}>
                <motion.g
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: "spring", stiffness: 240, damping: 28 }}
                >
                  <circle
                    r={RADIUS}
                    strokeWidth={node.comparing ? 2.25 : 1.5}
                    className={cn(
                      "transition-[fill] duration-300",
                      node.comparing
                        ? "fill-[var(--compare-soft)] stroke-[var(--compare)]"
                        : node.changed
                          ? "fill-[var(--fill-blue)] stroke-[var(--graphics-node)]"
                          : node.reading
                            ? "fill-card stroke-[var(--fill-blue)]"
                            : "fill-card stroke-[var(--graphics-node)]"
                    )}
                  />
                  {/* A word ends here: a filled core, distinct from merely
                      having children, which the outline alone cannot say. */}
                  {node.end && (
                    <circle
                      r={RADIUS - 4.5}
                      className={cn(
                        node.changed ? "fill-[var(--fill-blue-text)]" : "fill-[var(--graphics-node)]"
                      )}
                    />
                  )}
                  <PointerTags tags={node.tags} bottom={-RADIUS - 6} />
                </motion.g>
              </g>
            );
          })}
        </AnimatePresence>
      </svg>
    </div>
  );
}
