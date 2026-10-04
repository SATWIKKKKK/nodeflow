import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { GAME_REWARD } from "@nodeflow/shared";
import { cn } from "../lib/cn";
import { earnCoins } from "../lib/coins";
import { CoinBalance } from "../components/NoesisCoin";

/**
 * Something to do while the rewrite is being worked out.
 *
 * Making a variant takes the better part of half a minute — a model writes the
 * problem, then its solution is run against every input — and a spinner for
 * that long reads as a hang. This is deliberately the smallest game that still
 * holds attention: pick the smaller of two numbers, again and again, quickly.
 *
 * It is a comparison, which is what nearly every algorithm on the site comes
 * down to, so it needs no instructions and belongs where it sits. Every round
 * pays out on the spot — two coins for a right pick, one taken back for a
 * wrong one — and a miss never ends the game: it shakes, the next pair comes
 * up, and play goes on until the problem is ready.
 */


const pair = () => {
  const left = Math.floor(Math.random() * 99) + 1;
  let right = Math.floor(Math.random() * 99) + 1;
  while (right === left) right = Math.floor(Math.random() * 99) + 1;
  return [left, right] as const;
};

export function WaitingGame() {
  const [[left, right], setPair] = useState(pair);
  const [streak, setStreak] = useState(0);
  const [earned, setEarned] = useState(0);
  const [flash, setFlash] = useState<{ value: number; correct: boolean } | null>(null);

  const pick = useCallback(
    (value: number) => {
      if (flash) return;
      const correct = value === Math.min(left, right);
      // Counted on the spot and shown only as the counter ticking: the game
      // is the thing to watch here, not the coins.
      earnCoins(correct ? GAME_REWARD.right : GAME_REWARD.wrong);
      setEarned((total) => total + (correct ? GAME_REWARD.right : GAME_REWARD.wrong));
      setStreak((run) => (correct ? run + 1 : 0));
      setFlash({ value, correct });
    },
    [left, right, flash]
  );

  // Right or wrong, the round moves on by itself a beat later.
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(
      () => {
        setFlash(null);
        setPair(pair());
      },
      flash.correct ? 220 : 420
    );
    return () => clearTimeout(timer);
  }, [flash]);

  const button = (value: number) => {
    const picked = flash?.value === value;
    return (
      <motion.button
        key={`${value}-${left}-${right}`}
        type="button"
        onClick={() => pick(value)}
        initial={{ scale: 0.92, opacity: 0 }}
        animate={
          picked && !flash?.correct
            ? { x: [0, -6, 6, -4, 0], scale: 1, opacity: 1 }
            : picked
              ? { scale: [1, 1.08, 1], opacity: 1 }
              : { x: 0, scale: 1, opacity: 1 }
        }
        transition={{ duration: picked ? 0.32 : 0.16 }}
        className={cn(
          "no-lift flex h-16 flex-1 items-center justify-center rounded-xl border-[1.5px] font-mono text-[22px] transition-colors",
          picked && flash?.correct
            ? "border-[var(--fill-blue)] bg-[var(--fill-blue)] text-[var(--fill-blue-text)]"
            : picked
              ? "border-[var(--compare)] bg-[var(--compare-soft)] text-[var(--compare-text)]"
              : "neu-btn border-blueprint-line bg-card text-primary hover:border-[var(--fill-blue)]"
        )}
        style={{ minHeight: 0 }}
      >
        {value}
      </motion.button>
    );
  };

  return (
    <div className="mt-4 rounded-xl border border-blueprint-line bg-surface-inset p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-technical-mono text-blueprint-muted">
          tap the smaller · <span className="text-[var(--fill-blue)]">+{GAME_REWARD.right}</span> right ·{" "}
          <span className="text-red-600 dark:text-red-400">−{Math.abs(GAME_REWARD.wrong)}</span> wrong
        </p>
        <CoinBalance interactive={false} />
      </div>
      <div className="flex gap-2">
        {button(left)}
        {button(right)}
      </div>
      <p className="mt-2 flex justify-between font-mono text-[11px] text-blueprint-muted">
        <span>{streak > 1 ? `${streak} in a row` : " "}</span>
        <span>
          this wait: {earned >= 0 ? "+" : "−"}
          {Math.abs(earned)}
        </span>
      </p>
    </div>
  );
}
