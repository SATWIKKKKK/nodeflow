import { cn } from "../../lib/cn";
import { useFrames } from "./useFrames";

/**
 * The oversized logo that fills the CTA panel's empty top-right: the same mark,
 * drawn thin and bleeding off the corner, with the filled node idling on it.
 *
 * Hovering "Open the workspace" sets `active`, and the node walks the mark the
 * way `current` walks the list — up the left stem, down the diagonal, up the
 * right stem — lighting each stroke as it passes.
 */

const STROKES = ["M96 294V106", "M110.7 100.4 289.3 299.6", "M304 294V106"];
const NODES: Array<[number, number]> = [
  [96, 316],
  [96, 84],
  [304, 316],
  [304, 84]
];

export function CtaLogoField({ active, className }: { active: boolean; className?: string }) {
  // Four stops; the walk only runs while the CTA is hovered, and it parks on
  // the last node — which is the one the static logo fills.
  const { index } = useFrames(NODES.length, {
    intervalMs: 460,
    holdStartMs: 600,
    holdEndMs: 900,
    active
  });

  const stop = active ? index : NODES.length - 1;
  const [cx, cy] = NODES[stop];

  return (
    <div
      aria-hidden
      className={cn("graphics-inverted pointer-events-none absolute select-none", className)}
      // The mark bleeds off the corner and dissolves before it reaches the
      // buttons, so nothing is drawn over something that has to stay readable.
      style={{
        maskImage: "linear-gradient(200deg, #000 38%, transparent 72%)",
        WebkitMaskImage: "linear-gradient(200deg, #000 38%, transparent 72%)"
      }}
    >
      <svg viewBox="0 0 400 400" fill="none" className="h-full w-full">
        {STROKES.map((d, i) => {
          // A stroke is "travelled" once the walker has passed its far end.
          const travelled = active && stop > i;
          return (
            <path
              key={d}
              d={d}
              stroke={travelled ? "var(--graphics-accent)" : "var(--graphics-ink)"}
              strokeOpacity={travelled ? 0.7 : 0.16}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transition: "stroke 600ms linear, stroke-opacity 600ms linear" }}
            />
          );
        })}

        {NODES.map(([x, y]) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r={22}
            stroke="var(--graphics-ink)"
            strokeOpacity={0.16}
            strokeWidth={5}
          />
        ))}

        <circle
          cx={cx}
          cy={cy}
          r={22}
          fill="var(--graphics-ink)"
          fillOpacity={active ? 0.6 : 0.3}
          style={{
            transition: "cx 400ms cubic-bezier(.2,.8,.2,1), cy 400ms cubic-bezier(.2,.8,.2,1)"
          }}
        />
      </svg>
    </div>
  );
}
