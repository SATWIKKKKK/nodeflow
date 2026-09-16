import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { BackgroundRippleEffect } from "../BackgroundRippleEffect";
import { PageLoader } from "../PageLoader";
import { SiteFooter } from "./SiteFooter";
import { SiteNavbar } from "./SiteNavbar";

/**
 * Public pages. The landing page gets the 40px blueprint grid plus the ripple
 * layer; every other public page gets the quieter 48px grid (DESIGN.md §9).
 */
export function MarketingLayout({ variant = "page" }: { variant?: "landing" | "page" }) {
  return (
    <div className="relative min-h-screen bg-background pt-3 sm:pt-4">
      {variant === "landing" ? (
        <>
          <div className="pointer-events-none fixed inset-0 landing-blueprint-grid opacity-30 dark:opacity-25" />
          <div className="pointer-events-none fixed inset-0 opacity-20 dark:opacity-30">
            <BackgroundRippleEffect rows={12} cols={32} cellSize={64} />
          </div>
        </>
      ) : (
        <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      )}

      <SiteNavbar />

      {/* On the landing page, empty hero space passes clicks through to the ripple grid. */}
      <main className={variant === "landing" ? "pointer-events-none relative z-10" : "relative z-10"}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}
