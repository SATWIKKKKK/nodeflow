import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { landFlight, launchFlight, useCelebrationSlot, useCoinFlights, type CoinFlight } from "../lib/coins";
import { Coin3D } from "./NoesisCoin";

/**
 * The one coin moment: a problem solved for the first time.
 *
 * Calm on purpose, in the manner of LeetCode's coin notices rather than a
 * jackpot: a single coin rises a little way from where it was won, makes one
 * slow turn while its N draws itself, says what it was for, and then glides
 * into the coin counter, which is when it is counted. Waiting-game rounds
 * never come here; they only tick the counter.
 *
 * The layer takes no clicks, so nothing underneath is ever blocked.
 */

const SIZE = 72;
const HOLD_MS = 2000;
const GLIDE_S = 0.9;

/**
 * The counter to land in: the last one on the page that can actually be seen,
 * so inside a dialog it is the dialog's own counter, not the header's behind it.
 */
const findCounter = () => {
  const counters = [...document.querySelectorAll<HTMLElement>("[data-coin-target]")].reverse();
  for (const counter of counters) {
    const box = counter.getBoundingClientRect();
    if (box.width === 0 || box.bottom < 0 || box.top > window.innerHeight) continue;
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    if (hit && (counter.contains(hit) || hit.contains(counter))) return box;
  }
  return null;
};

function Flight({ flight }: { flight: CoinFlight }) {
  const start = useMemo(() => {
    const x = flight.origin?.x ?? window.innerWidth / 2;
    const y = flight.origin ? flight.origin.y - SIZE : window.innerHeight * 0.36;
    const margin = 130;
    return {
      x: Math.min(window.innerWidth - margin, Math.max(margin, x)),
      y: Math.min(window.innerHeight - margin, Math.max(SIZE, y))
    };
    // Where it appears is fixed at launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [target, setTarget] = useState<{ x: number; y: number; scale: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const counter = findCounter();
      setTarget(
        counter
          ? { x: counter.left + counter.width / 2, y: counter.top + counter.height / 2, scale: counter.width / SIZE }
          : { x: window.innerWidth - 60, y: 32, scale: 0.35 }
      );
      launchFlight(flight.id);
    }, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [flight.id]);

  const gliding = target !== null;

  return (
    <motion.div
      className="absolute left-0 top-0"
      style={{ width: SIZE, height: SIZE, marginLeft: -SIZE / 2, marginTop: -SIZE / 2 }}
      initial={{ x: start.x, y: start.y + 24, scale: 0.85, opacity: 0 }}
      animate={
        gliding
          ? { x: target.x, y: [start.y, start.y - 24, target.y], scale: target.scale, opacity: 1 }
          : { x: start.x, y: start.y, scale: 1, opacity: 1 }
      }
      transition={
        gliding
          ? { duration: GLIDE_S, ease: [0.45, 0, 0.55, 1], y: { duration: GLIDE_S, times: [0, 0.3, 1], ease: "easeInOut" } }
          : { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
      }
      onAnimationComplete={() => {
        if (gliding) landFlight(flight.id);
      }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
    >
      <Coin3D size={SIZE} turns={2} duration={1.5} drawToken={flight.id} />

      <AnimatePresence>
        {!gliding && (
          <motion.div
            className="coin-notice absolute left-1/2 top-full mt-3 flex -translate-x-1/2 flex-col items-center whitespace-nowrap rounded-2xl border px-3.5 py-2 text-center"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            <span className="font-mono text-[15px] font-bold">
              +{flight.amount} {flight.amount === 1 ? "coin" : "coins"}
            </span>
            <span className="max-w-[240px] truncate text-[11px] opacity-75">{flight.label}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function CoinCelebration() {
  useCelebrationSlot();
  const flights = useCoinFlights();
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[120]" aria-hidden>
      <AnimatePresence>
        {flights.map((flight) => (
          <Flight key={flight.id} flight={flight} />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
