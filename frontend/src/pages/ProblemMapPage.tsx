import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { ProgressSummary } from "@nodeflow/shared";
import { api, type DsaSummary } from "../lib/api";
import { useProblems } from "../lib/problems";
import { useSession } from "../lib/session";
import { cn } from "../lib/cn";
import { SectionHeading } from "../components/SectionHeading";
import { Spinner } from "../components/PageLoader";
import { button, container } from "../components/ui";

export default function ProblemMapPage() {
  const session = useSession();
  const { problems, loading, error } = useProblems();
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [summary, setSummary] = useState<DsaSummary | null>(null);

  useEffect(() => {
    let mounted = true;
    api.dsaSummary().then((value) => mounted && setSummary(value)).catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    api.progress(session.token).then((value) => mounted && setProgress(value)).catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [session.token]);

  const solved = useMemo(() => {
    const set = new Set<string>();
    for (const entry of progress?.problems ?? []) if (entry.accepted) set.add(entry.id);
    return set;
  }, [progress]);

  // Coverage per topic, derived from what is actually published.
  const byTopic = useMemo(() => {
    const map = new Map<string, { total: number; done: number; easy: number; medium: number; hard: number }>();
    for (const problem of problems) {
      const row = map.get(problem.topic) ?? { total: 0, done: 0, easy: 0, medium: 0, hard: 0 };
      row.total += 1;
      if (problem.difficulty === "Easy") row.easy += 1;
      if (problem.difficulty === "Medium") row.medium += 1;
      if (problem.difficulty === "Hard") row.hard += 1;
      if (solved.has(problem.id)) row.done += 1;
      map.set(problem.topic, row);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [problems, solved]);

  const metrics = [
    { label: "published", value: loading ? "—" : problems.length, note: "playable in the workspace today" },
    { label: "topics", value: loading ? "—" : byTopic.length, note: "from basic maths to tries" },
    {
      label: "sheet coverage",
      value: summary ? `${summary.covered}/${summary.total}` : "—",
      note: "problems on the DSA sheet with a verified, playable version"
    }
  ];

  return (
    <div className={`${container} py-10 sm:py-14`}>
      <SectionHeading
        as="h1"
        eyebrow="Problem map"
        title="Where the bank stands."
        lead="Coverage across every published topic. Bars fill as your submissions get accepted."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map((metric) => (
          <article key={metric.label} className="surface-card-compact">
            <p className="text-technical-mono text-blueprint-muted">{metric.label}</p>
            <p className="mt-3 text-metric text-primary">{metric.value}</p>
            <p className="mt-2 text-body-md text-blueprint-muted">{metric.note}</p>
          </article>
        ))}
      </div>

      <section aria-labelledby="topics-heading" className="surface-frame mt-8 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blueprint-line px-5 py-4 sm:px-6">
          <h2 id="topics-heading" className="text-headline-sm text-primary">
            Topics
          </h2>
          <span className="text-technical-mono text-blueprint-muted">accepted / published</span>
        </div>

        {error ? (
          <p className="status-error m-6 rounded-xl border px-5 py-4 text-body-md">
            Could not load the problem bank. Check that the Noesis backend is running, then reload.
          </p>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <ul className="divide-y divide-blueprint-line">
            {byTopic.map(([topic, row]) => {
              const percent = row.total ? (row.done / row.total) * 100 : 0;
              const mix = [
                row.easy && `${row.easy} easy`,
                row.medium && `${row.medium} medium`,
                row.hard && `${row.hard} hard`
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <li key={topic} className="grid gap-3 px-5 py-5 sm:grid-cols-[12rem_1fr_5rem] sm:items-center sm:px-6">
                  <div>
                    <p className="text-ui-label text-primary">{topic}</p>
                    <p className="mt-1 text-xs text-blueprint-muted">{mix}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-inset" aria-hidden>
                    <div
                      className="progress-fill h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="text-technical-mono text-primary sm:text-right">
                    {row.done} / {row.total}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="surface-inset mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-body-md text-blueprint-muted">
          A problem is published only once its statement is reviewed, its reference solution passes every case,
          and the tracer can visualize its structure.
        </p>
        <NavLink to="/problems" className={cn(button.outlineSm, "shrink-0")}>
          Browse what is live <ArrowRight size={14} aria-hidden />
        </NavLink>
      </div>
    </div>
  );
}
