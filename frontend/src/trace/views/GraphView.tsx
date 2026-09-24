import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { GraphViewModel } from "../model";
import { ArrowMarkers } from "./ArrowMarkers";
import { PointerTags } from "./PointerTags";

const RADIUS = 16;

/** Adjacency lists drawn as a node-link diagram, nodes on a circle. */
export function GraphView({ view }: { view: GraphViewModel }) {
  const size = Math.max(260, Math.min(520, 90 + view.count * 34));
  const centre = size / 2;
  const ring = size / 2 - 58;
  const position = (node: number) => {
    if (view.count === 1) return { x: centre, y: centre };
    const angle = (node / view.count) * Math.PI * 2 - Math.PI / 2;
    return { x: centre + ring * Math.cos(angle), y: centre + ring * Math.sin(angle) };
  };
  const active = new Map(view.active.map((entry) => [entry.node, entry.names]));
  const onFront = new Set(view.frontier ?? []);
  // Queued beats settled: a node put back on the frontier is in play again.
  const settled = new Set((view.visited ?? []).filter((node) => !onFront.has(node)));
  const chosen = new Set(view.chosen ?? []);
  const rejected = new Set(view.rejected ?? []);
  const dormant = new Set(view.dormant ?? []);

  return (
    <div>
      <p className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-[13px] text-primary">{view.title}</span>
        <span className="text-technical-mono text-blueprint-muted">
          graph · {view.count} nodes · {view.edges.length} edges
        </span>
      </p>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Graph with ${view.count} nodes`}
        className="mx-auto h-auto w-full text-primary"
        style={{ maxWidth: size }}
      >
        <ArrowMarkers />
        {view.edges.map((edge) => {
          const from = position(edge.from);
          const to = position(edge.to);
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const length = Math.hypot(dx, dy) || 1;
          const x1 = from.x + (dx / length) * RADIUS;
          const y1 = from.y + (dy / length) * RADIUS;
          const x2 = to.x - (dx / length) * (RADIUS + (edge.directed ? 5 : 0));
          const y2 = to.y - (dy / length) * (RADIUS + (edge.directed ? 5 : 0));
          const hot = view.hotEdge === edge.key || (active.has(edge.from) && active.has(edge.to));
          const kept = chosen.has(edge.key);
          const turnedDown = rejected.has(edge.key);
          return (
            <g key={edge.key}>
              {edge.from === edge.to ? (
                <circle cx={from.x} cy={from.y - RADIUS - 8} r={9} fill="none" strokeWidth={1.4} className="stroke-blueprint-muted" />
              ) : (
                <motion.line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  // A kept edge is the thickest thing on screen; a turned-down
                  // one stays drawn but breaks into dashes, because an edge
                  // that vanished would read as one never weighed at all.
                  strokeWidth={kept ? 3 : hot ? 2.2 : 1.4}
                  strokeDasharray={turnedDown ? "4 4" : undefined}
                  markerEnd={edge.directed ? (hot || kept ? "url(#nf-arrow-strong)" : "url(#nf-arrow-soft)") : undefined}
                  initial={false}
                  animate={{ opacity: turnedDown ? 0.4 : dormant.has(edge.key) ? 0.28 : 1 }}
                  transition={{ duration: 0.3 }}
                  className={
                    kept ? "stroke-[var(--graphics-node)]" : hot ? "stroke-[var(--compare)]" : "stroke-blueprint-muted"
                  }
                />
              )}
              {edge.weight !== undefined && (
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 4}
                  textAnchor="middle"
                  className="fill-blueprint-muted font-mono text-[10.5px]"
                  paintOrder="stroke"
                  stroke="var(--card)"
                  strokeWidth={4}
                >
                  {edge.weight}
                </text>
              )}
            </g>
          );
        })}
        {Array.from({ length: view.count }, (_, node) => {
          const at = position(node);
          const names = active.get(node);
          const label = view.labels?.[node];
          return (
            <g key={node} transform={`translate(${at.x} ${at.y})`}>
              <motion.circle
                r={RADIUS}
                // Hue carries component identity, so it goes on the stroke and
                // leaves the accent fill free to keep meaning "this changed".
                strokeWidth={onFront.has(node) ? 2.5 : view.components ? 2.25 : 1.75}
                stroke={
                  onFront.has(node)
                    ? "var(--compare)"
                    : view.components
                      ? `var(--component-${view.components[node] % 6})`
                      : undefined
                }
                initial={false}
                animate={{ scale: names ? 1.12 : 1 }}
                className={cn(
                  "transition-[fill] duration-300",
                  !view.components && !onFront.has(node) && "stroke-[var(--graphics-node)]",
                  // A settled node steps back; the wavefront is what the reader
                  // should be following, and it has to beat the component hue.
                  names
                    ? "fill-[var(--fill-blue)]"
                    : onFront.has(node)
                      ? "fill-[var(--compare-soft)]"
                      : settled.has(node)
                        ? "fill-surface-inset"
                        : "fill-card"
                )}
              />
              {label && (
                // Below the node: the pointer pills stack above it, and a
                // distance sharing that space collides with them.
                <g transform={`translate(0 ${RADIUS + 13})`}>
                  {label.previous !== undefined && (
                    <text
                      x={-9}
                      textAnchor="end"
                      paintOrder="stroke"
                      stroke="var(--card)"
                      strokeWidth={3}
                      className="fill-blueprint-muted font-mono text-[9px] line-through"
                    >
                      {label.previous}
                    </text>
                  )}
                  <text
                    x={label.previous !== undefined ? 3 : 0}
                    textAnchor={label.previous !== undefined ? "start" : "middle"}
                    paintOrder="stroke"
                    stroke="var(--card)"
                    strokeWidth={3}
                    className={cn(
                      "font-mono text-[10px]",
                      label.previous !== undefined ? "fill-[var(--fill-blue)]" : "fill-blueprint-muted"
                    )}
                  >
                    {label.value}
                  </text>
                </g>
              )}
              <text
                y={4.5}
                textAnchor="middle"
                className={cn("font-mono text-[12px] font-medium", names ? "fill-[var(--fill-blue-text)]" : "fill-[var(--graphics-node)]")}
              >
                {node}
              </text>
              {names && <PointerTags tags={names.map((name) => ({ name, changed: true }))} bottom={-RADIUS - 8} />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
