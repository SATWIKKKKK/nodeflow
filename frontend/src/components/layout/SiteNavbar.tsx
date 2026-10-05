import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useSession } from "../../lib/session";
import { cn } from "../../lib/cn";
import { Logo } from "../Logo";
import { ThemeToggle } from "../ThemeToggle";
import { button } from "../ui";
import { AccountMenu } from "./AccountMenu";

export const siteLinks = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/problems", label: "Problems" },
  { to: "/classrooms", label: "Classrooms" },
  { to: "/pricing", label: "Pricing" }
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(button.ghost, isActive && "bg-surface-hover");

/**
 * The hook the navbar hangs from: a small tab on the top edge of the screen
 * and one short cord down to a ring on the bar. The tab holds a three-node
 * list that never stops: a pointer walks it, and every lap the arrows flip,
 * the list reversing. Decoration only, so it is hidden from assistive tech.
 */
function NavHanger() {
  return (
    <div aria-hidden className="nav-hanger pointer-events-none">
      <div className="nav-hanger-hook">
        <svg viewBox="0 0 64 16" className="h-3.5 w-14">
          <g className="nav-hanger-arrows">
            <path d="M 15 8 H 25 M 22.5 5.5 L 25 8 L 22.5 10.5" />
            <path d="M 37 8 H 47 M 44.5 5.5 L 47 8 L 44.5 10.5" />
          </g>
          <circle className="nav-hanger-node" cx="9" cy="8" r="4" />
          <circle className="nav-hanger-node" cx="31" cy="8" r="4" />
          <circle className="nav-hanger-node" cx="53" cy="8" r="4" />
        </svg>
      </div>
      <span className="nav-hanger-cord" />
      <span className="nav-hanger-ring" />
    </div>
  );
}

/** Floating, sticky navbar for the public pages, hung from the top edge (DESIGN.md §10). */
export function SiteNavbar() {
  const session = useSession();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  // Each touch of the bar restarts its swing: a mouse arriving, a finger or
  // pen landing, or keyboard focus coming in from outside.
  const [swing, setSwing] = useState(0);
  const nudge = () => setSwing((value) => value + 1);

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="nav-hang sticky top-0 z-40 mx-3 sm:mx-4">
      <nav
        aria-label="Primary"
        className={cn(
          "landing-navbar relative mx-auto max-w-5xl rounded-2xl border border-blueprint-line",
          swing === 0 ? "nav-settle" : swing % 2 ? "nav-swing-a" : "nav-swing-b"
        )}
        onPointerEnter={(event) => event.pointerType === "mouse" && nudge()}
        onPointerDown={(event) => event.pointerType !== "mouse" && nudge()}
        onFocus={(event) => !event.currentTarget.contains(event.relatedTarget as Node | null) && nudge()}
      >
        <NavHanger />
        {/* Three columns so the links sit on the true centre line, whatever the side widths. */}
        <div className="grid min-h-12 grid-cols-[1fr_auto] items-center gap-3 px-3 py-1.5 sm:px-5 lg:grid-cols-[1fr_auto_1fr]">
          <Logo animated markClassName="h-7 sm:h-8" />

          <div className="hidden items-center justify-center gap-1 lg:flex">
            {siteLinks.map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <ThemeToggle />
            <div className="hidden items-center gap-2 sm:flex">
              {session.user ? (
                <>
                  <NavLink to="/dashboard" className={button.ghost}>
                    Dashboard
                  </NavLink>
                  <AccountMenu />
                </>
              ) : (
                <NavLink to="/signin" className={cn(button.ghost, "px-4")}>
                  Sign in
                </NavLink>
              )}
            </div>
            <button
              type="button"
              className={cn(button.icon, "lg:hidden")}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X size={16} aria-hidden /> : <Menu size={16} aria-hidden />}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id="site-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden lg:hidden"
            >
              <div className="flex flex-col gap-1 border-t border-blueprint-line px-3 pb-4 pt-3 sm:px-5">
                {siteLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      cn(
                        "rounded-xl px-3 py-3 text-ui-label text-primary hover:bg-surface-hover",
                        isActive && "bg-surface-hover"
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
                <div className="mt-3 grid gap-2 sm:hidden">
                  {session.user ? (
                    <>
                      <NavLink to="/dashboard" className={cn(button.outline, "w-full")}>
                        Dashboard
                      </NavLink>
                      <button
                        type="button"
                        className={cn(button.primary, "w-full")}
                        onClick={() => void session.signOut()}
                      >
                        Sign out
                      </button>
                    </>
                  ) : (
                    <NavLink to="/signin" className={cn(button.outline, "w-full")}>
                      Sign in
                    </NavLink>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </div>
  );
}
