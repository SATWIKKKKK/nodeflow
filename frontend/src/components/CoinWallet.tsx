import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { Gamepad2, History, Trophy, X } from "lucide-react";
import type { CoinBreakdown } from "@nodeflow/shared";
import { loadBreakdown, useCoins } from "../lib/coins";
import { Coin3D } from "./NoesisCoin";

/**
 * Where the coins came from, opened from the coin counter.
 *
 * The total counts up under a coin that turns once, and a ring splits it by
 * source — solved problems, the change-the-word game, and anything held from
 * before sources were recorded — each segment drawing itself in. Below the
 * ring, one card per source says how that share was made, then the latest
 * first-solve rewards, then how more are earned.
 */

const SOURCES = {
  solve: { label: "Solved problems", color: "var(--wallet-solve)", Icon: Trophy },
  game: { label: "Change-the-word game", color: "var(--wallet-game)", Icon: Gamepad2 },
  earlier: { label: "Earlier", color: "var(--wallet-earlier)", Icon: History }
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

const ago = (timestamp: string) => {
  const seconds = Math.max(0, (Date.now() - Date.parse(timestamp)) / 1000);
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/** The split as a ring, each segment drawing in after the one before it. */
function Ring({ parts, total }: { parts: Array<{ key: SourceKey; value: number }>; total: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const gap = parts.length > 1 ? 4 : 0;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="h-36 w-36 -rotate-90" aria-hidden>
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
            strokeLinecap="round"
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
  const shown = useCoins();
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
  const share = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

  const detail = (key: SourceKey) => {
    if (!data) return "";
    if (key === "solve") {
      return data.solve.count === 0
        ? "No first solves yet"
        : `${data.solve.count} problem${data.solve.count === 1 ? "" : "s"} solved for the first time`;
    }
    if (key === "game") {
      return data.game.gained === 0 && data.game.lost === 0
        ? "Not played yet"
        : `+${data.game.gained} won · −${data.game.lost} lost`;
    }
    return "Held from before coins were itemised";
  };

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
            className="wallet-card relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-blueprint-line bg-card shadow-[0_28px_80px_rgba(0,0,0,0.25)]"
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
              <p className="mt-4 text-ui-label text-blueprint-muted">Your Noesis coins</p>
              <h2 id={titleId} className="mt-1 font-mono text-5xl font-bold tabular-nums text-primary">
                <CountUp to={data?.coins ?? shown} />
              </h2>
            </div>

            <div className="px-6 pb-6">
              {failed ? (
                <p className="rounded-xl border border-blueprint-line px-4 py-3 text-sm text-blueprint-muted">
                  Could not load where your coins came from. Try again in a moment.
                </p>
              ) : !data ? (
                <div className="h-40 animate-pulse rounded-2xl bg-surface-inset" />
              ) : total === 0 ? (
                <p className="rounded-2xl bg-surface-inset px-5 py-6 text-center text-sm text-blueprint-muted">
                  No coins yet. Solve a problem for the first time, or play the game while a variant is being made.
                </p>
              ) : (
                <>
                  {/* The split. */}
                  <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                    <div className="relative shrink-0">
                      <Ring parts={parts} total={total} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-mono text-2xl font-bold text-primary">{total}</span>
                        <span className="text-[11px] text-blueprint-muted">earned</span>
                      </div>
                    </div>
                    <ul className="grid w-full gap-2.5">
                      {parts.map((part, at) => {
                        const source = SOURCES[part.key];
                        return (
                          <motion.li
                            key={part.key}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.35 + at * 0.35, duration: 0.35 }}
                            className="flex items-center gap-3 rounded-2xl border border-blueprint-line px-3.5 py-2.5"
                          >
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                              style={{ background: source.color }}
                            >
                              <source.Icon size={16} aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-primary">{source.label}</span>
                              <span className="block truncate text-xs text-blueprint-muted">{detail(part.key)}</span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block font-mono text-base font-bold text-primary">
                                <CountUp to={part.value} delay={0.35 + at * 0.35} />
                              </span>
                              <span className="block text-[11px] text-blueprint-muted">{share(part.value)}%</span>
                            </span>
                          </motion.li>
                        );
                      })}
                    </ul>
                  </div>

                  {data.solve.recent.length > 0 && (
                    <div className="mt-6">
                      <p className="mb-2 text-ui-label text-blueprint-muted">Latest first solves</p>
                      <ul className="divide-y divide-blueprint-line rounded-2xl border border-blueprint-line">
                        {data.solve.recent.map((entry) => (
                          <li key={entry.problemId} className="flex items-center gap-3 px-3.5 py-2.5">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-primary">{entry.title}</span>
                              <span className="block text-[11px] text-blueprint-muted">
                                {entry.difficulty ? `${entry.difficulty} · ` : ""}
                                {ago(entry.at)}
                              </span>
                            </span>
                            <span className="wallet-plus shrink-0 rounded-full px-2.5 py-1 font-mono text-xs font-bold">
                              +{entry.amount}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {/* How to earn more. */}
              <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-2xl bg-surface-inset px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Trophy size={14} aria-hidden className="text-[var(--wallet-solve)]" /> Solve a problem
                  </p>
                  <p className="mt-1 text-xs text-blueprint-muted">
                    First accepted submission only:{" "}
                    {data
                      ? `Easy +${data.rewards.Easy} · Medium +${data.rewards.Medium} · Hard +${data.rewards.Hard}`
                      : "…"}
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-inset px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Gamepad2 size={14} aria-hidden className="text-[var(--wallet-game)]" /> Play while you wait
                  </p>
                  <p className="mt-1 text-xs text-blueprint-muted">Changing a word? Tap the smaller: +2 right · −1 wrong</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

