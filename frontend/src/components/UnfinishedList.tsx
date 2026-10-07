import { LANGUAGE_LABELS } from "@nodeflow/shared";
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { UnfinishedProblem } from "@nodeflow/shared";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { cn } from "../lib/cn";
import { verdictLabel, verdictTone } from "../lib/verdict";
import { markStartedSynced, startedAsUnfinished, unsyncedStarted } from "../lib/started";
import { readCached, writeCached } from "../lib/cached";
import { UnfinishedMark } from "./UnfinishedMark";


const ago = (timestamp: string) => {
  const seconds = Math.max(0, (Date.now() - Date.parse(timestamp)) / 1000);
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(timestamp).toLocaleDateString();
};

/**
 * Problems started and not solved, newest first; `null` while loading.
 *
 * A guest's list is this browser's own record (lib/started.ts). An account's
 * comes from the server, after anything opened here while signed out has been
 * sent up to join it; if the server cannot be reached, the browser's record
 * stands in rather than showing nothing.
 */
export function useUnfinished() {
  const session = useSession();
  // Last-known list first (lib/cached.ts), so in-progress marks never blink out.
  const [problems, setProblems] = useState<UnfinishedProblem[] | null>(() =>
    session.user ? readCached<UnfinishedProblem[]>("unfinished", session.user.id) : null
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const userId = session.user?.id;
    if (!userId || !session.token) {
      setProblems(startedAsUnfinished());
      return;
    }
    const token = session.token;
    setProblems(readCached<UnfinishedProblem[]>("unfinished", userId));
    setError(false);
    const pending = unsyncedStarted(userId);
    const synced = pending.length
      ? api
          .syncStarted(
            pending.map((entry) => ({ problemId: entry.problemId, language: entry.language, at: entry.at })),
            token
          )
          .then(() => markStartedSynced(userId, Math.max(...pending.map((entry) => Date.parse(entry.at)))))
          .catch(() => undefined)
      : Promise.resolve();
    synced
      .then(() => api.unfinished(token))
      .then((response) => {
        writeCached("unfinished", userId, response.problems);
        if (mounted) setProblems(response.problems);
      })
      .catch(() => {
        if (!mounted) return;
        setError(true);
        setProblems(startedAsUnfinished());
      });
    return () => {
      mounted = false;
    };
  }, [session.token, session.user?.id]);

  return { problems, error };
}

/** One unfinished problem; opening it resumes the saved code in its language. */
export function UnfinishedRow({ entry, number }: { entry: UnfinishedProblem; number?: number }) {
  return (
    <NavLink
      to={`/workspace/${entry.problemId}${entry.language ? `?lang=${entry.language}` : ""}`}
      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-hover sm:px-6"
    >
      <UnfinishedMark label={false} className="w-8 justify-center" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-primary">
          {number !== undefined && <span className="mr-1.5 font-mono text-blueprint-muted">{number}.</span>}
          {entry.title}
        </span>
        <span className="mt-1 block text-xs text-blueprint-muted">
          {entry.topic} · {entry.difficulty}
          {entry.language ? ` · ${LANGUAGE_LABELS[entry.language]}` : ""} · {ago(entry.updatedAt)}
        </span>
      </span>
      {entry.lastVerdict ? (
        <span
          className={cn(
            "hidden shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none sm:inline-flex",
            verdictTone(entry.lastVerdict)
          )}
        >
          {verdictLabel(entry.lastVerdict)}
        </span>
      ) : (
        <UnfinishedMark className="hidden sm:inline-flex [&>.unfinished-dot]:hidden" />
      )}
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--unfinished)]">
        <span className="hidden sm:inline">Resume</span>
        <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </NavLink>
  );
}
