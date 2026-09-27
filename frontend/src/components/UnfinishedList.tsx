import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { UnfinishedProblem } from "@nodeflow/shared";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { cn } from "../lib/cn";
import { verdictTone } from "../lib/verdict";
import { UnfinishedMark } from "./UnfinishedMark";

const LANGUAGE_NAMES = { python: "Python", cpp: "C++", java: "Java" } as const;

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
 * Problems the signed-in learner started and has not solved, newest first.
 * `null` while loading; an empty list for guests, whose drafts stay in the
 * browser and have no account to follow them anywhere.
 */
export function useUnfinished() {
  const session = useSession();
  const [problems, setProblems] = useState<UnfinishedProblem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!session.user) {
      setProblems([]);
      return;
    }
    setProblems(null);
    setError(false);
    api
      .unfinished(session.token)
      .then((response) => mounted && setProblems(response.problems))
      .catch(() => {
        if (!mounted) return;
        setError(true);
        setProblems([]);
      });
    return () => {
      mounted = false;
    };
  }, [session.token, session.user]);

  return { problems, error };
}

/** One unfinished problem; opening it resumes the saved code in its language. */
export function UnfinishedRow({ entry, number }: { entry: UnfinishedProblem; number?: number }) {
  return (
    <NavLink
      to={`/workspace/${entry.problemId}`}
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
          {entry.language ? ` · ${LANGUAGE_NAMES[entry.language]}` : ""} · {ago(entry.updatedAt)}
        </span>
      </span>
      {entry.lastVerdict ? (
        <span
          className={cn(
            "hidden shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none sm:inline-flex",
            verdictTone(entry.lastVerdict)
          )}
        >
          {entry.lastVerdict}
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
