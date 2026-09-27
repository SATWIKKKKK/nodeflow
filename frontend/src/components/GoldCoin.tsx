import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../lib/cn";
import { useCoins, useLastCoinChange } from "../lib/coins";

/**
 * A minted gold coin: a darker milled rim, a raised face lit from the top left,
 * an embossed N, and a glint that sweeps across now and then. Drawn, not an
 * emoji, so it looks the same everywhere and holds up at any size.
 */
export function GoldCoin({ size = 18, spin = false, className }: { size?: number; spin?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("shrink-0 drop-shadow-[0_1px_1.5px_rgba(120,72,0,0.45)]", className)}
      animate={spin ? { rotateY: [0, 360] } : undefined}
      transition={spin ? { duration: 0.6, ease: "easeInOut" } : undefined}
    >
      <defs>
        <radialGradient id={`${id}-face`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff6c2" />
          <stop offset="35%" stopColor="#ffd54a" />
          <stop offset="75%" stopColor="#e3a008" />
          <stop offset="100%" stopColor="#b7791f" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe27a" />
          <stop offset="50%" stopColor="#c68a0c" />
          <stop offset="100%" stopColor="#8a5a00" />
        </linearGradient>
        <linearGradient id={`${id}-glint`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx="16" cy="16" r="12.2" />
        </clipPath>
      </defs>
      <circle cx="16" cy="16" r="15.5" fill={`url(#${id}-rim)`} />
      {/* Milled edge. */}
      <circle cx="16" cy="16" r="14.3" fill="none" stroke="#9a6400" strokeWidth="1.2" strokeDasharray="1.1 1.1" opacity="0.55" />
      <circle cx="16" cy="16" r="12.8" fill={`url(#${id}-face)`} stroke="#a86f05" strokeWidth="0.8" />
      {/* Embossed mark: a dark cut and a light lip below it. */}
      <path d="M11.5 22V10.5l9 11V10" fill="none" stroke="#fff3b0" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 0.7)" opacity="0.7" />
      <path d="M11.5 22V10.5l9 11V10" fill="none" stroke="#a0660a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <g clipPath={`url(#${id}-clip)`}>
        <rect className="coin-glint" x="-14" y="0" width="10" height="32" fill={`url(#${id}-glint)`} transform="skewX(-20)" />
      </g>
    </motion.svg>
  );
}

/** The balance with a coin, and a "+2" / "−1" that floats off it as rounds are played. */
export function CoinBalance({ className, size = 18 }: { className?: string; size?: number }) {
  const coins = useCoins();
  const change = useLastCoinChange();
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (!change.at || Date.now() - change.at > 1000) return;
    setFresh(true);
    const timer = window.setTimeout(() => setFresh(false), 900);
    return () => window.clearTimeout(timer);
  }, [change.at]);
  return (
    <span
      className={cn(
        "coin-chip relative inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[13px] font-semibold tabular-nums",
        className
      )}
      title={`${coins} coins`}
      aria-label={`${coins} coins`}
    >
      <GoldCoin size={size} spin={fresh && change.delta > 0} key={fresh && change.delta > 0 ? change.at : "still"} />
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
              change.delta > 0 ? "text-[#c08a00] dark:text-[#ffd54a]" : "text-red-600 dark:text-red-400"
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
