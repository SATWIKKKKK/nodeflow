import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { ArrowRight, Check, History, X } from "lucide-react";
import type { ProgressSummary } from "@nodeflow/shared";
import { api } from "../lib/api";
import { structureLabel } from "../lib/problems";
import { useSession } from "../lib/session";
import { useProgress } from "../lib/progress";
import { cn } from "../lib/cn";
import { verdictTone } from "../lib/verdict";
import { SectionHeading } from "../components/SectionHeading";
import { UnfinishedRow, useUnfinished } from "../components/UnfinishedList";
import { UnfinishedMark } from "../components/UnfinishedMark";
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
  const { progress, error: failed } = useProgress();
  // Only worth saying when there is nothing to show at all.
  const error = failed && !progress ? "We couldn't load your progress. Please reload the page." : "";

  const completion = progress?.totalProblems
    ? Math.round((progress.accepted / progress.totalProblems) * 100)
    : 0;

  // Five, newest first: as many as sit beside the coverage card without the
  // list running on past it.
  const recent = useMemo(() => (progress?.recentSubmissions ?? []).slice(0, 5), [progress]);
  const { problems: unfinished } = useUnfinished();

  const coverage = progress
    ? [
        { label: "Arrays", done: progress.acceptedArrays, total: progress.totalArrays },
        { label: "Linked lists", done: progress.acceptedLinkedLists, total: progress.totalLinkedLists },
        { label: "Stacks", done: progress.acceptedStacks, total: progress.totalStacks },
        { label: "Queues", done: progress.acceptedQueues, total: progress.totalQueues }
      ].filter((row) => row.total > 0)
    : [];

  const metrics: Array<{ label: string; value: number | string; note: string; bar?: boolean; to?: string }> = [
    { label: "attempted", value: progress?.attempted ?? 0, note: "problems you have submitted" },
    { label: "solved", value: progress?.accepted ?? 0, note: `of ${progress?.totalProblems ?? "—"} problems` },
    { label: "completed", value: `${completion}%`, note: "of all problems solved", bar: true },
    { label: "in progress", value: unfinished?.length ?? 0, note: "started, not solved yet", to: "#continue" }
  ];

  return (
    <div className={`${container} py-10 sm:py-14`}>
      <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          as="h1"
          className="mb-0"
          title="Your progress"
          lead="What you have solved, what you are working on, and where to pick up next."
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
            {metrics.map((metric) => {
              const card = (
              <article
                key={metric.label}
                className={cn("surface-card-compact h-full", metric.to && "transition-shadow")}
              >
                <p className="text-technical-mono text-blueprint-muted">{metric.label}</p>
                <p className="mt-3 text-metric text-primary">{metric.value}</p>
                <p className="mt-2 text-body-md text-blueprint-muted">{metric.note}</p>
                {metric.bar && (
                  <div className="mt-4">
                    <Bar value={progress?.accepted ?? 0} total={progress?.totalProblems ?? 0} />
                  </div>
                )}
              </article>
              );
              // "In progress" takes you straight to the list of those problems.
              return metric.to ? (
                <a
                  key={metric.label}
                  href={metric.to}
                  className="neu-card-link block rounded-xl"
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById("continue")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  {card}
                </a>
              ) : (
                card
              );
            })}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section aria-labelledby="recent-heading" className="surface-frame flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-blueprint-line px-5 py-4 sm:px-6">
                <h2 id="recent-heading" className="text-headline-sm text-primary">
                  Recent submissions
                </h2>
                <History size={18} aria-hidden className="text-blueprint-muted" />
              </div>

              {recent.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-body-md text-blueprint-muted">
                    Nothing submitted yet. Solve a problem and press Submit to see it here.
                  </p>
                  <NavLink to="/problems" className={cn(button.outlineSm, "mt-6")}>
                    Browse problems
                  </NavLink>
                </div>
              ) : (
                <ul className="flex flex-1 flex-col divide-y divide-blueprint-line">
                  {recent.map((submission) => {
                    const accepted = submission.verdict === "Accepted";
                    return (
                      <li key={submission.submissionId} className="flex flex-1 flex-col justify-center">
                        <NavLink
                          to={`/workspace/${submission.problemId}`}
                          className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-hover sm:px-6"
                        >
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                              verdictTone(submission.verdict)
                            )}
                          >
                            {accepted ? <Check size={15} aria-hidden /> : <X size={14} aria-hidden />}
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
                              verdictTone(submission.verdict)
                            )}
                          >
                            {accepted ? "Solved" : submission.verdict}
                          </span>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="coverage-heading" className="surface-card">
              <h2 id="coverage-heading" className="text-headline-sm text-primary">
                By topic
              </h2>
              <p className="mt-2 text-body-md text-blueprint-muted">Problems solved in each topic.</p>
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

          <section id="continue" aria-labelledby="continue-heading" className="surface-frame mt-8 scroll-mt-24 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blueprint-line px-5 py-4 sm:px-6">
              <h2 id="continue-heading" className="flex items-center gap-3 text-headline-sm text-primary">
                Continue solving
                {unfinished && unfinished.length > 0 && <UnfinishedMark label={false} />}
              </h2>
              {unfinished && unfinished.length > 0 && (
                <NavLink to="/continue" className={cn(button.text, "inline-flex items-center gap-2")}>
                  See all {unfinished.length} <ArrowRight size={14} aria-hidden />
                </NavLink>
              )}
            </div>
            {unfinished === null ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : unfinished.length === 0 ? (
              <p className="px-6 py-10 text-center text-body-md text-blueprint-muted">
                Nothing in progress. Any problem you start and leave unsolved will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-blueprint-line">
                {unfinished.slice(0, 5).map((entry) => (
                  <li key={entry.problemId}>
                    <UnfinishedRow entry={entry} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!session.user && (
            <div className="surface-inset mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-body-md text-blueprint-muted">
                You are not signed in. Create a free account to keep your progress.
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
