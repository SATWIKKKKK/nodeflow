import { Suspense, useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  ChevronLeft,
  CreditCard,
  Layers3,
  ListChecks,
  LogIn,
  LogOut,
  Menu,
  MoonStar,
  SunMedium,
  Terminal,
  Workflow,
  X,
  type LucideIcon
} from "lucide-react";
import { useSession } from "../../lib/session";
import { useThemePreference } from "../../lib/theme";
import { cn } from "../../lib/cn";
import { Logo } from "../Logo";
import { PageLoader } from "../PageLoader";
import { ThemeToggle } from "../ThemeToggle";
import { button } from "../ui";
import { AccountMenu } from "./AccountMenu";
import { ProblemSearch } from "./ProblemSearch";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const primaryNav: NavItem[] = [
  { to: "/problems", label: "Problems", icon: ListChecks },
  { to: "/workspace", label: "Workspace", icon: Terminal },
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/problem-map", label: "Problem map", icon: Layers3 }
];

const learnNav: NavItem[] = [
  { to: "/how-it-works", label: "How it works", icon: Workflow },
  { to: "/tracing", label: "Tracing", icon: Activity },
  { to: "/pricing", label: "Pricing", icon: CreditCard }
];

const COLLAPSE_KEY = "noesis:sidebar-collapsed";

const titles: Record<string, string> = {
  "/problems": "Problems",
  "/dashboard": "Dashboard",
  "/problem-map": "Problem map"
};

function SideLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg border-l-2 border-transparent px-4 py-3 text-ui-label transition-colors",
          isActive
            ? "border-primary bg-surface-hover font-semibold text-primary"
            : "text-blueprint-muted hover:bg-surface-hover hover:text-primary",
          collapsed && "justify-center px-0"
        )
      }
    >
      <Icon size={17} aria-hidden className="shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
}

function SidebarBody({
  collapsed,
  onToggleCollapse
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
}) {
  const session = useSession();
  const { resolved, toggle } = useThemePreference();
  const ThemeIcon = resolved === "dark" ? SunMedium : MoonStar;

  const rowClass = cn(
    "no-lift flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-ui-label text-blueprint-muted transition-colors hover:bg-surface-hover hover:text-primary",
    collapsed && "justify-center px-0"
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-8">
      <div className={cn("mb-8 flex items-center", collapsed ? "justify-center" : "px-2")}>
        <Logo compact={collapsed} markClassName="h-10 sm:h-12" />
      </div>

      <nav aria-label="App" className="grid gap-1">
        {primaryNav.map((item) => (
          <SideLink key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <p className={cn("mb-2 mt-8 px-4 text-technical-mono text-blueprint-muted", collapsed && "sr-only")}>
        Learn
      </p>
      <nav aria-label="Learn" className={cn("grid gap-1", collapsed && "mt-8")}>
        {learnNav.map((item) => (
          <SideLink key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="mt-auto grid gap-1 border-t border-blueprint-line pt-4">
        <button type="button" onClick={toggle} className={rowClass} title={collapsed ? "Theme" : undefined}>
          <ThemeIcon size={17} aria-hidden className="shrink-0" />
          {!collapsed && <span>{resolved === "dark" ? "Light theme" : "Dark theme"}</span>}
        </button>

        {session.user ? (
          <button
            type="button"
            onClick={() => void session.signOut()}
            className={rowClass}
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut size={17} aria-hidden className="shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        ) : (
          <NavLink to="/signin" className={rowClass} title={collapsed ? "Sign in" : undefined}>
            <LogIn size={17} aria-hidden className="shrink-0" />
            {!collapsed && <span>Sign in</span>}
          </NavLink>
        )}

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={rowClass}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft
              size={17}
              aria-hidden
              className={cn("shrink-0 transition-transform", collapsed && "rotate-180")}
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
      </div>
    </div>
  );
}

/** Sidebar app frame for the signed-in style pages (DESIGN.md §10, App shell). */
export function AppShell({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [drawerOpen]);

  const toggleCollapse = () => {
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch {
        // Preference only lasts this visit.
      }
      return !value;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 84 : 280 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="relative hidden shrink-0 overflow-hidden border-r border-blueprint-line bg-background lg:block"
      >
        <SidebarBody collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </motion.aside>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-blueprint-line bg-background lg:hidden"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className={cn(button.close, "absolute right-4 top-8")}
                aria-label="Close navigation"
                style={{ minHeight: 0 }}
              >
                <X size={16} aria-hidden />
              </button>
              <SidebarBody collapsed={false} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 blueprint-grid opacity-30" />
        <header className="app-header relative z-40">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              className={cn(button.icon, "lg:hidden")}
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={16} aria-hidden />
            </button>
            <p className="min-w-0 flex-1 truncate text-ui-label text-blueprint-muted lg:flex-none lg:basis-40">
              {titles[location.pathname] ?? "Noesis"}
            </p>
            <div className="hidden flex-1 justify-center lg:flex">
              <ProblemSearch />
            </div>
            <div className="flex items-center gap-2 lg:basis-40 lg:justify-end">
              <ThemeToggle />
              <AccountMenu />
            </div>
          </div>
          <div className="px-4 pb-3 sm:px-6 lg:hidden">
            <ProblemSearch compact={false} className="max-w-none" />
          </div>
        </header>

        <main className="relative z-10 flex-1 overflow-y-auto">
          <Suspense fallback={<PageLoader />}>{children ?? <Outlet />}</Suspense>
        </main>
      </div>
    </div>
  );
}
