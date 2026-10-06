import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { AuthLayout } from "./components/layout/AuthLayout";
import { MarketingLayout } from "./components/layout/MarketingLayout";
import { RouteProgress } from "./components/layout/RouteProgress";
import { PageLoader } from "./components/PageLoader";
import { INFO_PAGES } from "./pages/infoPages";
import { useSession } from "./lib/session";
import { CoinsSync } from "./lib/coins";
import { CoinCelebration } from "./components/CoinCelebration";
import { useRouteMeta } from "./lib/seo";

const LandingPage = lazy(() => import("./landing/LandingPage"));
const WorkspacePage = lazy(() => import("./workspace/WorkspacePage"));
const ProblemsPage = lazy(() => import("./pages/ProblemsPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const DocsPage = lazy(() => import("./pages/DocsPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ProblemMapPage = lazy(() => import("./pages/ProblemMapPage"));
const ContinuePage = lazy(() => import("./pages/ContinuePage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ClassroomsPage = lazy(() => import("./pages/ClassroomsPage"));
const ClassroomPage = lazy(() => import("./pages/ClassroomPage"));
const InfoPage = lazy(() => import("./pages/InfoPage"));
const DevGraphicsPage = lazy(() => import("./pages/DevGraphicsPage"));

/**
 * Every route change starts at the top. Hash links (/#replay) wait for the
 * lazily loaded page to render its target, then scroll to it.
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }

    let frame = 0;
    let tries = 0;
    const seek = () => {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (tries++ < 90) frame = window.requestAnimationFrame(seek);
    };
    seek();
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
}

/**
 * Pages anyone may read. Everything else, the problem bank, the workspace,
 * progress, classrooms, pricing and the roadmap, is for signed-in learners.
 */
const PUBLIC_INFO = new Set(["/about", "/contact", "/privacy", "/terms", "/security"]);

/**
 * Lets a signed-in learner straight through and sends anyone else to sign in,
 * then back to where they were going.
 *
 * The session is read from storage before the first render, so a learner who
 * has signed in once is never bounced while it is being checked; only a token
 * the server has actually rejected (or signing out) ends it.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (session.user) return <>{children}</>;
  if (session.loading) return <PageLoader className="min-h-screen" />;
  const next = `${location.pathname}${location.search}${location.hash}`;
  return <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />;
}

/**
 * Home is the dashboard for anyone signed in: they have a record and unfinished
 * problems to get back to, and the pitch on the landing page is for newcomers.
 *
 * Decided above the landing layout, not inside it. Redirecting from inside
 * drew the layout (navbar and footer) for a frame first, so a signed-in
 * learner saw the footer flash on every trip home.
 */
function HomeGate() {
  const session = useSession();
  if (session.user) return <Navigate to="/dashboard" replace />;
  return <MarketingLayout variant="landing" />;
}

export default function App() {
  useRouteMeta();
  return (
    <>
      <RouteProgress />
      <ScrollToTop />
      <CoinsSync />
      <CoinCelebration />
      <Routes>
        <Route element={<HomeGate />}>
          <Route index element={<LandingPage />} />
        </Route>

        <Route element={<MarketingLayout />}>
          <Route path="/docs" element={<DocsPage />} />
          <Route
            path="/pricing"
            element={
              <RequireAuth>
                <PricingPage />
              </RequireAuth>
            }
          />
          {INFO_PAGES.map((page) => (
            <Route
              key={page.path}
              path={page.path}
              element={
                PUBLIC_INFO.has(page.path) ? (
                  <InfoPage page={page} />
                ) : (
                  <RequireAuth>
                    <InfoPage page={page} />
                  </RequireAuth>
                )
              }
            />
          ))}
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="/signin" element={<AuthPage mode="signin" />} />
          <Route path="/login" element={<Navigate to="/signin" replace />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
          <Route path="/reset-password" element={<AuthPage mode="reset" />} />
        </Route>

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/problems" element={<ProblemsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/problem-map" element={<ProblemMapPage />} />
          <Route path="/continue" element={<ContinuePage />} />
          <Route path="/classrooms" element={<ClassroomsPage />} />
          <Route path="/classrooms/:classroomId" element={<ClassroomPage />} />
        </Route>

        {/* The workspace is a full-viewport tool with its own slim header. */}
        <Route
          path="/workspace/:problemId?"
          element={
            <RequireAuth>
              <Suspense fallback={<PageLoader className="min-h-screen" />}>
                <WorkspacePage />
              </Suspense>
            </RequireAuth>
          }
        />

        {/* Contact sheet for the illustration library; not linked from the site. */}
        <Route
          path="/dev/graphics"
          element={
            <RequireAuth>
              <Suspense fallback={<PageLoader className="min-h-screen" />}>
                <DevGraphicsPage />
              </Suspense>
            </RequireAuth>
          }
        />

        {/* The guide and the tracing explainer became the docs. */}
        <Route path="/how-it-works" element={<Navigate to="/docs" replace />} />
        <Route path="/tracing" element={<Navigate to="/docs#section-4-1" replace />} />

        {/* Legacy paths and typos fall back to the landing page. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
