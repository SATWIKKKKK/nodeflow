import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { AuthLayout } from "./components/layout/AuthLayout";
import { MarketingLayout } from "./components/layout/MarketingLayout";
import { RouteProgress } from "./components/layout/RouteProgress";
import { PageLoader } from "./components/PageLoader";
import { INFO_PAGES } from "./pages/infoPages";

const LandingPage = lazy(() => import("./landing/LandingPage"));
const WorkspacePage = lazy(() => import("./workspace/WorkspacePage"));
const ProblemsPage = lazy(() => import("./pages/ProblemsPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const HowItWorksPage = lazy(() => import("./pages/HowItWorksPage"));
const TracingPage = lazy(() => import("./pages/TracingPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ProblemMapPage = lazy(() => import("./pages/ProblemMapPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ClassroomsPage = lazy(() => import("./pages/ClassroomsPage"));
const ClassroomPage = lazy(() => import("./pages/ClassroomPage"));
const InfoPage = lazy(() => import("./pages/InfoPage"));

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

export default function App() {
  return (
    <>
      <RouteProgress />
      <ScrollToTop />
      <Routes>
        <Route element={<MarketingLayout variant="landing" />}>
          <Route index element={<LandingPage />} />
        </Route>

        <Route element={<MarketingLayout />}>
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/tracing" element={<TracingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          {INFO_PAGES.map((page) => (
            <Route key={page.path} path={page.path} element={<InfoPage page={page} />} />
          ))}
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="/signin" element={<AuthPage mode="signin" />} />
          <Route path="/login" element={<Navigate to="/signin" replace />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
          <Route path="/reset-password" element={<AuthPage mode="reset" />} />
        </Route>

        <Route element={<AppShell />}>
          <Route path="/problems" element={<ProblemsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/problem-map" element={<ProblemMapPage />} />
          <Route path="/classrooms" element={<ClassroomsPage />} />
          <Route path="/classrooms/:classroomId" element={<ClassroomPage />} />
        </Route>

        {/* The workspace is a full-viewport tool with its own slim header. */}
        <Route
          path="/workspace/:problemId?"
          element={
            <Suspense fallback={<PageLoader className="min-h-screen" />}>
              <WorkspacePage />
            </Suspense>
          }
        />

        {/* Legacy paths and typos fall back to the landing page. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
