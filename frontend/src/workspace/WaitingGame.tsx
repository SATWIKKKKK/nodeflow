import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../lib/cn";

/**
 * Something to do while the rewrite is being worked out.
 *
 * Making a variant takes the better part of half a minute — a model writes the
 * problem, then its solution is run against every input — and a spinner for
 * that long reads as a hang. This is deliberately the smallest game that still
 * holds attention: pick the smaller of two numbers, again and again, quickly.
 *
 * It is a comparison, which is what nearly every algorithm on the site comes
 * down to, so it needs no instructions and belongs where it sits. It keeps no
 * state anywhere and ends the moment the answer arrives, because it is a way
 * of passing a wait, not a thing to win.
 */

const pair = () => {
  const left = Math.floor(Math.random() * 99) + 1;
  let right = Math.floor(Math.random() * 99) + 1;
  while (right === left) right = Math.floor(Math.random() * 99) + 1;
  return [left, right] as const;
};

export function WaitingGame() {
  const [[left, right], setPair] = useState(pair);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);

  const pick = useCallback(
    (value: number) => {
      const correct = value === Math.min(left, right);
      if (correct) {
        setScore((run) => {
          const next = run + 1;
          setBest((high) => Math.max(high, next));
          return next;
        });
        setPair(pair());
      } else {
        setWrong(value);
        setScore(0);
      }
    },
    [left, right]
  );

  // A wrong pick stings briefly and then the round moves on by itself, so a
  // mistake never leaves the player stuck staring at a wait they cannot skip.
  useEffect(() => {
    if (wrong === null) return;
    const timer = setTimeout(() => {
      setWrong(null);
      setPair(pair());
    }, 420);
    return () => clearTimeout(timer);
  }, [wrong]);

  const button = (value: number) => (
    <motion.button
      key={`${value}-${left}-${right}`}
      type="button"
      onClick={() => pick(value)}
      animate={wrong === value ? { x: [0, -6, 6, -4, 0] } : { x: 0 }}
      transition={{ duration: 0.32 }}
      className={cn(
        "no-lift flex h-16 flex-1 items-center justify-center rounded-xl border-[1.5px] font-mono text-[22px] transition-colors",
        wrong === value
          ? "border-[var(--compare)] bg-[var(--compare-soft)] text-[var(--compare-text)]"
          : "border-blueprint-line bg-card text-primary hover:border-[var(--fill-blue)]"
      )}
      style={{ minHeight: 0 }}
    >
      {value}
    </motion.button>
  );

  return (
    <div className="mt-4 rounded-xl border border-blueprint-line bg-surface-inset p-3">
      <p className="mb-2 flex items-baseline justify-between text-technical-mono text-blueprint-muted">
        <span>tap the smaller</span>
        <span className="font-mono text-[11px]">
          {score} in a row{best > 0 && score !== best ? ` · best ${best}` : ""}
        </span>
      </p>
      <div className="flex gap-2">
        {button(left)}
        {button(right)}
      </div>
    </div>
  );
}
