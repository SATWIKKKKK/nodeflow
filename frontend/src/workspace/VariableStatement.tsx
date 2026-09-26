import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * A problem statement whose adjustable words can be changed.
 *
 * Most of a statement is fixed, but a few words carry the whole exercise:
 * "nondecreasing" could be "nonincreasing", "minimum" could be "maximum". Each
 * of those is underlined, and clicking one asks the server for the problem that
 * follows from changing it.
 *
 * The words are picked from a fixed list rather than guessed. Underlining a
 * word the reader cannot usefully change is a small lie, and asking a model on
 * every page load which words are adjustable would cost a request to answer a
 * question that never changes.
 */

const ADJUSTABLE = [
  "nondecreasing",
  "nonincreasing",
  "increasing",
  "decreasing",
  "ascending",
  "descending",
  "minimum",
  "maximum",
  "smallest",
  "largest",
  "longest",
  "shortest",
  "first",
  "last",
  "even",
  "odd",
  "singly",
  "doubly",
  "before",
  "after"
];

export type VariantState =
  | { kind: "idle" }
  | { kind: "working"; term: string }
  | { kind: "invalid"; reason: string }
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
  state,
  onChange,
  className
}: {
  text: string;
  state: VariantState;
  onChange: (term: string, replacement: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const working = state.kind === "working";

  const commit = (term: string) => {
    const next = draft.trim();
    setEditing(null);
    if (next && next.toLowerCase() !== term.toLowerCase()) onChange(term, next);
  };

  return (
    <p className={className}>
      {segments(text).map((part, at) =>
        !part.adjustable ? (
          <span key={at}>{part.text}</span>
        ) : editing === `${at}` ? (
          <input
            key={at}
            autoFocus
            value={draft}
            disabled={working}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => commit(part.text)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit(part.text);
              if (event.key === "Escape") setEditing(null);
            }}
            className="w-[14ch] rounded border border-[var(--fill-blue)] bg-card px-1 text-primary outline-none"
            aria-label={`Change ${part.text}`}
          />
        ) : (
          <button
            key={at}
            type="button"
            disabled={working}
            onClick={() => {
              setDraft(part.text);
              setEditing(`${at}`);
            }}
            title="Change this word"
            className={cn(
              "underline decoration-dotted decoration-from-font underline-offset-4",
              "hover:text-[var(--fill-blue)] disabled:opacity-60",
              working && state.term === part.text && "text-[var(--fill-blue)]"
            )}
          >
            {part.text}
            {working && state.term === part.text && (
              <Loader2 size={12} className="ml-1 inline animate-spin align-[-1px]" aria-hidden />
            )}
          </button>
        )
      )}
    </p>
  );
}

/** One line under the statement saying what happened to the last change. */
export function VariantNotice({ state, onOpen }: { state: VariantState; onOpen: (id: string) => void }) {
  if (state.kind === "idle") return null;

  if (state.kind === "working") {
    return (
      <p className="mt-2 flex items-center gap-2 text-sm text-blueprint-muted">
        <Loader2 size={13} className="animate-spin" aria-hidden />
        Rewriting and checking the answers…
      </p>
    );
  }

  if (state.kind === "invalid") {
    return (
      <p className="status-warning mt-2 rounded-lg border px-3 py-2 text-sm" role="status">
        {state.reason}
      </p>
    );
  }

  return (
    <p className="mt-2 rounded-lg border border-blueprint-line bg-surface-inset px-3 py-2 text-sm text-primary" role="status">
      {state.kind === "exists" ? `Already problem #${state.number}.` : `New problem #${state.number}. Update your code to match.`}{" "}
      <button type="button" onClick={() => onOpen(state.problemId)} className="underline underline-offset-4 hover:text-[var(--fill-blue)]">
        {state.kind === "exists" ? "Open it" : `Open ${state.title}`}
      </button>
    </p>
  );
}
