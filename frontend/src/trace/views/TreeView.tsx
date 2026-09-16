import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { TreeViewModel } from "../model";
import { PointerTags } from "./PointerTags";

const X_SPACING = 58;
const LEVEL_HEIGHT = 78;
const RADIUS = 20;
const TOP = 96;
const PAD_X = 40;

/** Binary trees laid out in-order: x follows sorted position, y follows depth. */
export function TreeView({ view }: { view: TreeViewModel }) {
  const position = new Map(
    view.nodes.map((node) => [node.id, { x: PAD_X + node.x * X_SPACING, y: TOP + node.depth * LEVEL_HEIGHT }])
  );
  const width = PAD_X * 2 + view.width * X_SPACING;
  const height = TOP + view.depth * LEVEL_HEIGHT + RADIUS + 24;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Tree with ${view.nodes.length} nodes`}
        className="mx-auto h-auto text-primary"
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
            return (
              <motion.g
                key={node.id}
                initial={{ opacity: 0, scale: 0.6, x: at.x, y: at.y }}
                animate={{ opacity: 1, scale: 1, x: at.x, y: at.y }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: "spring", stiffness: 240, damping: 28 }}
              >
                <circle
                  r={RADIUS}
                  strokeWidth={1.75}
                  className={cn("stroke-primary transition-[fill] duration-300", node.changed ? "fill-primary" : "fill-card")}
                />
                <text
                  y={4.5}
                  textAnchor="middle"
                  className={cn(
                    "font-mono text-[13px] font-medium transition-[fill] duration-300",
                    node.changed ? "fill-primary-foreground" : "fill-primary"
                  )}
                >
                  {node.label.length > 4 ? `${node.label.slice(0, 3)}…` : node.label}
                </text>
                <PointerTags tags={node.tags} bottom={-RADIUS - 8} />
              </motion.g>
            );
          })}
        </AnimatePresence>
      </svg>
    </div>
  );
}
