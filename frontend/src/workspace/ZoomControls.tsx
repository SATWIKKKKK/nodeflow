import { Minus, Plus, RotateCcw } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * Zoom for a replay panel.
 *
 * Both views need it for the same reason and neither had it: a long chain or a
 * wide table runs off the panel, and a small one leaves the reader squinting.
 * The 3D view could already be zoomed with a scroll wheel, which is no use to
 * anyone who has not thought to try it, so the control is the same in both
 * places whatever is underneath.
 */

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.5;
export const ZOOM_STEP = 0.2;

export const clampZoom = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(value.toFixed(2))));

export function ZoomControls({
  zoom,
  onZoom,
  onReset,
  className,
  compact = false
}: {
  /** Shown as a percentage. For 3D this is a notional level, not a scale. */
  zoom: number;
  onZoom: (direction: 1 | -1) => void;
  onReset: () => void;
  className?: string;
  /** Just minus, level and plus: for a toolbar with no room to spare. */
  compact?: boolean;
}) {
  const button = "no-lift flex h-7 w-7 items-center justify-center rounded-full text-blueprint-muted hover:text-primary disabled:opacity-40";
  return (
    <div
      className={cn(
        "neu-pill flex items-center gap-0.5 rounded-full border border-blueprint-line bg-card/90 px-1 py-0.5 backdrop-blur",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onZoom(-1)}
        disabled={zoom <= ZOOM_MIN}
        className={button}
        style={{ minHeight: 0 }}
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus size={13} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onReset}
        className={cn(
          "no-lift rounded-full px-1 font-mono text-[11px] text-blueprint-muted hover:text-primary",
          compact ? "min-w-[2.6rem]" : "min-w-[3.2rem]"
        )}
        style={{ minHeight: 0 }}
        aria-label="Reset zoom"
        title="Reset zoom"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        onClick={() => onZoom(1)}
        disabled={zoom >= ZOOM_MAX}
        className={button}
        style={{ minHeight: 0 }}
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus size={13} aria-hidden />
      </button>
      {!compact && <span className="mx-0.5 h-4 w-px bg-blueprint-line" aria-hidden />}
      <button
        type="button"
        onClick={onReset}
        className={cn(button, compact && "hidden")}
        style={{ minHeight: 0 }}
        aria-label="Fit to view"
        title="Fit to view"
      >
        <RotateCcw size={12} aria-hidden />
      </button>
    </div>
  );
}
