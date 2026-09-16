import { useEffect, useMemo, useState } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, Circle, Layers3, Search, X } from "lucide-react";
import type { ProgressSummary } from "@nodeflow/shared";
import { api } from "../lib/api";
import { useProblems } from "../lib/problems";
import { useSession } from "../lib/session";
import { cn } from "../lib/cn";
import { SectionHeading } from "../components/SectionHeading";
import { Spinner } from "../components/PageLoader";
import { button, chip, container } from "../components/ui";

type Status = "all" | "unattempted" | "attempted" | "solved";

const STATUS_FILTERS: Array<{ id: Status; label: string }> = [
  { id: "all", label: "All" },
  { id: "unattempted", label: "Not started" },
  { id: "attempted", label: "Attempted" },
  { id: "solved", label: "Solved" }
];

const DIFFICULTY_ORDER = ["Easy", "Medium", "Hard"];

function FilterRow({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-24 shrink-0 text-technical-mono text-blueprint-muted">{label}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={cn(chip.base, "no-lift hover:bg-surface-hover", active && chip.active, active && "hover:bg-primary")}
              style={{ minHeight: 0 }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ProblemsPage() {
  const session = useSession();
  const { problems, error, loading } = useProblems();
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [params, setParams] = useSearchParams();

  const query = params.get("q") ?? "";
  const [topic, setTopic] = useState("All");
  const [difficulty, setDifficulty] = useState("All");
  const [status, setStatus] = useState<Status>("all");

  const setQuery = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  };

  // Progress is what makes the status filter meaningful; it is optional, so a
  // failure here must not take the list down with it.
  useEffect(() => {
    let mounted = true;
    api
      .progress(session.token)
      .then((summary) => mounted && setProgress(summary))
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [session.token]);

  const statusById = useMemo(() => {
    const map = new Map<string, { attempts: number; accepted: boolean }>();
    for (const entry of progress?.problems ?? []) {
      map.set(entry.id, { attempts: entry.attempts, accepted: entry.accepted });
    }
    return map;
  }, [progress]);

  // Facets come from the data actually served, so publishing more of the bank
  // widens the filters automatically instead of leaving dead buttons behind.
  const topics = useMemo(
    () => ["All", ...[...new Set(problems.map((entry) => entry.topic))].sort()],
    [problems]
  );
  const difficulties = useMemo(
    () => [
      "All",
      ...[...new Set(problems.map((entry) => entry.difficulty))].sort(
        (a, b) => DIFFICULTY_ORDER.indexOf(a) - DIFFICULTY_ORDER.indexOf(b)
      )
    ],
    [problems]
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return problems.filter((problem) => {
      if (topic !== "All" && problem.topic !== topic) return false;
      if (difficulty !== "All" && problem.difficulty !== difficulty) return false;

      if (status !== "all") {
        const record = statusById.get(problem.id);
        const attempts = record?.attempts ?? 0;
        const accepted = record?.accepted ?? false;
        if (status === "solved" && !accepted) return false;
        if (status === "attempted" && (accepted || attempts === 0)) return false;
        if (status === "unattempted" && attempts > 0) return false;
      }

      if (!needle) return true;
      return (
        problem.title.toLowerCase().includes(needle) ||
        problem.topic.toLowerCase().includes(needle)
      );
    });
  }, [problems, query, topic, difficulty, status, statusById]);

  const filtered = query || topic !== "All" || difficulty !== "All" || status !== "all";
  const clearFilters = () => {
    setQuery("");
    setTopic("All");
    setDifficulty("All");
    setStatus("all");
  };

  const solvedCount = progress?.accepted ?? 0;

  return (
    <div className={`${container} py-10 sm:py-14`}>
      <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          as="h1"
          className="mb-0"
          eyebrow="Problem bank"
          title="Pick a problem."
          lead="Every problem runs your real code in the sandbox and replays it. Start anywhere; the workspace opens with the function signature ready."
        />
        <NavLink to="/problem-map" className={cn(button.outlineSm, "self-start lg:self-auto")}>
          <Layers3 size={15} aria-hidden /> Problem map
        </NavLink>
      </div>

      <div className="surface-card grid gap-5">
        <div className="relative">
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blueprint-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by title or topic"
            aria-label="Filter problems"
            className="h-12 w-full rounded-full border border-blueprint-line bg-background pl-11 pr-4 text-[15px] text-primary outline-none placeholder:text-blueprint-muted focus:border-primary focus-visible:outline-none"
          />
        </div>

        <FilterRow
          label="Topic"
          options={topics.map((option) => ({ id: option, label: option }))}
          value={topic}
          onChange={setTopic}
        />
        <FilterRow
          label="Difficulty"
          options={difficulties.map((option) => ({ id: option, label: option }))}
          value={difficulty}
          onChange={setDifficulty}
        />
        {session.user && (
          <FilterRow
            label="Status"
            options={STATUS_FILTERS}
            value={status}
            onChange={(id) => setStatus(id as Status)}
          />
        )}
      </div>

      <div className="mb-4 mt-10 flex flex-wrap items-center justify-between gap-3">
        <p className="text-technical-mono text-blueprint-muted" aria-live="polite">
          {loading ? "Loading problems" : `${visible.length} of ${problems.length} problems`}
          {session.user && !loading ? ` · ${solvedCount} solved` : ""}
        </p>
        {filtered && (
          <button type="button" onClick={clearFilters} className={cn(button.ghost, "no-lift")} style={{ minHeight: 0 }}>
            <X size={14} aria-hidden /> Clear filters
          </button>
        )}
      </div>

      {error ? (
        <div className="status-error rounded-xl border px-5 py-4 text-body-md">
          Could not load the problem bank. Check that the Noesis backend is running, then reload.
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : visible.length === 0 ? (
        <div className="surface-card text-center">
          <p className="text-headline-sm text-primary">No problem matches those filters.</p>
          <p className="mt-2 text-body-md text-blueprint-muted">Try a different topic, or clear the filters.</p>
          <button type="button" onClick={clearFilters} className={cn(button.outlineSm, "mt-6")}>
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="surface-frame divide-y divide-blueprint-line overflow-hidden">
          {visible.map((problem) => {
            const record = statusById.get(problem.id);
            const solved = record?.accepted ?? false;
            const attempted = !solved && (record?.attempts ?? 0) > 0;

            return (
              <li key={problem.id}>
                <NavLink
                  to={`/workspace/${problem.id}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-hover sm:px-6"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                      solved ? "border-blueprint-line" : "border-dashed border-blueprint-line"
                    )}
                  >
                    {solved ? (
                      <Check size={15} aria-hidden className="check-icon" />
                    ) : (
                      <Circle
                        size={8}
                        aria-hidden
                        className={attempted ? "fill-current text-primary" : "text-blueprint-line"}
                      />
                    )}
                    <span className="sr-only">{solved ? "Solved" : attempted ? "Attempted" : "Not started"}</span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-primary">{problem.title}</span>
                    <span className="mt-1 block text-xs text-blueprint-muted sm:hidden">
                      {problem.topic} · {problem.difficulty}
                    </span>
                  </span>

                  <span className={cn(chip.small, "hidden text-blueprint-muted sm:inline-flex")}>
                    {problem.topic}
                  </span>
                  <span
                    className={cn(
                      "hidden w-16 text-right text-technical-mono sm:block",
                      problem.difficulty === "Easy" ? "text-blueprint-muted" : "text-primary"
                    )}
                  >
                    {problem.difficulty}
                  </span>
                  <ArrowRight
                    size={14}
                    aria-hidden
                    className="shrink-0 text-blueprint-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  />
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}

      {!session.user && (
        <div className="surface-inset mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-md text-blueprint-muted">
            Sign in to track which problems you have attempted and solved. Everything else works without an
            account.
          </p>
          <NavLink to="/signup" className={cn(button.outlineSm, "shrink-0")}>
            Create an account
          </NavLink>
        </div>
      )}
    </div>
  );
}
