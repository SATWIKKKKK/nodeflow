import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { CoinBreakdown } from "@nodeflow/shared";
import { loadBreakdown } from "../lib/coins";
import { Coin3D } from "./NoesisCoin";

/**
 * Where the coins came from, opened from the coin counter.
 *
 * The total counts up under a coin that turns once, and a ring splits it by
 * source — solved problems, the change-the-word game, and anything held from
 * before sources were recorded — each segment drawing itself in. A single line
 * of coloured dots says which is which; nothing else competes with the chart.
 */

const SOURCES = {
  solve: { label: "Solved problems", color: "var(--wallet-solve)" },
  game: { label: "Word game", color: "var(--wallet-game)" },
  earlier: { label: "Earlier", color: "var(--wallet-earlier)" }
} as const;

type SourceKey = keyof typeof SOURCES;

function CountUp({ to, delay = 0 }: { to: number; delay?: number }) {
  const still = useReducedMotion();
  const [value, setValue] = useState(still ? to : 0);
  useEffect(() => {
    if (still) {
      setValue(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 0.9,
      delay,
      ease: "easeOut",
      onUpdate: (latest) => setValue(Math.round(latest))
    });
    return () => controls.stop();
  }, [to, delay, still]);
  return <>{value}</>;
}

/** The split as a ring, each segment drawing in after the one before it. */
function Ring({ parts, total }: { parts: Array<{ key: SourceKey; value: number }>; total: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const gap = parts.length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="h-48 w-48 -rotate-90" aria-hidden>
      <circle cx="70" cy="70" r={radius} fill="none" strokeWidth="14" className="stroke-surface-inset" />
      {parts.map((part, at) => {
        const length = total > 0 ? (part.value / total) * circumference : 0;
        const dash = Math.max(0, length - gap);
        const start = offset;
        offset += length;
        return (
          <motion.circle
            key={part.key}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            strokeWidth="14"
            strokeLinecap="butt"
            style={{ stroke: SOURCES[part.key].color }}
            strokeDashoffset={-start}
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${dash} ${circumference}` }}
            transition={{ duration: 0.7, delay: 0.35 + at * 0.35, ease: [0.4, 0, 0.2, 1] }}
          />
        );
      })}
    </svg>
  );
}

export function CoinWallet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId();
  const [data, setData] = useState<CoinBreakdown | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setFailed(false);
    loadBreakdown()
      .then((breakdown) => active && setData(breakdown))
      .catch(() => active && setFailed(true));
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      active = false;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const parts = data
    ? (
        [
          { key: "solve", value: data.solve.total },
          { key: "game", value: Math.max(0, data.game.net) },
          { key: "earlier", value: data.earlier }
        ] as Array<{ key: SourceKey; value: number }>
      ).filter((part) => part.value > 0)
    : [];
  const total = parts.reduce((sum, part) => sum + part.value, 0);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="wallet-card relative max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-[28px] border border-blueprint-line bg-card shadow-[0_28px_80px_rgba(0,0,0,0.25)]"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="no-lift absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-blueprint-muted hover:bg-surface-hover hover:text-primary"
              style={{ minHeight: 0 }}
            >
              <X size={16} aria-hidden />
            </button>

            {/* Header: the coin, the total. */}
            <div className="wallet-hero flex flex-col items-center px-6 pb-5 pt-7 text-center">
              <Coin3D size={84} turns={2} duration={1.6} drawToken="wallet" />
              <h2 id={titleId} className="mt-4 text-ui-label text-blueprint-muted">
                Your Noesis coins
              </h2>
            </div>

            <div className="px-6 pb-6">
              {failed ? (
                <p className="rounded-xl border border-blueprint-line px-4 py-3 text-sm text-blueprint-muted">
                  Could not load where your coins came from. Try again in a moment.
                </p>
              ) : !data ? (
                <div className="mx-auto h-48 w-48 animate-pulse rounded-full bg-surface-inset" />
              ) : total === 0 ? (
                <p className="rounded-2xl bg-surface-inset px-5 py-6 text-center text-sm text-blueprint-muted">
                  No coins yet. Solve a problem for the first time, or play the game while a variant is being made.
                </p>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <Ring parts={parts} total={total} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono text-4xl font-bold tabular-nums text-primary">
                        <CountUp to={data.coins} />
                      </span>
                      <span className="text-xs text-blueprint-muted">coins</span>
                    </div>
                  </div>
                  {/* Just enough to tell the colours apart. */}
                  <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2">
                    {parts.map((part, at) => (
                      <motion.li
                        key={part.key}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 + at * 0.35, duration: 0.3 }}
                        className="flex items-center gap-2 text-sm text-primary"
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: SOURCES[part.key].color }} />
                        {SOURCES[part.key].label}
                        <span className="font-mono font-semibold">
                          <CountUp to={part.value} delay={0.35 + at * 0.35} />
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

