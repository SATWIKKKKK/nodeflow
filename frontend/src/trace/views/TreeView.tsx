import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { TreeViewModel } from "../model";
import { clearSide, PointerTags, sideAngle } from "./PointerTags";
import { placeAt } from "./placeAt";

const X_SPACING = 58;
const LEVEL_HEIGHT = 78;
const RADIUS = 20;
const TOP = 96;
const PAD_X = 40;

/**
 * The corner of a node for its visit-order badge: the diagonal furthest from
 * every edge and from the pointer pills. Fixed at the top right, it sat on the
 * line up to the parent of every left child.
 */
const badgeCorner = (taken: number[]) => {
  const corners = [-Math.PI / 4, (-3 * Math.PI) / 4, Math.PI / 4, (3 * Math.PI) / 4];
  const clearance = (angle: number) =>
    Math.min(
      Math.PI,
      ...taken.map((other) => {
        const turn = Math.abs(angle - other) % (Math.PI * 2);
        return Math.min(turn, Math.PI * 2 - turn);
      })
    );
  return corners.reduce((best, next) => (clearance(next) > clearance(best) + 0.01 ? next : best));
};

/** Binary trees laid out in-order: x follows sorted position, y follows depth. */
export function TreeView({ view }: { view: TreeViewModel }) {
  const position = new Map(
    view.nodes.map((node) => [node.id, { x: PAD_X + node.x * X_SPACING, y: TOP + node.depth * LEVEL_HEIGHT }])
  );
  const width = PAD_X * 2 + view.width * X_SPACING;
  const height = TOP + view.depth * LEVEL_HEIGHT + RADIUS + 24;
  const bearings = new Map<string, number[]>();
  const bear = (id: string, angle: number) => bearings.set(id, [...(bearings.get(id) ?? []), angle]);
  for (const edge of view.edges) {
    const from = position.get(edge.from);
    const to = position.get(edge.to);
    if (!from || !to) continue;
    bear(edge.from, Math.atan2(to.y - from.y, to.x - from.x));
    bear(edge.to, Math.atan2(from.y - to.y, from.x - to.x));
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Tree with ${view.nodes.length} nodes`}
        className="mx-auto h-auto overflow-visible text-primary"
        style={{ width: "100%", maxWidth: width * 1.15, minWidth: Math.min(width, view.nodes.length * 34 + 60) }}
      >
        <AnimatePresence initial={false}>
          {view.edges.map((edge) => {
            const from = position.get(edge.from);
            const to = position.get(edge.to);
            if (!from || !to) return null;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const length = Math.hypot(dx, dy) || 1;
            const x1 = from.x + (dx / length) * RADIUS;
            const y1 = from.y + (dy / length) * RADIUS;
            const x2 = to.x - (dx / length) * RADIUS;
            const y2 = to.y - (dy / length) * RADIUS;
            return (
              <motion.line
                key={edge.key}
                initial={{ opacity: 0, x1, y1, x2, y2 }}
                animate={{ opacity: 1, x1, y1, x2, y2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                strokeWidth={1.5}
                className="stroke-blueprint-muted"
              />
            );
          })}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {view.nodes.map((node) => {
            const at = position.get(node.id)!;
            const edges = bearings.get(node.id) ?? [];
            const below = node.meta ? [Math.PI / 2] : [];
            const side = clearSide(edges, below);
            const badge = badgeCorner([...edges, ...below, ...(node.tags.length ? [sideAngle(side)] : [])]);
            return (
              <g key={node.id} style={placeAt(at.x, at.y)}>
                <motion.g
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: "spring", stiffness: 240, damping: 28 }}
                >
                  <circle
                    r={RADIUS}
                    strokeWidth={node.comparing ? 2.25 : 1.75}
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
                  <text
                    y={4.5}
                    textAnchor="middle"
                    className={cn(
                      "font-mono text-[13px] font-medium transition-[fill] duration-300",
                      node.comparing
                        ? "fill-[var(--compare-text)]"
                        : node.changed
                          ? "fill-[var(--fill-blue-text)]"
                          : "fill-[var(--graphics-node)]"
                    )}
                  >
                    {node.label.length > 4 ? `${node.label.slice(0, 3)}…` : node.label}
                  </text>
                  {node.visit !== undefined && (
                    // Persists once set, so the finished order reads at a glance
                    // rather than only ever showing the current node.
                    <g transform={`translate(${Math.cos(badge) * (RADIUS + 1)} ${Math.sin(badge) * (RADIUS + 1)})`}>
                      <circle r={8} className="fill-[var(--fill-blue)]" />
                      <text
                        y={3}
                        textAnchor="middle"
                        className="fill-[var(--fill-blue-text)] font-mono text-[9px]"
                      >
                        {node.visit}
                      </text>
                    </g>
                  )}
                  {node.meta && (
                    // Haloed in the card colour so it stays readable where an
                    // edge passes underneath it.
                    <text
                      y={RADIUS + 13}
                      textAnchor="middle"
                      paintOrder="stroke"
                      stroke="var(--card)"
                      strokeWidth={4}
                      className="fill-blueprint-muted font-mono text-[9.5px]"
                    >
                      {node.meta}
                    </text>
                  )}
                  <PointerTags tags={node.tags} gap={RADIUS + 8} side={side} />
                </motion.g>
              </g>
            );
          })}
        </AnimatePresence>
      </svg>
    </div>
  );
}
