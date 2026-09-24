import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { loadProblems } from "../../lib/problems";
import { cn } from "../../lib/cn";
import type { ProblemSummary } from "@nodeflow/shared";

/**
 * Pill search bar (DESIGN.md §6) that jumps straight into a problem's workspace.
 * The problem list loads on first focus, not on page load.
 */
export function ProblemSearch({ className, compact = true }: { className?: string; compact?: boolean }) {
  const navigate = useNavigate();
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  const ensureLoaded = () => {
    if (problems.length) return;
    loadProblems()
      .then(setProblems)
      .catch(() => undefined);
  };

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return problems
      .filter(
        (problem) =>
          problem.title.toLowerCase().includes(needle) || problem.topic.toLowerCase().includes(needle)
      )
      .slice(0, 7);
  }, [problems, query]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const go = (problem?: ProblemSummary) => {
    if (!problem) {
      navigate(`/problems${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
    } else {
      navigate(`/workspace/${problem.id}`);
    }
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setCursor((value) => Math.min(value + 1, Math.max(0, results.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => Math.max(0, value - 1));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const showPopover = open && query.trim().length > 0;

  return (
    <div
      ref={root}
      className={cn("relative w-full", compact ? "max-w-[34rem]" : "max-w-[42rem]", className)}
    >
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          go(results[cursor]);
        }}
        className="relative h-12 rounded-full border border-blueprint-line bg-card shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03),0_12px_28px_rgba(0,0,0,0.08)]"
      >
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blueprint-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            ensureLoaded();
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search problems"
          aria-label="Search problems"
          aria-expanded={showPopover}
          aria-controls={listId}
          aria-autocomplete="list"
          role="combobox"
          className="h-full w-full rounded-full bg-transparent pl-11 pr-14 text-[15px] text-primary outline-none placeholder:text-blueprint-muted focus-visible:outline-none"
        />
        <button
          type="submit"
          aria-label="Search"
          className="no-lift absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--fill-blue)] text-[var(--fill-blue-text)] hover:bg-[var(--fill-blue-hover)]"
          style={{ minHeight: 0, width: "2rem" }}
        >
          <ArrowRight size={14} aria-hidden />
        </button>
      </form>

      {showPopover && (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+0.55rem)] z-[70] rounded-2xl border border-blueprint-line bg-card p-2 shadow-[0_18px_40px_rgba(0,0,0,0.14)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.32)]"
        >
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-blueprint-muted">
              {problems.length ? "No problem matches that." : "Loading problems…"}
            </p>
          ) : (
            results.map((problem, index) => (
              <button
                key={problem.id}
                type="button"
                role="option"
                aria-selected={index === cursor}
                onMouseEnter={() => setCursor(index)}
                onClick={() => go(problem)}
                className={cn(
                  "no-lift flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left",
                  index === cursor && "bg-surface-hover"
                )}
                style={{ minHeight: 0, width: "100%" }}
              >
                <span className="truncate text-sm text-primary">{problem.title}</span>
                <span className="shrink-0 text-xs text-blueprint-muted">
                  {problem.topic} · {problem.difficulty}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
