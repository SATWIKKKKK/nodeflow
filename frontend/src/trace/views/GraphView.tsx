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
          const hot = active.has(edge.from) && active.has(edge.to);
          return (
            <g key={edge.key}>
              {edge.from === edge.to ? (
                <circle cx={from.x} cy={from.y - RADIUS - 8} r={9} fill="none" strokeWidth={1.4} className="stroke-blueprint-muted" />
              ) : (
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  strokeWidth={hot ? 2.2 : 1.4}
                  markerEnd={edge.directed ? (hot ? "url(#nf-arrow-strong)" : "url(#nf-arrow-soft)") : undefined}
                  className={hot ? "stroke-[var(--graphics-node)]" : "stroke-blueprint-muted"}
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
          return (
            <g key={node} transform={`translate(${at.x} ${at.y})`}>
              <motion.circle
                r={RADIUS}
                strokeWidth={1.75}
                initial={false}
                animate={{ scale: names ? 1.12 : 1 }}
                className={cn("stroke-[var(--graphics-node)] transition-[fill] duration-300", names ? "fill-[var(--fill-blue)]" : "fill-card")}
              />
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
