import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "../lib/cn";

/**
 * The handle between two panels. Drag it to share the space differently,
 * double-click it to put things back, or focus it and use the arrow keys.
 *
 * Quiet until it is wanted: a hairline that turns the page's blue under the
 * pointer and while held, like the dividers in an IDE. The pointer is
 * captured on press, so a drag that crosses the trace's canvas or the editor
 * keeps going instead of being swallowed by them.
 */
export function Splitter({
  direction,
  label,
  value,
  onMove,
  onStep,
  onReset,
  className
}: {
  /** "x" divides left from right; "y" divides top from bottom. */
  direction: "x" | "y";
  label: string;
  /** Where the divider sits, 0 to 100, for assistive technology. */
  value: number;
  /** The pointer's position on the page while dragging. */
  onMove: (clientX: number, clientY: number) => void;
  /** A keyboard nudge: -1 towards the start, +1 towards the end. */
  onStep: (direction: -1 | 1) => void;
  onReset: () => void;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const frame = useRef(0);

  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    document.body.classList.add(direction === "x" ? "resizing-x" : "resizing-y");
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => onMove(clientX, clientY));
  };

  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    document.body.classList.remove("resizing-x", "resizing-y");
  };

  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const back = direction === "x" ? "ArrowLeft" : "ArrowUp";
    const forward = direction === "x" ? "ArrowRight" : "ArrowDown";
    if (event.key === back || event.key === forward) {
      event.preventDefault();
      onStep(event.key === back ? -1 : 1);
    } else if (event.key === "Home" || event.key === "Enter") {
      event.preventDefault();
      onReset();
    }
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={direction === "x" ? "vertical" : "horizontal"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      title="Drag to resize · double-click to reset"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
      onKeyDown={key}
      data-dragging={dragging || undefined}
      className={cn(
        "splitter group relative z-10 shrink-0 touch-none select-none outline-none",
        direction === "x" ? "w-3 cursor-col-resize" : "h-3 cursor-row-resize",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute rounded-full bg-transparent transition-[background-color,transform] duration-150",
          "group-hover:bg-[var(--fill-blue)] group-focus-visible:bg-[var(--fill-blue)] group-data-[dragging]:bg-[var(--fill-blue)]",
          direction === "x"
            ? "inset-y-2 left-1/2 w-[2px] -translate-x-1/2"
            : "inset-x-2 top-1/2 h-[2px] -translate-y-1/2"
        )}
      />
      {/* A grip that says "this moves" before the pointer finds out. */}
      <span
        aria-hidden
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blueprint-line transition-opacity duration-150",
          "group-hover:opacity-0 group-data-[dragging]:opacity-0",
          direction === "x" ? "h-8 w-[3px]" : "h-[3px] w-8"
        )}
      />
    </div>
  );
}
