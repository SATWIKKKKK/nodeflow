import { useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../lib/cn";
import { LogoDrawIn } from "./graphics/LogoDrawIn";

/**
 * The Noesis mark: four list nodes wired into an N, the last one filled as the
 * node the trace is currently on. Drawn with currentColor so one component
 * serves both themes (DESIGN.md §8: 16px round strokes, r=22 nodes).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      stroke="currentColor"
      strokeWidth={16}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("h-8 w-auto", className)}
    >
      <path d="M96 294V106M110.7 100.4 289.3 299.6M304 294V106" />
      <circle cx="96" cy="316" r="22" />
      <circle cx="96" cy="84" r="22" />
      <circle cx="304" cy="316" r="22" />
      <circle cx="304" cy="84" r="22" fill="currentColor" />
    </svg>
  );
}

export function Logo({
  to = "/",
  className,
  markClassName,
  compact = false,
  animated = false
}: {
  to?: string;
  className?: string;
  markClassName?: string;
  compact?: boolean;
  /** Draws the mark stroke by stroke on first load, and again on hover. */
  animated?: boolean;
}) {
  const [playToken, setPlayToken] = useState(0);

  return (
    <NavLink
      to={to}
      aria-label="Noesis home"
      onMouseEnter={animated ? () => setPlayToken((token) => token + 1) : undefined}
      className={cn("inline-flex items-center gap-2.5 text-primary", className)}
    >
      {animated ? (
        <LogoDrawIn className={markClassName} playToken={playToken} title="Noesis" />
      ) : (
        <LogoMark className={markClassName} />
      )}
      {!compact && <span className="font-serif text-[1.65rem] leading-none tracking-[-0.01em]">Noesis</span>}
    </NavLink>
  );
}
