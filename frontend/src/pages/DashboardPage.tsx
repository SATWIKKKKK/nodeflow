import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { ArrowRight, Check, History, X } from "lucide-react";
import type { ProgressSummary } from "@nodeflow/shared";
import { api } from "../lib/api";
import { structureLabel } from "../lib/problems";
import { useSession } from "../lib/session";
import { cn } from "../lib/cn";
import { SectionHeading } from "../components/SectionHeading";
import { Spinner } from "../components/PageLoader";
import { button, container } from "../components/ui";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const formatWhen = (timestamp: string) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
};

function Bar({ value, total }: { value: number; total: number }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-inset" aria-hidden>
      <div className="progress-fill h-full rounded-full transition-[width] duration-500" style={{ width: `${percent}%` }} />
    </div>
  );
}

export default function DashboardPage() {
  const session = useSession();
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setError("");

    api
      .progress(session.token)
      .then((summary) => mounted && setProgress(summary))
      .catch(() => {
        if (mounted) setError("Could not load progress. Check that the Noesis backend is running, then reload.");
      });

    return () => {
      mounted = false;
    };
  }, [session.token]);

  const completion = progress?.totalProblems
    ? Math.round((progress.accepted / progress.totalProblems) * 100)
    : 0;

  const recent = useMemo(() => progress?.recentSubmissions ?? [], [progress]);

  const coverage = progress
    ? [
        { label: "Arrays", done: progress.acceptedArrays, total: progress.totalArrays },
        { label: "Linked lists", done: progress.acceptedLinkedLists, total: progress.totalLinkedLists },
        { label: "Stacks", done: progress.acceptedStacks, total: progress.totalStacks },
        { label: "Queues", done: progress.acceptedQueues, total: progress.totalQueues }
      ].filter((row) => row.total > 0)
    : [];

  const metrics = [
    { label: "attempted", value: progress?.attempted ?? 0, note: "problems submitted at least once" },
    { label: "accepted", value: progress?.accepted ?? 0, note: `out of ${progress?.totalProblems ?? "—"} live problems` },
    { label: "bank cleared", value: `${completion}%`, note: "accepted across the live bank", bar: true },
    { label: "recent submits", value: recent.length, note: "shown below, newest first" }
  ];

  return (
    <div className={`${container} py-10 sm:py-14`}>
      <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          as="h1"
          className="mb-0"
          eyebrow={session.user ? `Signed in as ${session.user.email}` : "Local progress"}
          title={
            <>
              Your traces have a <em className="italic">memory</em>.
            </>
          }
          lead="Every Submit becomes progress: problems accepted, attempts logged, and the next replay waiting in the workspace."
        />
        <NavLink to="/problems" className={cn(button.primary, "self-start lg:self-auto")}>
          Pick a problem <ArrowRight size={14} aria-hidden />
        </NavLink>
      </div>

      {error && <div className="status-error mb-8 rounded-xl border px-5 py-4 text-body-md">{error}</div>}

      {!progress && !error ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {metrics.map((metric) => (
              <article key={metric.label} className="surface-card-compact">
                <p className="text-technical-mono text-blueprint-muted">{metric.label}</p>
                <p className="mt-3 text-metric text-primary">{metric.value}</p>
                <p className="mt-2 text-body-md text-blueprint-muted">{metric.note}</p>
                {metric.bar && (
                  <div className="mt-4">
                    <Bar value={progress?.accepted ?? 0} total={progress?.totalProblems ?? 0} />
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section aria-labelledby="recent-heading" className="surface-frame overflow-hidden">
              <div className="flex items-center justify-between border-b border-blueprint-line px-5 py-4 sm:px-6">
                <h2 id="recent-heading" className="text-headline-sm text-primary">
                  Recent submissions
                </h2>
                <History size={18} aria-hidden className="text-blueprint-muted" />
              </div>

              {recent.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-body-md text-blueprint-muted">
                    No submissions yet. Open a problem and press Submit to start your record.
                  </p>
                  <NavLink to="/problems" className={cn(button.outlineSm, "mt-6")}>
                    Browse problems
                  </NavLink>
                </div>
              ) : (
                <ul className="divide-y divide-blueprint-line">
                  {recent.map((submission) => {
                    const accepted = submission.verdict === "Accepted";
                    return (
                      <li key={submission.submissionId}>
                        <NavLink
                          to={`/workspace/${submission.problemId}`}
                          className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-hover sm:px-6"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blueprint-line">
                            {accepted ? (
                              <Check size={15} aria-hidden className="check-icon" />
                            ) : (
                              <X size={14} aria-hidden className="text-blueprint-muted" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium text-primary">
                              {submission.problemTitle}
                            </span>
                            <span className="mt-1 block text-xs text-blueprint-muted">
                              {structureLabel(submission.structureType)} · {formatWhen(submission.timestamp)}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
                              accepted ? "badge-current" : "border-blueprint-line text-blueprint-muted"
                            )}
                          >
                            {submission.verdict}
                          </span>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="coverage-heading" className="surface-card self-start">
              <h2 id="coverage-heading" className="text-headline-sm text-primary">
                Coverage by structure
              </h2>
              <p className="mt-2 text-body-md text-blueprint-muted">Accepted problems out of what is live.</p>
              <div className="my-6 h-px bg-blueprint-line" />
              <ul className="grid gap-5">
                {coverage.map((row) => (
                  <li key={row.label}>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <span className="text-ui-label text-primary">{row.label}</span>
                      <span className="text-technical-mono text-blueprint-muted">
                        {row.done} / {row.total}
                      </span>
                    </div>
                    <Bar value={row.done} total={row.total} />
                  </li>
                ))}
              </ul>
              <NavLink to="/problem-map" className={cn(button.text, "mt-8 inline-flex items-center gap-2")}>
                Open the problem map <ArrowRight size={14} aria-hidden />
              </NavLink>
            </section>
          </div>

          {!session.user && (
            <div className="surface-inset mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-body-md text-blueprint-muted">
                You are not signed in, so this shows progress recorded without an account. Create one to keep
                future submissions under your name.
              </p>
              <NavLink to="/signup" className={cn(button.outlineSm, "shrink-0")}>
                Create an account
              </NavLink>
            </div>
          )}
        </>
      )}
    </div>
  );
}
