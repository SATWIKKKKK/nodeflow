import { useEffect, useRef, useState } from "react";
import { Check, CloudOff, Loader2 } from "lucide-react";
import { api } from "../../lib/api";

/**
 * Notes: the learner's own words on a problem — the idea, the edge case that
 * bit them, what to try next time. Saved as they type: to this browser at
 * once, and to their account a moment after they pause, so the note follows
 * them to another device.
 */

const MAX = 20_000;
const SAVE_AFTER_MS = 700;

interface LocalNote {
  text: string;
  updatedAt: string;
  /** Not yet on the account. */
  dirty?: boolean;
}

const keyOf = (problemId: string) => `noesis:note:${problemId}`;

const readLocal = (problemId: string): LocalNote | null => {
  try {
    return JSON.parse(window.localStorage.getItem(keyOf(problemId)) ?? "null") as LocalNote | null;
  } catch {
    return null;
  }
};

const writeLocal = (problemId: string, note: LocalNote) => {
  try {
    if (note.text) window.localStorage.setItem(keyOf(problemId), JSON.stringify(note));
    else window.localStorage.removeItem(keyOf(problemId));
  } catch {
    // Storage full or blocked: the account copy still saves.
  }
};

type Status = "idle" | "saving" | "saved" | "local" | "error";

export function NotesPanel({ problemId, token, signedIn }: { problemId: string; token: string | null; signedIn: boolean }) {
  const [text, setText] = useState(() => readLocal(problemId)?.text ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const pending = useRef<{ problemId: string; text: string } | null>(null);
  const timer = useRef(0);

  const flush = useRef(() => undefined as void);
  flush.current = () => {
    window.clearTimeout(timer.current);
    const job = pending.current;
    pending.current = null;
    if (!job || !token) return;
    setStatus("saving");
    api
      .saveNote(job.problemId, job.text, token)
      .then(({ updatedAt }) => {
        const local = readLocal(job.problemId);
        if (local && local.text === job.text) writeLocal(job.problemId, { text: job.text, updatedAt });
        if (job.problemId === problemId) setStatus("saved");
      })
      .catch(() => job.problemId === problemId && setStatus("error"));
  };

  // A new problem: its local copy at once, then the account's if that is newer.
  useEffect(() => {
    const local = readLocal(problemId);
    setText(local?.text ?? "");
    setStatus("idle");
    if (!token || !signedIn) return;
    let live = true;
    api
      .note(problemId, token)
      .then((remote) => {
        if (!live) return;
        const mine = readLocal(problemId);
        if (mine?.dirty) {
          // Typed here while offline or signed out: this copy wins and goes up.
          pending.current = { problemId, text: mine.text };
          flush.current();
          return;
        }
        if (remote.updatedAt && (!mine || Date.parse(remote.updatedAt) > Date.parse(mine.updatedAt))) {
          writeLocal(problemId, { text: remote.text, updatedAt: remote.updatedAt });
          setText(remote.text);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
      // Leaving mid-pause still saves what was typed.
      if (pending.current) flush.current();
    };
  }, [problemId, token, signedIn]);

  useEffect(() => () => flush.current(), []);

  const change = (next: string) => {
    const value = next.slice(0, MAX);
    setText(value);
    writeLocal(problemId, { text: value, updatedAt: new Date().toISOString(), dirty: Boolean(token) });
    if (!token) {
      setStatus("local");
      return;
    }
    pending.current = { problemId, text: value };
    setStatus("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flush.current(), SAVE_AFTER_MS);
  };

  return (
    <div className="flex h-full min-h-[220px] flex-col gap-2 lg:min-h-0">
      <textarea
        value={text}
        onChange={(event) => change(event.target.value)}
        onBlur={() => pending.current && flush.current()}
        placeholder="Your notes on this problem: the idea, the edge case that caught you, what to try next time…"
        aria-label="Notes on this problem"
        className="min-h-[72px] w-full flex-1 resize-none rounded-lg border border-blueprint-line bg-surface-inset px-3 py-2.5 text-[14px] leading-relaxed text-primary outline-none placeholder:text-blueprint-muted/80"
      />
      <div className="flex items-center gap-2 text-[11.5px] text-blueprint-muted" aria-live="polite">
        {status === "saving" ? (
          <>
            <Loader2 size={12} className="animate-spin" aria-hidden /> Saving…
          </>
        ) : status === "saved" ? (
          <>
            <Check size={12} aria-hidden className="text-[var(--verdict-pass)]" /> Saved to your account
          </>
        ) : status === "error" ? (
          <>
            <CloudOff size={12} aria-hidden /> Saved on this device. It will reach your account next time.
          </>
        ) : status === "local" || !signedIn ? (
          <span>Saved on this device. Sign in to keep notes with your account.</span>
        ) : (
          <span>Saved as you type.</span>
        )}
        <span className="ml-auto font-mono">
          {text.length.toLocaleString("en-US")} / {MAX.toLocaleString("en-US")}
        </span>
      </div>
    </div>
  );
}
