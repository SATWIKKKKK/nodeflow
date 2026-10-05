import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { loadProblems } from "../../lib/problems";
import { cn } from "../../lib/cn";
import type { ProblemSummary } from "@nodeflow/shared";

/** One curve for every part of the search, so it moves as a single object. */
const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING = { type: "spring", stiffness: 520, damping: 42, mass: 0.7 } as const;
const MAX_RESULTS = 7;

/**
 * Search that starts as a round key and opens into the field.
 *
 * Collapsed it is one raised button, so the header stays quiet; pressing it
 * (or "/" anywhere) grows it into a hollow field with the cursor already in
 * it and the list open underneath. On a phone the open field takes the whole
 * header row rather than squeezing between its buttons. The highlight glides
 * from option to option instead of jumping, and the problem list loads the
 * first time the search opens, never on page load.
 */
export function ProblemSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [cursor, setCursor] = useState(0);

  const ensureLoaded = () => {
    if (problems.length) return;
    loadProblems()
      .then(setProblems)
      .catch(() => undefined);
  };

  // With nothing typed, the list offers a start rather than staying empty.
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return problems.slice(0, 5);
    return problems
      .filter(
        (problem) =>
          problem.title.toLowerCase().includes(needle) || problem.topic.toLowerCase().includes(needle)
      )
      .slice(0, MAX_RESULTS);
  }, [problems, query]);

  useEffect(() => setCursor(0), [query]);

  const open = () => {
    ensureLoaded();
    setExpanded(true);
    requestAnimationFrame(() => input.current?.focus());
  };

  const close = () => {
    setExpanded(false);
    setQuery("");
    input.current?.blur();
  };

  // Click anywhere else closes it.
  useEffect(() => {
    if (!expanded) return;
    const away = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [expanded]);

  // "/" opens it from anywhere that is not already a text field.
  useEffect(() => {
    const slash = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      open();
    };
    window.addEventListener("keydown", slash);
    return () => window.removeEventListener("keydown", slash);
  });

  const go = (problem?: ProblemSummary) => {
    if (!problem) {
      navigate(`/problems${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
    } else {
      navigate(`/workspace/${problem.id}`);
    }
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, Math.max(0, results.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => Math.max(0, value - 1));
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  const loading = expanded && problems.length === 0;

  return (
    <div ref={root} className={cn("relative flex h-11 w-full max-w-[34rem] items-center", className)}>
      <motion.form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          go(results[cursor]);
        }}
        initial={false}
        animate={{ width: expanded ? "100%" : 44 }}
        transition={{ duration: 0.42, ease: EASE }}
        className={cn(
          "search-shell relative flex h-11 items-center overflow-hidden rounded-full",
          expanded ? "search-shell-open" : "search-shell-closed",
          // On a phone the open field covers the header row.
          expanded &&
            "max-lg:fixed max-lg:left-3 max-lg:top-2.5 max-lg:z-[80] max-lg:!w-[calc(100vw-1.5rem)]"
        )}
      >
        <button
          type="button"
          onClick={() => (expanded ? input.current?.focus() : open())}
          aria-label={expanded ? "Search problems" : "Open search"}
          aria-expanded={expanded}
          className="no-lift flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary"
          style={{ minHeight: 0 }}
          tabIndex={expanded ? -1 : 0}
        >
          <Search size={17} aria-hidden />
        </button>

        <motion.input
          ref={input}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            ensureLoaded();
            setExpanded(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search problems"
          aria-label="Search problems"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          role="combobox"
          tabIndex={expanded ? 0 : -1}
          initial={false}
          animate={{ opacity: expanded ? 1 : 0 }}
          transition={{ duration: 0.22, delay: expanded ? 0.12 : 0 }}
          className="search-input h-full min-w-0 flex-1 bg-transparent pr-2 text-[15px] text-primary outline-none placeholder:text-blueprint-muted focus-visible:outline-none"
          style={{ minHeight: 0 }}
        />

        <AnimatePresence>
          {expanded && (
            <motion.button
              type="button"
              key="clear"
              aria-label={query ? "Clear search" : "Close search"}
              onClick={() => (query ? (setQuery(""), input.current?.focus()) : close())}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18 }}
              className="no-lift mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-blueprint-muted hover:text-primary"
              style={{ minHeight: 0 }}
            >
              <X size={16} aria-hidden />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.form>

      <AnimatePresence>
        {expanded && (
          <motion.div
            id={listId}
            role="listbox"
            key="results"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.24, ease: EASE, delay: 0.06 }}
            style={{ transformOrigin: "top center" }}
            className={cn(
              "neu-panel search-results absolute left-0 top-[calc(100%+0.6rem)] z-[70] w-full min-w-[18rem] rounded-[1.6rem] border border-blueprint-line bg-card p-2 shadow-[0_18px_40px_rgba(0,0,0,0.14)]",
              "max-lg:fixed max-lg:left-3 max-lg:top-[4.1rem] max-lg:z-[80] max-lg:w-[calc(100vw-1.5rem)]"
            )}
          >
            {loading ? (
              <p className="px-4 py-3 text-sm text-blueprint-muted">Loading problems…</p>
            ) : results.length === 0 ? (
              <p className="px-4 py-3 text-sm text-blueprint-muted">No problem matches that.</p>
            ) : (
              <>
                {!query.trim() && (
                  <p className="px-4 pb-1 pt-2 text-technical-mono text-blueprint-muted">Start with</p>
                )}
                {results.map((problem, index) => {
                  const active = index === cursor;
                  return (
                    <button
                      key={problem.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setCursor(index)}
                      onFocus={() => setCursor(index)}
                      onClick={() => go(problem)}
                      className="search-option no-lift relative flex w-full items-center justify-between gap-4 rounded-full px-4 py-2.5 text-left"
                      style={{ minHeight: 0, width: "100%" }}
                    >
                      {active && (
                        <motion.span
                          layoutId={`${listId}-cursor`}
                          transition={SPRING}
                          className="search-cursor absolute inset-0 rounded-full"
                          aria-hidden
                        />
                      )}
                      <span className="relative truncate text-[15px] text-primary">{problem.title}</span>
                      <span className="relative shrink-0 text-xs text-blueprint-muted">
                        {problem.topic} · {problem.difficulty}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
