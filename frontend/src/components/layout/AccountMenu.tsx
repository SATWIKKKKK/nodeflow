import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, History, Layers3, LogOut, Users, type LucideIcon } from "lucide-react";
import { useSession } from "../../lib/session";
import { cn } from "../../lib/cn";
import { button } from "../ui";

const initials = (email: string) => {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
  return letters.toUpperCase() || "NO";
};

const LINKS: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/continue", label: "Continue solving", icon: History },
  { to: "/problem-map", label: "Problem map", icon: Layers3 },
  { to: "/classrooms", label: "Classrooms", icon: Users }
];

/** Opening waits a beat so a pointer passing over the avatar does not flash it. */
const OPEN_DELAY = 70;
/** Closing waits long enough to cross the gap between the avatar and the menu. */
const CLOSE_DELAY = 220;

/**
 * The avatar, and the account menu under it.
 *
 * With a mouse the menu opens on hover and closes when the pointer leaves;
 * on touch, and from the keyboard, it opens on press. Escape or a click
 * elsewhere closes it either way.
 */
export function AccountMenu({ className }: { className?: string }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const later = (next: boolean, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), delay);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!session.user) {
    return (
      <NavLink to="/signin" className={cn(button.outlineSm, "px-4 py-2", className)}>
        Sign in
      </NavLink>
    );
  }

  const { email } = session.user;

  return (
    <div
      ref={root}
      className={cn("relative", className)}
      onPointerEnter={(event) => event.pointerType === "mouse" && later(true, OPEN_DELAY)}
      onPointerLeave={(event) => event.pointerType === "mouse" && later(false, CLOSE_DELAY)}
    >
      <button
        type="button"
        onClick={() => {
          window.clearTimeout(timer.current);
          setOpen((value) => !value);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${email}`}
        className="neu-icon flex h-10 w-10 items-center justify-center rounded-full border border-blueprint-line bg-card text-sm font-semibold text-primary"
      >
        {initials(email)}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 460, damping: 34, mass: 0.7 }}
            style={{ transformOrigin: "top right" }}
            // The padding above the panel is part of the hover area, so the
            // pointer can travel from the avatar to the menu without closing it.
            className="absolute right-0 top-full z-[70] pt-3"
          >
            <div className="neu-panel min-w-[240px] rounded-2xl border border-blueprint-line bg-card p-2 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
              <div className="flex items-center gap-3 px-3 pb-3 pt-2">
                <span className="neu-well flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blueprint-line bg-card text-xs font-semibold text-[var(--fill-blue)]">
                  {initials(email)}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-blueprint-muted">Signed in as</span>
                  <span className="block truncate text-sm font-medium text-primary">{email}</span>
                </span>
              </div>
              <div className="neu-groove-t mx-2 mb-1 h-px bg-blueprint-line" />
              {LINKS.map((link, index) => {
                const Icon = link.icon;
                return (
                  <motion.div
                    key={link.to}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.03 + index * 0.025, duration: 0.18 }}
                  >
                    <NavLink
                      to={link.to}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="menu-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-primary"
                    >
                      <Icon size={15} aria-hidden className="text-blueprint-muted" />
                      {link.label}
                    </NavLink>
                  </motion.div>
                );
              })}
              <div className="neu-groove-t mx-2 my-1 h-px bg-blueprint-line" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void session.signOut();
                }}
                className="menu-item no-lift flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-primary"
                style={{ minHeight: 0 }}
              >
                <LogOut size={15} aria-hidden className="text-blueprint-muted" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
