import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, LogOut } from "lucide-react";
import { useSession } from "../../lib/session";
import { cn } from "../../lib/cn";
import { button } from "../ui";

const initials = (email: string) => {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
  return letters.toUpperCase() || "NO";
};

/** Avatar with a dropdown when signed in; a plain sign-in link otherwise. */
export function AccountMenu({ className }: { className?: string }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${email}`}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-blueprint-line bg-card text-sm font-semibold text-primary"
      >
        {initials(email)}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-[calc(100%+0.55rem)] z-[70] min-w-[220px] rounded-2xl border border-blueprint-line bg-card py-2 shadow-[0_18px_40px_rgba(0,0,0,0.14)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.32)]"
          >
            <p className="truncate px-4 pb-2 pt-1 text-xs text-blueprint-muted">{email}</p>
            <div className="my-1 h-px bg-blueprint-line" />
            <NavLink
              to="/dashboard"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-primary hover:bg-surface-hover"
            >
              <BarChart3 size={14} aria-hidden className="text-blueprint-muted" />
              Dashboard
            </NavLink>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void session.signOut();
              }}
              className="no-lift flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm text-primary hover:bg-surface-hover"
            >
              <LogOut size={14} aria-hidden className="text-blueprint-muted" />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
