import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * 2px bar across the top on every route change (DESIGN.md §11):
 * 18% → 72% at 80ms → 100% at 260ms, hidden at 520ms.
 */
export function RouteProgress() {
  const location = useLocation();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }

    setVisible(true);
    setWidth(18);
    const timers = [
      window.setTimeout(() => setWidth(72), 80),
      window.setTimeout(() => setWidth(100), 260),
      window.setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 520)
    ];

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [location.pathname]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 160ms ease" }}
    >
      <div
        className="h-full w-full origin-left bg-blue-500"
        style={{
          transform: `scaleX(${width / 100})`,
          transition: width === 0 ? "none" : "transform 180ms ease-out"
        }}
      />
    </div>
  );
}
