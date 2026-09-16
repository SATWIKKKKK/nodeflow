import { Suspense } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "../Logo";
import { PageLoader } from "../PageLoader";
import { ThemeToggle } from "../ThemeToggle";
import { button, container } from "../ui";

/** Sign in, sign up and reset: a quiet frame around one centred card. */
export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />

      <header className={`${container} relative z-10 flex h-20 items-center justify-between`}>
        <Logo markClassName="h-8 sm:h-9" />
        <div className="flex items-center gap-2">
          <NavLink to="/" className={`${button.ghost} hidden sm:inline-flex`}>
            <ArrowLeft size={14} aria-hidden /> Back to site
          </NavLink>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16 pt-6">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
