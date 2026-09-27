import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { landFlight, launchFlight, useCelebrationSlot, useCoinFlights, type CoinFlight } from "../lib/coins";
import { Coin3D } from "./NoesisCoin";

/**
 * A coin earned, made into a moment: a big coin rises where it was won,
 * turns twice while its N draws itself, throws off a ring of sparks, then
 * flies into the nearest coin counter on screen, and only then is it counted.
 *
 * Never in the way: the layer takes no clicks, so the waiting game underneath
 * keeps playing, and a quick run of wins piles onto the coin already on show
 * ("+4", "+6") instead of launching a coin for each one.
 */

const SHOW_MS = 1150;
const FLY_S = 0.62;
const SPARKS = 12;

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
  const size = Math.round(Math.min(150, window.innerWidth * 0.34));
  const start = useMemo(() => {
    const x = flight.origin?.x ?? window.innerWidth / 2;
    // Above where it was won, so the coin never sits on the thing just tapped.
    const y = flight.origin ? flight.origin.y - size * 0.75 : window.innerHeight * 0.38;
    const half = size / 2 + 12;
    return {
      x: Math.min(window.innerWidth - half, Math.max(half, x)),
      y: Math.min(window.innerHeight - half, Math.max(half, y))
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
          ? { x: counter.left + counter.width / 2, y: counter.top + counter.height / 2, scale: counter.width / size }
          : { x: window.innerWidth - 40, y: 28, scale: 0.14 }
      );
      launchFlight(flight.id);
    }, SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [flight.id, size]);

  const flying = target !== null;

  return (
    <motion.div
      className="absolute left-0 top-0"
      style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
      initial={{ x: start.x, y: start.y + 30, scale: 0.2, opacity: 0 }}
      animate={
        flying
          ? { x: target.x, y: [start.y, start.y - 46, target.y], scale: target.scale, opacity: 1 }
          : { x: start.x, y: start.y, scale: 1, opacity: 1 }
      }
      transition={
        flying
          ? { duration: FLY_S, ease: [0.5, 0, 0.75, 0.2], y: { duration: FLY_S, times: [0, 0.3, 1], ease: "easeInOut" } }
          : { type: "spring", stiffness: 260, damping: 15, opacity: { duration: 0.15 } }
      }
      onAnimationComplete={() => {
        if (flying) landFlight(flight.id);
      }}
      exit={{ opacity: 0, transition: { duration: 0.08 } }}
    >
      {/* Soft light behind the coin while it is on show. */}
      <motion.div
        className="coin-halo absolute -inset-[35%] rounded-full"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: flying ? 0 : 1, scale: flying ? 0.6 : 1 }}
        transition={{ duration: 0.35 }}
      />

      {/* Sparks, once, as it arrives. */}
      {Array.from({ length: SPARKS }, (_, at) => {
        const angle = (at / SPARKS) * Math.PI * 2;
        const reach = size * (0.72 + (at % 3) * 0.1);
        return (
          <motion.span
            key={at}
            className="coin-spark absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
            initial={{ x: -4, y: -4, scale: 0, opacity: 1 }}
            animate={{ x: Math.cos(angle) * reach - 4, y: Math.sin(angle) * reach - 4, scale: [0, 1.2, 0], opacity: [1, 1, 0] }}
            transition={{ duration: 0.8, delay: 0.12, ease: "easeOut" }}
          />
        );
      })}

      <Coin3D size={size} turns={flying ? 6 : 4} duration={flying ? FLY_S : 1.1} drawToken={flight.id} />

      <AnimatePresence>
        {!flying && (
          <motion.span
            key={flight.amount}
            className="coin-amount absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 font-mono text-base font-bold"
            initial={{ opacity: 0, y: -6, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
          >
            +{flight.amount} {flight.amount === 1 ? "coin" : "coins"}
          </motion.span>
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
