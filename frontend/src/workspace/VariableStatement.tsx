import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, X } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * A problem statement whose adjustable words can be changed.
 *
 * Most of a statement is fixed, but a few words carry the whole exercise:
 * "nondecreasing" could be "nonincreasing", "singly" could be "doubly". Each of
 * those is underlined, and choosing one opens the dialog that asks the server
 * for the problem which follows from changing it.
 *
 * The words come from a fixed list rather than a guess. Underlining a word the
 * reader cannot usefully change is a small lie, and asking a model on every
 * page load which words are adjustable would spend a request answering a
 * question that never changes.
 */

const ADJUSTABLE = [
  // Order
  "nondecreasing", "nonincreasing", "increasing", "decreasing", "ascending", "descending",
  "sorted", "unsorted", "reversed", "rotated", "shuffled",
  // Extremes and counts
  "minimum", "maximum", "smallest", "largest", "longest", "shortest",
  "first", "last", "second", "third", "two", "three", "k",
  // Shape
  "singly", "doubly", "circular", "directed", "undirected", "weighted", "unweighted",
  "binary", "balanced", "complete", "cyclic", "acyclic",
  // Selection
  "distinct", "different", "duplicate", "duplicates", "unique", "repeated", "common",
  "even", "odd", "positive", "negative", "nonzero", "prime",
  // Position and direction
  "left", "right", "top", "bottom", "head", "tail", "root", "leaf",
  "before", "after", "forward", "backward", "clockwise",
  "adjacent", "consecutive", "contiguous", "overlapping",
  // Traversal and aggregate
  "preorder", "inorder", "postorder", "depth", "breadth", "level",
  "sum", "product", "total", "count", "average",
  "subarray", "subsequence", "substring",
  "row", "column", "horizontal", "vertical", "diagonal",
  "strictly", "push", "pop", "prefix", "suffix"
];

export type VariantState =
  | { kind: "closed" }
  | { kind: "editing"; term: string }
  | { kind: "working"; term: string; note: string }
  | { kind: "invalid"; term: string; reason: string }
  | { kind: "exists"; title: string; number: number; problemId: string }
  | { kind: "created"; title: string; number: number; problemId: string };

/** The statement split into plain runs and the words that can be swapped. */
const segments = (text: string) => {
  const pattern = new RegExp(`\\b(${ADJUSTABLE.join("|")})\\b`, "gi");
  const out: Array<{ text: string; adjustable: boolean }> = [];
  let at = 0;
  for (let hit = pattern.exec(text); hit; hit = pattern.exec(text)) {
    if (hit.index > at) out.push({ text: text.slice(at, hit.index), adjustable: false });
    out.push({ text: hit[0], adjustable: true });
    at = hit.index + hit[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), adjustable: false });
  return out;
};

export function VariableStatement({
  text,
  busy,
  onPick,
  className
}: {
  text: string;
  busy: boolean;
  onPick: (term: string) => void;
  className?: string;
}) {
  return (
    <p className={className}>
      {segments(text).map((part, at) =>
        !part.adjustable ? (
          <span key={at}>{part.text}</span>
        ) : (
          <button
            key={at}
            type="button"
            disabled={busy}
            onClick={() => onPick(part.text)}
            title="Change this word"
            className="underline decoration-dotted decoration-from-font underline-offset-4 transition-colors hover:text-[var(--fill-blue)] disabled:opacity-60"
          >
            {part.text}
          </button>
        )
      )}
    </p>
  );
}

/**
 * A marker drawn across the word, and then the word itself to overtype.
 *
 * Quieter than throwing the letters apart: the sweep says "this is the thing
 * being changed" while leaving it readable the whole way, and what lands is
 * the old word selected, so typing replaces it and doing nothing keeps it.
 */
function SweepingWord({ term, onDone }: { term: string; onDone: () => void }) {
  return (
    <span className="relative inline-flex items-center" aria-hidden>
      {/* Behind the word, not over it: a marker leaves what it marks readable. */}
      <motion.span
        className="absolute inset-y-[-3px] left-0 rounded-[3px] bg-[var(--fill-blue)]/30"
        initial={{ width: 0 }}
        animate={{ width: "100%" }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        onAnimationComplete={onDone}
      />
      <span className="relative font-mono text-[15px] text-primary">{term}</span>
    </span>
  );
}

/**
 * Everything the feature says, said over the page rather than inside it.
 *
 * One surface for the whole flow — typing, waiting, and whatever came back —
 * so a learner is never hunting for where the answer appeared. The backdrop
 * blurs because the statement underneath is the thing being changed, and
 * leaving it sharp invites reading the old wording while the new one loads.
 */
export function VariantDialog({
  state,
  statement,
  onSubmit,
  onClose,
  onOpen
}: {
  state: VariantState;
  statement: string;
  onSubmit: (term: string, replacement: string) => void;
  onClose: () => void;
  onOpen: (problemId: string) => void;
}) {
  const [ready, setScattered] = useState(false);
  const [draft, setDraft] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const open = state.kind !== "closed";
  const term = "term" in state ? state.term : "";

  useEffect(() => {
    if (state.kind === "editing") {
      setScattered(false);
      setDraft(state.term);
    }
  }, [state.kind, term]);

  useEffect(() => {
    if (ready) {
      field.current?.focus();
      field.current?.select();
    }
  }, [ready]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open, onClose]);

  const send = () => {
    const next = draft.trim();
    if (next && next.toLowerCase() !== term.toLowerCase()) onSubmit(term, next);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label="Change a word in the problem"
        >
          <div className="absolute inset-0 bg-black/45 backdrop-blur-md" onClick={onClose} aria-hidden />

          <motion.div
            className="surface-frame relative w-full max-w-lg p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 rounded-full p-1.5 text-blueprint-muted hover:text-primary"
              aria-label="Close"
            >
              <X size={16} aria-hidden />
            </button>

            {(state.kind === "editing" || state.kind === "working" || state.kind === "invalid") && (
              <>
                <p className="text-technical-mono text-blueprint-muted">change a word</p>

                <div className="mt-3 flex min-h-[46px] items-center gap-2 text-body-md text-primary">
                  {!ready && state.kind === "editing" ? (
                    <SweepingWord term={term} onDone={() => setScattered(true)} />
                  ) : (
                    <motion.input
                      ref={field}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.14 }}
                      value={draft}
                      disabled={state.kind === "working"}
                      placeholder={term}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && send()}
                      className="h-11 w-full rounded-xl border border-[var(--fill-blue)] bg-card px-3 font-mono text-[15px] text-primary outline-none disabled:opacity-60"
                      aria-label={`Replace ${term}`}
                    />
                  )}
                </div>

                <p className="mt-3 text-sm text-blueprint-muted">
                  Replacing <span className="font-mono text-primary">{term}</span> in: “
                  {statement.length > 120 ? `${statement.slice(0, 120)}…` : statement}”
                </p>

                {state.kind === "invalid" && (
                  <p className="status-warning mt-4 rounded-lg border px-3 py-2 text-sm" role="status">
                    {state.reason}
                  </p>
                )}

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-ui-label text-blueprint-muted hover:text-primary">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={send}
                    disabled={state.kind === "working" || !draft.trim()}
                    className={cn(
                      "fill-blue inline-flex items-center gap-2 rounded-full px-5 py-2 text-ui-label",
                      "disabled:cursor-not-allowed disabled:opacity-45"
                    )}
                  >
                    {state.kind === "working" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
                    {state.kind === "working" ? "Working…" : "Change it"}
                  </button>
                </div>

                {state.kind === "working" && (
                  <p className="mt-3 text-center text-sm text-blueprint-muted" aria-live="polite">
                    {state.note}
                  </p>
                )}
              </>
            )}

            {(state.kind === "exists" || state.kind === "created") && (
              <>
                <p className="text-technical-mono text-blueprint-muted">
                  {state.kind === "exists" ? "already exists" : "new problem"}
                </p>
                <p className="mt-2 font-serif text-[26px] leading-tight text-primary">
                  Problem #{state.number}
                </p>
                <p className="mt-1 text-body-md text-primary">{state.title}</p>
                <p className="mt-3 text-sm text-blueprint-muted">
                  {state.kind === "exists"
                    ? "That variation is already in the problem set, so nothing new was made."
                    : "The statement changed, so your code will need to change with it."}
                </p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-ui-label text-blueprint-muted hover:text-primary">
                    Stay here
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpen(state.problemId)}
                    className="fill-blue inline-flex items-center gap-2 rounded-full px-5 py-2 text-ui-label"
                  >
                    Open it
                    <ArrowRight size={14} aria-hidden />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
