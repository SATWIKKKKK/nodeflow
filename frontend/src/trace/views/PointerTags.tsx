import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { Tag } from "../model";

const TAG_HEIGHT = 17;
const TAG_GAP = 5;
const CHAR_WIDTH = 7.2;

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
                tag.changed ? "fill-primary stroke-primary" : "fill-card stroke-blueprint-line"
              )}
            />
            <text
              x={0}
              y={12.5}
              textAnchor="middle"
              className={cn("font-mono text-[11px]", tag.changed ? "fill-primary-foreground" : "fill-blueprint-muted")}
            >
              {label}
            </text>
          </motion.g>
        );
      })}
    </g>
  );
}
