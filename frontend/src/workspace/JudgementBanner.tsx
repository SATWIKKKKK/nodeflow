import { verdictLabel } from "../lib/verdict";
import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock, Trophy, XCircle } from "lucide-react";
import type { TestResponse } from "@nodeflow/shared";
import { cn } from "../lib/cn";

/**
 * The verdict of a Test or Submit, as a moment rather than a status line.
 *
 * Colour says which kind of outcome it is before a word is read — blue for a
 * pass, red for code that failed, amber for code that ran out of time — and
 * the case bar fills in one case at a time, so the result is watched arriving
 * instead of simply appearing. An accepted Submit gets a short burst of
 * confetti; that is the one result worth celebrating, so nothing else does.
 */

type Tone = "pass" | "fail" | "slow";

const toneOf = (verdict: TestResponse["verdict"]): Tone =>
  verdict === "Accepted"
    ? "pass"
    : verdict === "Time Limit Exceeded" || verdict === "Execution Limit" || verdict === "Platform Error"
      ? "slow"
      : "fail";

const HEADLINES: Record<Tone, { test: string; submit: string }> = {
  pass: { test: "Every visible case passes", submit: "Accepted" },
  fail: { test: "Not there yet", submit: "Not accepted" },
  slow: { test: "Too slow", submit: "Too slow" }
};

const CONFETTI = ["#2d58bc", "#9ecbff", "#f5c542", "#22c55e", "#f472b6", "#a78bfa"];

function CountUp({ to }: { to: number }) {
  const [value, setValue] = useState(0);
  const still = useReducedMotion();
  useEffect(() => {
    if (still) {
      setValue(to);
      return;
    }
    const controls = animate(0, to, { duration: 0.7, ease: "easeOut", onUpdate: (latest) => setValue(Math.round(latest)) });
    return () => controls.stop();
  }, [to, still]);
  return <>{value}</>;
}

function Confetti() {
  const pieces = Array.from({ length: 26 }, (_, at) => {
    const angle = (at / 26) * Math.PI * 2 + (at % 3) * 0.2;
    const reach = 70 + (at % 5) * 22;
    return {
      at,
      x: Math.cos(angle) * reach,
      y: Math.sin(angle) * reach * 0.6 - 30,
      rotate: (at % 2 ? 1 : -1) * (180 + at * 20),
      color: CONFETTI[at % CONFETTI.length],
      round: at % 3 === 0
    };
  });
  return (
    <div className="pointer-events-none absolute left-10 top-8" aria-hidden>
      {pieces.map((piece) => (
        <motion.span
          key={piece.at}
          className={cn("absolute block h-2 w-1.5", piece.round && "h-2 w-2 rounded-full")}
          style={{ backgroundColor: piece.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
          animate={{ x: piece.x, y: [0, piece.y, piece.y + 60], opacity: [1, 1, 0], rotate: piece.rotate, scale: 1 }}
          transition={{ duration: 1.4, ease: "easeOut", times: [0, 0.45, 1] }}
        />
      ))}
    </div>
  );
}

export function JudgementBanner({ judgement, mode }: { judgement: TestResponse; mode: "test" | "submit" }) {
  const tone = toneOf(judgement.verdict);
  const still = useReducedMotion();
  const passed = judgement.cases.filter((entry) => entry.status === "passed").length;
  const total = judgement.cases.length;
  const Icon = tone === "pass" ? (mode === "submit" ? Trophy : CheckCircle2) : tone === "slow" ? Clock : XCircle;
  const down = judgement.verdict === "Platform Error";
  const headline = down ? "We couldn't run this" : HEADLINES[tone][mode];
  const detail = down
    ? "This is on our side, not your code. Please try again in a moment."
    : tone === "pass"
      ? mode === "submit"
        ? "Every case, hidden ones included. Nicely done."
        : "Submit to run the hidden cases too."
      : tone === "slow"
        ? "A loop ran past the time limit. Look for one that never exits."
        : judgement.verdict === "Wrong Answer"
          ? `${total - passed} case${total - passed === 1 ? "" : "s"} gave a different answer. The first one is open below.`
          : `${verdictLabel(judgement.verdict)}. Details are below.`;

  return (
    <motion.div
      key={`${mode}-${judgement.verdict}-${passed}-${total}`}
      initial={still ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={cn("judgement-banner relative overflow-hidden rounded-2xl border px-4 py-4 sm:px-5", `judgement-${tone}`)}
    >
      {tone === "pass" && mode === "submit" && !still && <Confetti />}
      <div className="relative flex items-center gap-4">
        <motion.span
          initial={still ? false : { scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 14, delay: 0.08 }}
          className="judgement-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
        >
          <Icon size={24} aria-hidden />
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="judgement-headline text-lg font-bold leading-tight">{headline}</p>
          <p className="mt-0.5 text-sm opacity-85">{detail}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="judgement-headline font-mono text-2xl font-bold leading-none">
            <CountUp to={passed} />
            <span className="text-base opacity-60">/{total}</span>
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider opacity-70">cases</p>
        </div>
      </div>

      <div className="relative mt-4 flex gap-1" role="img" aria-label={`${passed} of ${total} cases passed`}>
        {judgement.cases.map((entry, at) => (
          <motion.span
            key={entry.id}
            initial={still ? false : { scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ delay: 0.15 + at * 0.05, type: "spring", stiffness: 400, damping: 22 }}
            className={cn(
              "h-2.5 flex-1 origin-bottom rounded-full",
              entry.status === "passed" ? "judgement-seg-pass" : "judgement-seg-fail"
            )}
            title={`Case ${at + 1}: ${entry.status === "passed" ? "passed" : entry.status === "error" ? "error" : "wrong answer"}`}
          />
        ))}
      </div>

      <p className="relative mt-3 flex items-center gap-3 text-xs font-medium opacity-80">
        <span className="inline-flex items-center gap-1">
          <Clock size={12} aria-hidden /> {judgement.runtimeMs} ms
        </span>
        <span>{mode === "submit" ? "All cases" : "Visible cases"}</span>
        {tone === "slow" && (
          <span className="inline-flex items-center gap-1">
            <AlertTriangle size={12} aria-hidden /> time limit
          </span>
        )}
      </p>
    </motion.div>
  );
}
