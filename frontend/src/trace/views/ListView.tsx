import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { ListEdgeModel, ListNodeModel, ListViewModel } from "../model";
import { ArrowMarkers } from "./ArrowMarkers";
import { PointerTags } from "./PointerTags";
import { placeAt } from "./placeAt";

/**
 * Linked lists in the landing-page style: ink circles, arrows that draw in when
 * a pointer is rewired, variable tags that spring between nodes.
 */

const SPACING = 124;
const RADIUS = 24;
const ROW_HEIGHT = 168;
const PAD_X = 44;
const NODE_Y = 86;

const cx = (node: ListNodeModel) => PAD_X + node.col * SPACING;
const cy = (node: ListNodeModel) => node.row * ROW_HEIGHT + NODE_Y;

function edgePath(edge: ListEdgeModel, from: ListNodeModel, to: ListNodeModel | undefined, doubly: boolean): string {
  const x1 = cx(from);
  const y1 = cy(from);

  if (!to) {
    const stub = 22;
    const y = doubly ? y1 - 6 : y1;
    return `M ${x1 + RADIUS + 3} ${y} H ${x1 + RADIUS + stub} M ${x1 + RADIUS + stub} ${y - 8} V ${y + 8}`;
  }

  const x2 = cx(to);
  const y2 = cy(to);

  if (edge.field === "child") {
    return `M ${x1} ${y1 + RADIUS + 3} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2 - RADIUS - 6}`;
  }

  if (edge.field === "random") {
    const lift = 30 + Math.abs(x2 - x1) * 0.12;
    const sy = y1 + RADIUS - 4;
    const ey = y2 + RADIUS + 2;
    return `M ${x1 + 6} ${sy} C ${x1 + 6} ${sy + lift}, ${x2 - 6} ${ey + lift}, ${x2 - 6} ${ey}`;
  }

  if (from.row !== to.row) {
    const startX = x1 + (x2 >= x1 ? RADIUS : -RADIUS);
    const endX = x2 + (x2 >= x1 ? -RADIUS - 6 : RADIUS + 6);
    const midX = (startX + endX) / 2;
    return `M ${startX} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${endX} ${y2}`;
  }

  const forward = x2 > x1;
  const adjacent = Math.abs(to.col - from.col) === 1;

  if (edge.field === "prev" && adjacent && !forward) {
    return `M ${x1 - RADIUS - 3} ${y1 + 6} L ${x2 + RADIUS + 7} ${y2 + 6}`;
  }
  if (edge.field === "next" && adjacent && forward) {
    const y = doubly ? y1 - 6 : y1;
    return `M ${x1 + RADIUS + 4} ${y} L ${x2 - RADIUS - 7} ${y}`;
  }

  // Backward or long pointers arc underneath so they never cross forward arrows.
  const lift = 34 + Math.abs(x2 - x1) * 0.08;
  const sx = x1 + (forward ? 8 : -8);
  const ex = x2 + (forward ? -8 : 8);
  const sy = y1 + RADIUS - 2;
  const ey = y2 + RADIUS + 5;
  if (x1 === x2) {
    // Self loop.
    return `M ${x1 + 10} ${sy} C ${x1 + 46} ${sy + 46}, ${x1 - 46} ${sy + 46}, ${x1 - 10} ${ey}`;
  }
  return `M ${sx} ${sy} C ${sx} ${sy + lift}, ${ex} ${ey + lift}, ${ex} ${ey}`;
}

export function ListView({ view }: { view: ListViewModel }) {
  const byId = new Map(view.nodes.map((node) => [node.id, node]));
  const doubly = view.edges.some((edge) => edge.field === "prev");
  const width = Math.max(1, view.cols) * SPACING + PAD_X * 2 - SPACING + 40;
  const height = Math.max(1, view.rows) * ROW_HEIGHT;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Linked list: ${view.nodes.map((node) => node.label).join(", ")}`}
        className="h-auto text-primary"
        style={{ width: "100%", minWidth: Math.min(width, view.cols * 70 + 80), maxHeight: height * 1.25 }}
      >
        <ArrowMarkers />

        <AnimatePresence initial={false}>
          {view.edges.map((edge) => {
            const from = byId.get(edge.from);
            if (!from) return null;
            const to = edge.to ? byId.get(edge.to) : undefined;
            if (edge.to && !to) return null;
            const dashed = edge.field === "random" || edge.field === "prev";
            return (
              <motion.path
                key={edge.key}
                d={edgePath(edge, from, to, doubly)}
                fill="none"
                stroke="currentColor"
                strokeWidth={edge.changed ? 2.25 : 1.5}
                strokeDasharray={edge.field === "random" ? "4 4" : undefined}
                strokeLinecap="round"
                markerEnd={to ? (edge.changed ? "url(#nf-arrow-strong)" : "url(#nf-arrow-soft)") : undefined}
                className={cn(
                  edge.changed ? "text-[var(--graphics-node)]" : "text-[var(--graphics-inactive)]",
                  dashed && !edge.changed && "opacity-70"
                )}
                initial={{ pathLength: 0, opacity: 0 }}
                // d is not animated: framer cannot morph a line into a curve and emits "undefined".
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.18 } }}
                transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
              />
            );
          })}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {view.nodes.map((node) => (
            <g key={node.id} style={placeAt(cx(node), cy(node))}>
              <motion.g
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
              >
                <circle
                  r={RADIUS}
                  strokeWidth={1.75}
                  className={cn("stroke-[var(--graphics-node)] transition-[fill] duration-300", node.changed ? "fill-[var(--fill-blue)]" : "fill-card")}
                />
                <text
                  y={5}
                  textAnchor="middle"
                  className={cn(
                    "font-mono text-[14px] font-medium transition-[fill] duration-300",
                    node.changed ? "fill-[var(--fill-blue-text)]" : "fill-[var(--graphics-node)]"
                  )}
                >
                  {node.label.length > 5 ? `${node.label.slice(0, 4)}…` : node.label}
                </text>
                <PointerTags tags={node.tags} bottom={-RADIUS - 8} />
              </motion.g>
            </g>
          ))}
        </AnimatePresence>
      </svg>
    </div>
  );
}
