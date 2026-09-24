import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import { usePrefersReducedMotion } from "./useFrames";

/**
 * The logo, drawn rather than shown: the three strokes go down in the order a
 * hand would make them (left stem, diagonal, right stem), the four nodes pop
 * in, and the filled "current" node walks the N — bottom-left, top-left,
 * bottom-right, top-right — coming to rest exactly where the static mark has
 * it. About 900ms.
 *
 * Geometry is identical to components/Logo.tsx and public/favicon.svg; only the
 * timing lives here.
 */

const STROKES = ["M96 294V106", "M110.7 100.4 289.3 299.6", "M304 294V106"];
const NODES: Array<[number, number]> = [
  [96, 316],
  [96, 84],
  [304, 316],
  [304, 84]
];

const STROKE_MS = 0.16;
const NODES_AT = 0.52;
const WALK_AT = 0.66;
const HOP_MS = 0.13;

export function LogoDrawIn({
  className,
  /** Change this to replay — the nav logo bumps it on hover. */
  playToken = 0,
  title = "Noesis"
}: {
  className?: string;
  playToken?: number;
  title?: string;
}) {
  const reduced = usePrefersReducedMotion();

  const walk = NODES.map(([x]) => x);
  const walkY = NODES.map(([, y]) => y);
  // Hold each stop briefly, then hop: a step, not a glide.
  const times = [0, 0.18, 0.31, 0.49, 0.62, 0.8, 0.93, 1];
  const keyframeX = [walk[0], walk[0], walk[1], walk[1], walk[2], walk[2], walk[3], walk[3]];
  const keyframeY = [walkY[0], walkY[0], walkY[1], walkY[1], walkY[2], walkY[2], walkY[3], walkY[3]];

  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      stroke="var(--graphics-node)"
      strokeWidth={16}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={title}
      role="img"
      className={cn("h-8 w-auto", className)}
    >
      <g key={playToken}>
        {STROKES.map((d, index) => (
          <motion.path
            key={d}
            d={d}
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: STROKE_MS, delay: index * STROKE_MS, ease: "easeInOut" }}
          />
        ))}

        {NODES.map(([cx, cy], index) => (
          <motion.circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={22}
            stroke="var(--graphics-node)"
            initial={reduced ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
            transition={{
              duration: 0.14,
              delay: NODES_AT + index * 0.04,
              ease: [0.2, 0.8, 0.2, 1]
            }}
          />
        ))}

        {/* The one filled node: "you are here", walking the N. */}
        <motion.circle
          r={22}
          fill="var(--graphics-node)"
          initial={reduced ? false : { cx: walk[0], cy: walkY[0], opacity: 0 }}
          animate={
            reduced
              ? { cx: walk[3], cy: walkY[3], opacity: 1 }
              : { cx: keyframeX, cy: keyframeY, opacity: 1 }
          }
          transition={
            reduced
              ? { duration: 0 }
              : {
                  opacity: { duration: 0.1, delay: WALK_AT },
                  cx: { duration: HOP_MS * 8, delay: WALK_AT, times, ease: [0.2, 0.8, 0.2, 1] },
                  cy: { duration: HOP_MS * 8, delay: WALK_AT, times, ease: [0.2, 0.8, 0.2, 1] }
                }
          }
        />
      </g>
    </svg>
  );
}
