import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";
import { chip } from "./ui";

interface ChipOption {
  id: string;
  label: string;
}

/**
 * One row of filter chips that scrolls sideways instead of wrapping. Arrow
 * buttons appear only on the side that has more chips, and the active chip is
 * kept in view when the selection changes.
 */
export function ChipScroller({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: ChipOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const element = track.current;
    if (!element) return;
    setEdges({
      left: element.scrollLeft > 2,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2
    });
  }, []);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure, options.length]);

  useEffect(() => {
    const element = track.current;
    const active = element?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!element || !active) return;
    // Scroll the track only; scrollIntoView would also move the page.
    const left = active.offsetLeft - element.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < element.scrollLeft + 40) element.scrollTo({ left: Math.max(0, left - 40), behavior: "smooth" });
    else if (right > element.scrollLeft + element.clientWidth - 40) {
      element.scrollTo({ left: right - element.clientWidth + 40, behavior: "smooth" });
    }
  }, [value, options.length]);

  const nudge = (direction: 1 | -1) => {
    const element = track.current;
    if (!element) return;
    element.scrollBy({ left: direction * Math.max(160, element.clientWidth * 0.7), behavior: "smooth" });
  };

  const arrow = (direction: 1 | -1, visible: boolean) => (
    <button
      type="button"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      aria-label={direction < 0 ? `Scroll ${label} left` : `Scroll ${label} right`}
      onClick={() => nudge(direction)}
      className={cn(
        "no-lift absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-blueprint-line bg-card text-primary shadow-[0_4px_14px_rgba(0,0,0,0.12)] transition-opacity hover:bg-surface-hover",
        direction < 0 ? "left-0" : "right-0",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      style={{ minHeight: 0 }}
    >
      {direction < 0 ? <ChevronLeft size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
    </button>
  );

  return (
    // min-w-0: inside a grid or flex parent, the chip track must not widen its container.
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-24 shrink-0 text-technical-mono text-blueprint-muted">{label}</span>
      <div className="relative min-w-0 flex-1">
        {arrow(-1, edges.left)}
        <div
          ref={track}
          role="group"
          aria-label={label}
          onScroll={measure}
          className="no-scrollbar flex gap-2 overflow-x-auto scroll-smooth py-1"
          style={{
            maskImage: `linear-gradient(to right, ${edges.left ? "transparent, black 48px" : "black, black"}, ${
              edges.right ? "black calc(100% - 48px), transparent" : "black"
            })`
          }}
        >
          {options.map((option) => {
            const active = value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(option.id)}
                className={cn(
                  chip.base,
                  "no-lift shrink-0 hover:bg-surface-hover",
                  active && chip.active,
                  active && "hover:bg-[var(--fill-blue-hover)]"
                )}
                style={{ minHeight: 0 }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {arrow(1, edges.right)}
      </div>
    </div>
  );
}
