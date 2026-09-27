import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { Tag } from "../model";

const TAG_HEIGHT = 17;
const TAG_GAP = 5;
const CHAR_WIDTH = 7.2;

export const tagMetrics = { height: TAG_HEIGHT, gap: TAG_GAP };
export const tagWidth = (name: string) => name.length * CHAR_WIDTH + 16;

const pill = (changed: boolean) =>
  cn(
    "transition-[fill] duration-300",
    changed ? "fill-[var(--fill-blue)] stroke-[var(--fill-blue)]" : "fill-card stroke-blueprint-line"
  );

export interface TravellingTag {
  name: string;
  changed: boolean;
  x: number;
  y: number;
  /** Lowest pill sits on the node, so only it draws the connector. */
  level: number;
}

/**
 * Variable pills that travel between nodes instead of vanishing from one and
 * appearing on another. A pointer walking a list is the thing the learner is
 * following, so it has to be the same object arriving somewhere new.
 *
 * Longer hops get a stiffer spring. With one shared config a pointer that moves
 * two nodes and one that moves one arrive together, which reads as the pair
 * moving in lockstep — exactly the wrong story for Floyd's two speeds.
 */
export function TravellingTags({ tags }: { tags: TravellingTag[] }) {
  return (
    <g>
      {tags.map((tag) => {
        const width = tag.name.length * CHAR_WIDTH + 16;
        return (
          <motion.g
            key={tag.name}
            initial={{ x: tag.x, y: tag.y, opacity: 0 }}
            animate={{ x: tag.x, y: tag.y, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{
              x: { type: "spring", stiffness: 210, damping: 26 },
              y: { type: "spring", stiffness: 260, damping: 28 },
              opacity: { duration: 0.2 }
            }}
          >
            {tag.level === 0 && (
              <line x1={0} y1={TAG_HEIGHT} x2={0} y2={TAG_HEIGHT + 6} strokeWidth={1.5} className="stroke-blueprint-muted" />
            )}
            <rect
              x={-width / 2}
              y={0}
              width={width}
              height={TAG_HEIGHT}
              rx={TAG_HEIGHT / 2}
              strokeWidth={1}
              className={pill(tag.changed)}
            />
            <text
              x={0}
              y={12.5}
              textAnchor="middle"
              className={cn(
                "font-mono text-[11px]",
                tag.changed ? "fill-[var(--fill-blue-text)]" : "fill-blueprint-muted"
              )}
            >
              {tag.name}
            </text>
          </motion.g>
        );
      })}
    </g>
  );
}

export type Side = "up" | "right" | "left" | "down";

const SIDES: Array<[Side, number]> = [
  ["up", -Math.PI / 2],
  ["right", 0],
  ["left", Math.PI],
  ["down", Math.PI / 2]
];

const apart = (a: number, b: number) => {
  const turn = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(turn, Math.PI * 2 - turn);
};

/**
 * The side of a node to hang its pointer pills on, given the directions its
 * edges leave in (radians, screen coordinates, so up is -π/2).
 *
 * Above is where a reader looks first, so it wins whenever it is clear. When
 * an edge arrives from above — a child's parent, a graph neighbour, the path
 * into a trie node — pills stacked there sit squarely on the line, and the
 * stack moves to whichever side is furthest from every edge. `taken` holds
 * directions already used by something else, such as a label below the node.
 */
export function clearSide(edges: number[], taken: number[] = []): Side {
  const clearance = (angle: number) => Math.min(Math.PI, ...[...edges, ...taken].map((edge) => apart(angle, edge)));
  const roomy = SIDES.find(([, angle]) => clearance(angle) >= (Math.PI * 7) / 18);
  if (roomy) return roomy[0];
  return SIDES.reduce((best, next) => (clearance(next[1]) > clearance(best[1]) + 0.01 ? next : best))[0];
}

/** Direction of a side, for anything else placed around the node to steer clear of. */
export const sideAngle = (side: Side) => SIDES.find(([name]) => name === side)![1];

/**
 * Variable name pills beside a node (SVG), in node-local coordinates. `gap` is
 * the distance from the node's centre to the nearest pill edge; a short stem
 * joins the stack to the node on that side.
 */
export function PointerTags({
  tags,
  gap,
  side = "up"
}: {
  tags: { name: string; changed: boolean }[];
  gap: number;
  side?: Side;
}) {
  if (!tags.length) return null;
  const visible = tags.slice(0, 4);
  const stem =
    side === "up"
      ? { x1: 0, y1: -gap, x2: 0, y2: -gap + 6 }
      : side === "down"
        ? { x1: 0, y1: gap, x2: 0, y2: gap - 6 }
        : side === "right"
          ? { x1: gap, y1: 0, x2: gap - 6, y2: 0 }
          : { x1: -gap, y1: 0, x2: -gap + 6, y2: 0 };
  return (
    <g>
      <line {...stem} strokeWidth={1.5} className="stroke-blueprint-muted" />
      {visible.map((tag: Tag, level) => {
        const label = level === 3 && tags.length > 4 ? `+${tags.length - 3}` : tag.name;
        const width = label.length * CHAR_WIDTH + 16;
        const step = level * (TAG_HEIGHT + TAG_GAP);
        // Sideways stacks grow downwards from the one level with the node's
        // centre, so the first pill always meets its stem.
        const x = side === "right" ? gap + width / 2 : side === "left" ? -gap - width / 2 : 0;
        const y = side === "up" ? -gap - TAG_HEIGHT - step : side === "down" ? gap + step : -TAG_HEIGHT / 2 + step;
        return (
          <motion.g key={tag.name} initial={false} animate={{ x, y }} transition={{ type: "spring", stiffness: 260, damping: 28 }}>
            <rect
              x={-width / 2}
              y={0}
              width={width}
              height={TAG_HEIGHT}
              rx={TAG_HEIGHT / 2}
              strokeWidth={1}
              className={cn(
                "transition-[fill] duration-300",
                tag.changed ? "fill-[var(--fill-blue)] stroke-[var(--fill-blue)]" : "fill-card stroke-blueprint-line"
              )}
            />
            <text
              x={0}
              y={12.5}
              textAnchor="middle"
              className={cn("font-mono text-[11px]", tag.changed ? "fill-[var(--fill-blue-text)]" : "fill-blueprint-muted")}
            >
              {label}
            </text>
          </motion.g>
        );
      })}
    </g>
  );
}
