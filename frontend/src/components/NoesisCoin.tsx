import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../lib/cn";
import { useCoins, useLastCoinChange } from "../lib/coins";
import { usePrefersReducedMotion } from "./graphics/useFrames";

/**
 * The Noesis coin: a blue minted coin with the N pressed into its face.
 *
 * Vector rather than an image, so it is sharp at 20px in the header and at
 * 150px in the celebration, and it takes its colours from the theme (the
 * --coin-* tokens in index.css) instead of shipping one PNG per mode.
 *
 * The N is the logo's own geometry (components/Logo.tsx) and can draw itself
 * the way the landing page's logo does: three strokes in hand order, the four
 * nodes popping in, the filled node walking the N to rest top right. Changing
 * `drawToken` replays it.
 */

const STROKES = ["M96 294V106", "M110.7 100.4 289.3 299.6", "M304 294V106"];
const NODES: Array<[number, number]> = [
  [96, 316],
  [96, 84],
  [304, 316],
  [304, 84]
];
// Thicker than the logo's 16: the mark has to survive being shrunk to 20px.
const MARK_STROKE = 30;
const NODE_R = 25;
const MARK_SCALE = 0.54;

function Mark({ drawToken, filter }: { drawToken?: number | string; filter: string }) {
  const reduced = usePrefersReducedMotion();
  const draw = drawToken !== undefined && !reduced;
  const walkX = [96, 96, 96, 96, 304, 304, 304, 304];
  const walkY = [316, 316, 84, 84, 316, 316, 84, 84];
  const times = [0, 0.18, 0.31, 0.49, 0.62, 0.8, 0.93, 1];
  return (
    <g
      key={drawToken ?? "still"}
      transform={`translate(200 200) scale(${MARK_SCALE}) translate(-200 -200)`}
      fill="none"
      stroke="var(--coin-mark)"
      strokeWidth={MARK_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      filter={filter}
    >
      {STROKES.map((d, index) => (
        <motion.path
          key={d}
          d={d}
          initial={draw ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.16, delay: 0.1 + index * 0.16, ease: "easeInOut" }}
        />
      ))}
      {NODES.map(([cx, cy], index) => (
        <motion.circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={NODE_R}
          initial={draw ? { scale: 0, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          transition={{ duration: 0.14, delay: 0.62 + index * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
        />
      ))}
      {/* The filled node: "you are here", walking the N to where the logo keeps it. */}
      <motion.circle
        r={NODE_R}
        fill="var(--coin-mark)"
        initial={draw ? { cx: walkX[0], cy: walkY[0], opacity: 0 } : false}
        animate={draw ? { cx: walkX, cy: walkY, opacity: 1 } : { cx: 304, cy: 84, opacity: 1 }}
        transition={
          draw
            ? { duration: 0.62, delay: 0.76, times, ease: "easeInOut", opacity: { duration: 0.1, delay: 0.76 } }
            : { duration: 0 }
        }
      />
    </g>
  );
}

/** One face of the coin, flat. */
export function CoinFace({
  size = 20,
  drawToken,
  glint = true,
  className
}: {
  size?: number;
  drawToken?: number | string;
  glint?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const stop = (color: string, offset: string, opacity = 1) => (
    <stop offset={offset} style={{ stopColor: `var(${color})`, stopOpacity: opacity }} />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 400 400" aria-hidden className={cn("block shrink-0", className)}>
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          {stop("--coin-rim-top", "0%")}
          {stop("--coin-rim-bottom", "100%")}
        </linearGradient>
        <radialGradient id={`${id}-face`} cx="34%" cy="28%" r="80%">
          {stop("--coin-face-hi", "0%")}
          {stop("--coin-face", "55%")}
          {stop("--coin-rim-bottom", "100%")}
        </radialGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {/* Pressed out of the metal: a lit edge up and left, a shadow down and right. */}
        <filter id={`${id}-emboss`} x="-25%" y="-25%" width="150%" height="150%">
          <feOffset in="SourceAlpha" dx="9" dy="11" result="down" />
          <feFlood style={{ floodColor: "var(--coin-mark-shadow)", floodOpacity: 0.55 }} />
          <feComposite in2="down" operator="in" result="shadowFill" />
          <feGaussianBlur in="shadowFill" stdDeviation="5" result="shadow" />
          <feOffset in="SourceAlpha" dx="-5" dy="-6" result="up" />
          <feFlood style={{ floodColor: "var(--coin-mark-hi)", floodOpacity: 0.85 }} />
          <feComposite in2="up" operator="in" result="lit" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="lit" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={`${id}-clip`}>
          <circle cx="200" cy="200" r="150" />
        </clipPath>
      </defs>

      {/* Rim: light at the top, a darker band along the bottom. */}
      <circle cx="200" cy="200" r="198" fill={`url(#${id}-rim)`} />
      <path
        d="M 44 150 A 162 162 0 0 1 300 62"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.45"
        strokeWidth="9"
        strokeLinecap="round"
      />
      {/* The raised ring, then the recessed face inside it. */}
      <circle cx="200" cy="200" r="161" fill="none" style={{ stroke: "var(--coin-ring)" }} strokeWidth="10" />
      <circle cx="200" cy="200" r="165" fill="none" style={{ stroke: "var(--coin-ring-hi)" }} strokeWidth="2.5" strokeOpacity="0.8" />
      <circle cx="200" cy="200" r="155" fill={`url(#${id}-face)`} />
      <circle cx="200" cy="200" r="153" fill="none" style={{ stroke: "var(--coin-mark-shadow)" }} strokeOpacity="0.35" strokeWidth="5" />

      <Mark drawToken={drawToken} filter={`url(#${id}-emboss)`} />

      {glint && (
        <g clipPath={`url(#${id}-clip)`}>
          <rect className="coin-glint" x="-160" y="0" width="90" height="400" fill={`url(#${id}-shine)`} />
        </g>
      )}
    </svg>
  );
}

/**
 * The coin as an object: two faces back to back with a milled edge between
 * them, so a spin shows a coin turning rather than a sticker flipping over.
 */
export function Coin3D({
  size,
  turns = 0,
  duration = 1,
  drawToken
}: {
  size: number;
  /** Total half-turns to have made; animate by raising it. */
  turns?: number;
  duration?: number;
  drawToken?: number | string;
}) {
  const thickness = Math.max(3, size * 0.07);
  const layers = 9;
  return (
    <div style={{ width: size, height: size, perspective: size * 6 }}>
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        initial={false}
        animate={{ rotateY: turns * 180 }}
        transition={{ duration, ease: [0.16, 0.84, 0.3, 1] }}
      >
        {Array.from({ length: layers }, (_, at) => (
          <div
            key={at}
            className="coin-edge absolute inset-[1%] rounded-full"
            style={{ transform: `translateZ(${-thickness / 2 + (at * thickness) / (layers - 1)}px)` }}
          />
        ))}
        <div className="absolute inset-0" style={{ transform: `translateZ(${thickness / 2}px)`, backfaceVisibility: "hidden" }}>
          <CoinFace size={size} drawToken={drawToken} />
        </div>
        <div
          className="absolute inset-0"
          style={{ transform: `rotateY(180deg) translateZ(${thickness / 2}px)`, backfaceVisibility: "hidden" }}
        >
          <CoinFace size={size} glint={false} />
        </div>
      </motion.div>
    </div>
  );
}

/**
 * The balance with a coin. The coin is where celebrated coins land
 * (data-coin-target), and it redraws its N each time one does; a "+2" or
 * "−1" floats off it as the number changes.
 */
export function CoinBalance({ className, size = 24 }: { className?: string; size?: number }) {
  const coins = useCoins();
  const change = useLastCoinChange();
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (!change.at || Date.now() - change.at > 1000) return;
    setFresh(true);
    const timer = window.setTimeout(() => setFresh(false), 900);
    return () => window.clearTimeout(timer);
  }, [change.at]);
  const gained = fresh && change.delta > 0;
  return (
    <span
      className={cn(
        "coin-chip relative inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 font-mono text-[13px] font-semibold tabular-nums",
        className
      )}
      title={`${coins} Noesis coins`}
      aria-label={`${coins} Noesis coins`}
    >
      <motion.span
        data-coin-target
        className="inline-flex"
        animate={gained ? { scale: [1, 1.35, 1] } : { scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* Light mode keeps the drawn coin for now; dark mode uses the
            illustrated one. */}
        <CoinFace size={size} drawToken={gained ? change.at : undefined} className="dark:hidden" />
        <img
          src="/coins/noesis-coin-dark-64.png"
          srcSet="/coins/noesis-coin-dark-64.png 1x, /coins/noesis-coin-dark-128.png 2x, /coins/noesis-coin-dark-256.png 4x"
          width={size}
          height={size}
          alt=""
          draggable={false}
          className="coin-image hidden select-none dark:block"
        />
      </motion.span>
      <motion.span key={coins} initial={{ y: fresh ? -6 : 0, opacity: fresh ? 0.3 : 1 }} animate={{ y: 0, opacity: 1 }}>
        {coins}
      </motion.span>
      <AnimatePresence>
        {fresh && (
          <motion.span
            key={change.at}
            initial={{ opacity: 0, y: 4, scale: 0.8 }}
            animate={{ opacity: 1, y: -18, scale: 1 }}
            exit={{ opacity: 0, y: -26 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className={cn(
              "pointer-events-none absolute -right-1 top-0 text-xs font-bold",
              change.delta > 0 ? "text-[var(--fill-blue)]" : "text-red-600 dark:text-red-400"
            )}
            aria-hidden
          >
            {change.delta > 0 ? `+${change.delta}` : `−${Math.abs(change.delta)}`}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
