import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";

/** Page numbers to show: always the ends, the current page and its neighbours. */
const pageList = (page: number, pages: number): Array<number | "gap"> => {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  const result: Array<number | "gap"> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push("gap");
    result.push(value);
  });
  return result;
};

const cell =
  "no-lift flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-technical-mono transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export function Pagination({
  page,
  pages,
  onPage,
  label = "Pages"
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  label?: string;
}) {
  if (pages <= 1) return null;

  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-center gap-1.5">
      <button
        type="button"
        className={cn(cell, "border-blueprint-line bg-card text-primary hover:bg-surface-hover")}
        style={{ minHeight: 0 }}
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft size={15} aria-hidden />
      </button>
      {pageList(page, pages).map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-technical-mono text-blueprint-muted" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            aria-current={entry === page ? "page" : undefined}
            onClick={() => onPage(entry)}
            className={cn(
              cell,
              entry === page
                ? "border-transparent bg-[var(--fill-blue)] text-[var(--fill-blue-text)]"
                : "border-blueprint-line bg-card text-primary hover:bg-surface-hover"
            )}
            style={{ minHeight: 0 }}
          >
            {entry}
          </button>
        )
      )}
      <button
        type="button"
        className={cn(cell, "border-blueprint-line bg-card text-primary hover:bg-surface-hover")}
        style={{ minHeight: 0 }}
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
        aria-label="Next page"
      >
        <ChevronRight size={15} aria-hidden />
      </button>
    </nav>
  );
}

/** Clamp a 1-based page into range and slice the matching items. */
export function paginate<T>(items: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return { pages, page: current, items: items.slice((current - 1) * size, current * size) };
}
