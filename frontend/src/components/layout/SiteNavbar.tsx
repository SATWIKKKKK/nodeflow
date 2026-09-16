import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { useSession } from "../../lib/session";
import { cn } from "../../lib/cn";
import { Logo } from "../Logo";
import { ThemeToggle } from "../ThemeToggle";
import { button } from "../ui";
import { AccountMenu } from "./AccountMenu";

export const siteLinks = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/tracing", label: "Tracing" },
  { to: "/problems", label: "Problems" },
  { to: "/pricing", label: "Pricing" }
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(button.ghost, isActive && "bg-surface-hover");

/** Floating, sticky navbar for the public pages (DESIGN.md §10). */
export function SiteNavbar() {
  const session = useSession();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="sticky top-3 z-40 mx-3 sm:top-4 sm:mx-4">
      <nav
        aria-label="Primary"
        className="landing-navbar mx-auto max-w-[1440px] rounded-2xl border border-blueprint-line"
      >
        <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-2 sm:px-8 lg:px-12">
          <Logo markClassName="h-8 sm:h-9" />

          <div className="hidden items-center gap-1 lg:flex">
            {siteLinks.map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-2">
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
                <>
                  <NavLink to="/signin" className={cn(button.ghost, "px-4")}>
                    Sign in
                  </NavLink>
                  <NavLink to="/problems" className={button.primary}>
                    Start tracing <ArrowRight size={14} aria-hidden />
                  </NavLink>
                </>
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
              <div className="flex flex-col gap-1 border-t border-blueprint-line px-4 pb-4 pt-3 sm:px-8">
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
                    <>
                      <NavLink to="/problems" className={cn(button.primary, "w-full py-3")}>
                        Start tracing <ArrowRight size={14} aria-hidden />
                      </NavLink>
                      <NavLink to="/signin" className={cn(button.outline, "w-full")}>
                        Sign in
                      </NavLink>
                    </>
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
