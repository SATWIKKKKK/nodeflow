import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

/** Opening waits a beat so a pointer passing over the trigger does not flash it. */
const OPEN_DELAY = 70;
/** Closing waits long enough to cross the gap between the trigger and the menu. */
const CLOSE_DELAY = 220;

export interface HoverOption<T extends string> {
  value: T;
  label: string;
  /** A second, quieter line or tag beside the label. */
  hint?: string;
}

/**
 * A select that behaves like the account menu: with a mouse it opens on
 * hover and closes when the pointer leaves; on touch and from the keyboard
 * it opens on press. Arrow keys move through the options, Enter picks one,
 * Escape or a click elsewhere closes it.
 *
 * The menu is drawn over the page at the trigger's position rather than
 * inside it, so a panel that clips its contents never cuts it short.
 */
export function HoverSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  align = "left",
  direction = "down",
  className,
  triggerClassName,
  renderValue,
  disabled,
  menuClassName
}: {
  value: T;
  options: HoverOption<T>[];
  onChange: (value: T) => void;
  /** Read out to assistive technology: "Language", "Playback speed". */
  label: string;
  align?: "left" | "right";
  /** Which way the menu opens: under the trigger, or above it near the bottom of a panel. */
  direction?: "down" | "up";
  className?: string;
  triggerClassName?: string;
  renderValue?: (option: HoverOption<T> | undefined) => ReactNode;
  disabled?: boolean;
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<CSSProperties>({});
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const current = options.find((option) => option.value === value);

  const later = (next: boolean, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), delay);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (open) setActive(Math.max(0, options.findIndex((option) => option.value === value)));
  }, [open, options, value]);

  useLayoutEffect(() => {
    if (!open) return;
    const box = root.current?.getBoundingClientRect();
    if (!box) return;
    setPlace({
      position: "fixed",
      ...(direction === "down" ? { top: box.bottom } : { bottom: window.innerHeight - box.top }),
      ...(align === "left" ? { left: box.left } : { right: window.innerWidth - box.right })
    });
  }, [open, direction, align]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !list.current?.contains(target)) setOpen(false);
    };
    // The menu is placed once; anything that moves the trigger closes it.
    const dismiss = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open]);

  const pick = (next: T) => {
    window.clearTimeout(timer.current);
    setOpen(false);
    if (next !== value) onChange(next);
  };

  const onKey = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (event.key === "Escape") {
      if (open) {
        event.stopPropagation();
        setOpen(false);
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + options.length) % options.length);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open && active >= 0) {
      event.preventDefault();
      pick(options[active].value);
    }
  };

  return (
    <div
      ref={root}
      className={cn("relative", className)}
      onPointerEnter={(event) => !disabled && event.pointerType === "mouse" && later(true, OPEN_DELAY)}
      onPointerLeave={(event) => event.pointerType === "mouse" && later(false, CLOSE_DELAY)}
      onKeyDown={onKey}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          window.clearTimeout(timer.current);
          setOpen((state) => !state);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? value}`}
        className={cn(
          "hover-select-trigger no-lift flex items-center gap-1.5 whitespace-nowrap",
          open && "is-open",
          triggerClassName
        )}
        style={{ minHeight: 0 }}
      >
        {renderValue ? renderValue(current) : <span>{current?.label ?? value}</span>}
        <ChevronDown
          size={13}
          aria-hidden
          className={cn("shrink-0 opacity-70 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            onPointerEnter={(event) => event.pointerType === "mouse" && window.clearTimeout(timer.current)}
            onPointerLeave={(event) => event.pointerType === "mouse" && later(false, CLOSE_DELAY)}
            onKeyDown={onKey}
            initial={{ opacity: 0, y: direction === "down" ? -6 : 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: direction === "down" ? -4 : 4, scale: 0.97, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 460, damping: 34, mass: 0.7 }}
            style={{ ...place, transformOrigin: `${direction === "down" ? "top" : "bottom"} ${align}` }}
            // The padding between trigger and panel is part of the hover area.
            className={cn("z-[80]", direction === "down" ? "pt-2" : "pb-2")}
          >
            <div
              ref={list}
              role="listbox"
              aria-label={label}
              className={cn(
                "neu-panel min-w-[168px] rounded-2xl border border-blueprint-line bg-card p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.14)]",
                menuClassName
              )}
            >
              {options.map((option, index) => {
                const selected = option.value === value;
                return (
                  <motion.button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => pick(option.value)}
                    onPointerEnter={() => setActive(index)}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.02 + index * 0.022, duration: 0.16 }}
                    className={cn(
                      "menu-item no-lift flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px]",
                      selected ? "font-semibold text-[var(--fill-blue)]" : "text-primary",
                      index === active && "is-active"
                    )}
                    style={{ minHeight: 0 }}
                  >
                    <span className="flex-1">{option.label}</span>
                    {option.hint && <span className="text-[11px] font-normal text-blueprint-muted">{option.hint}</span>}
                    <Check size={14} aria-hidden className={cn("shrink-0", selected ? "opacity-100" : "opacity-0")} />
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </div>
  );
}
