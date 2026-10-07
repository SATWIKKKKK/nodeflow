import type { ComponentType, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "../../lib/cn";

/**
 * A panel's title row: its tabs on the left, its tools on the right.
 *
 * Tabs are words with an icon, not buttons in boxes; the open one is in full
 * ink with a short blue rule under it that slides to whichever tab is picked.
 * Tools are bare icons that only take a tint under the pointer, so the row
 * reads as one quiet strip, the way an IDE's does.
 */

export interface PanelTab<T extends string> {
  id: T;
  label: string;
  /** What a phone shows when the full label would not fit. */
  shortLabel?: string;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  /** A small mark after the label: a dot for "something new here". */
  badge?: ReactNode;
}

export function PanelBar<T extends string>({
  name,
  tabs,
  active,
  onTab,
  children,
  className
}: {
  /** Names the tab group, and keeps each panel's sliding rule its own. */
  name: string;
  tabs: PanelTab<T>[];
  active: T | null;
  onTab?: (tab: T) => void;
  children?: ReactNode;
  className?: string;
}) {
  const still = useReducedMotion();
  return (
    <div
      className={cn(
        "panel-bar relative flex h-10 shrink-0 items-center gap-1 border-b border-blueprint-line pl-1.5 pr-1.5",
        className
      )}
    >
      <div
        role="tablist"
        aria-label={name}
        className="flat-tabs flex min-w-0 items-center gap-0.5 self-stretch overflow-x-auto [scrollbar-width:none]"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected || active === null ? 0 : -1}
              onClick={() => onTab?.(tab.id)}
              className={cn(
                "no-lift relative flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                selected ? "text-primary" : "text-blueprint-muted hover:bg-surface-hover hover:text-primary"
              )}
              style={{ minHeight: 0 }}
            >
              <Icon size={14} aria-hidden className={cn("shrink-0", selected && "text-[var(--fill-blue)]")} />
              {tab.shortLabel ? (
                <>
                  <span className="whitespace-nowrap sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden whitespace-nowrap sm:inline">{tab.label}</span>
                </>
              ) : (
                <span className="whitespace-nowrap">{tab.label}</span>
              )}
              {tab.badge}
              {selected && (
                <motion.span
                  layoutId={still ? undefined : `panel-tab-${name}`}
                  className="absolute inset-x-2 -bottom-[4px] h-[2px] rounded-full bg-[var(--fill-blue)]"
                  transition={{ type: "spring", stiffness: 520, damping: 40 }}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1 pl-2">{children}</div>
    </div>
  );
}

/** A few tools side by side. */
export function ToolGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("flex items-center gap-0.5", className)}>{children}</span>;
}

/** A bare icon tool for a panel bar or a toolbar. */
export function ToolButton({
  label,
  onClick,
  disabled,
  pressed,
  className,
  children
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      data-tip={label}
      className={cn(
        "tool-button no-lift relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-blueprint-muted transition-colors",
        "hover:bg-surface-hover hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        pressed && "text-primary",
        className
      )}
      style={{ minHeight: 0 }}
    >
      {children}
    </button>
  );
}

/** Maximise and minimise for a panel, as LeetCode puts them on each one. */
export function PanelSizeTools({
  maximized,
  onMaximize,
  collapsed,
  onCollapse,
  collapseAxis = "y"
}: {
  maximized: boolean;
  onMaximize: () => void;
  collapsed?: boolean;
  onCollapse?: () => void;
  collapseAxis?: "x" | "y";
}) {
  return (
    <ToolGroup className="hidden lg:flex">
      {onCollapse && !maximized && (
        <ToolButton label={collapsed ? "Expand" : "Minimize"} onClick={onCollapse}>
          {collapseAxis === "y" ? (
            collapsed ? (
              <ChevronDown size={15} aria-hidden />
            ) : (
              <ChevronUp size={15} aria-hidden />
            )
          ) : (
            <ChevronDown size={15} aria-hidden className="rotate-90" />
          )}
        </ToolButton>
      )}
      <ToolButton label={maximized ? "Restore" : "Maximize"} onClick={onMaximize}>
        {maximized ? <Minimize2 size={13} aria-hidden /> : <Maximize2 size={13} aria-hidden />}
      </ToolButton>
    </ToolGroup>
  );
}
