import { useMemo, useState, type CSSProperties } from "react";
import { cn } from "../lib/cn";

/**
 * A grid of faint cells behind the landing page. Hovering lifts a cell; clicking
 * one sends a ripple outward, each cell delayed by its distance from the click
 * (DESIGN.md §9: delay = distance × 55ms, duration = 200 + distance × 80ms).
 */
export function BackgroundRippleEffect({
  rows = 12,
  cols = 32,
  cellSize = 64,
  className
}: {
  rows?: number;
  cols?: number;
  cellSize?: number;
  className?: string;
}) {
  const [origin, setOrigin] = useState<{ row: number; col: number } | null>(null);
  const [rippleKey, setRippleKey] = useState(0);

  const cells = useMemo(() => Array.from({ length: rows * cols }, (_, index) => index), [rows, cols]);

  return (
    <div
      className={cn(
        "absolute inset-x-0 top-0 flex justify-center overflow-hidden mask-radial-from-20% mask-radial-at-top",
        className
      )}
      style={{ height: rows * cellSize }}
    >
      <div
        key={rippleKey}
        className="grid shrink-0"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`
        }}
      >
        {cells.map((index) => {
          const row = Math.floor(index / cols);
          const col = index % cols;
          const distance = origin ? Math.hypot(origin.row - row, origin.col - col) : 0;

          return (
            <div
              key={index}
              className={cn(
                "ripple-cell pointer-events-auto opacity-40 transition-opacity duration-150 hover:opacity-80",
                origin && "animate-cell-ripple"
              )}
              style={
                origin
                  ? ({
                      "--delay": `${Math.round(distance * 55)}ms`,
                      "--duration": `${Math.round(200 + distance * 80)}ms`
                    } as CSSProperties)
                  : undefined
              }
              onClick={() => {
                setOrigin({ row, col });
                setRippleKey((key) => key + 1);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
