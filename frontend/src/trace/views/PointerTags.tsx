import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { Tag } from "../model";

const TAG_HEIGHT = 17;
const TAG_GAP = 5;
const CHAR_WIDTH = 7.2;

export const tagMetrics = { height: TAG_HEIGHT, gap: TAG_GAP };

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

/**
 * Variable name pills stacked above a node (SVG). `bottom` is the y of the
 * lowest pill's bottom edge relative to the node centre.
 */
export function PointerTags({ tags, bottom }: { tags: { name: string; changed: boolean }[]; bottom: number }) {
  if (!tags.length) return null;
  const visible = tags.slice(0, 4);
  return (
    <g>
      <line x1={0} y1={bottom} x2={0} y2={bottom + 6} strokeWidth={1.5} className="stroke-blueprint-muted" />
      {visible.map((tag: Tag, level) => {
        const label = level === 3 && tags.length > 4 ? `+${tags.length - 3}` : tag.name;
        const width = label.length * CHAR_WIDTH + 16;
        const y = bottom - TAG_HEIGHT - level * (TAG_HEIGHT + TAG_GAP);
        return (
          <motion.g key={tag.name} initial={false} animate={{ y }} transition={{ type: "spring", stiffness: 260, damping: 28 }}>
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
