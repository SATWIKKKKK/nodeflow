import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { GridViewModel } from "../model";

interface Link {
  key: string;
  d: string;
}

/**
 * Connectors from the cells a line reads to the cell it is about to fill.
 *
 * Measured rather than calculated: a grid cell is sized by its content, so the
 * only reliable geometry is what the browser actually laid out. The overlay
 * lives inside the scroller so it travels with the table.
 */
function useDependencyLinks(
  dependency: GridViewModel["dependency"],
  trail: GridViewModel["trail"],
  rows: unknown
) {
  const host = useRef<HTMLDivElement>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [path, setPath] = useState("");

  useLayoutEffect(() => {
    const container = host.current;
    const box = container?.getBoundingClientRect();
    const centreOf = (row: number, col: number) => {
      const cell = container?.querySelector<HTMLElement>(`[data-cell="${row}:${col}"]`);
      if (!cell || !box) return null;
      const rect = cell.getBoundingClientRect();
      return { x: rect.left - box.left + rect.width / 2, y: rect.top - box.top + rect.height / 2 };
    };

    const points = (trail ?? []).map((cell) => centreOf(cell.row, cell.col)).filter(Boolean);
    setPath(
      points.length > 1
        ? points.map((point, at) => `${at === 0 ? "M" : "L"} ${point!.x} ${point!.y}`).join(" ")
        : ""
    );

    if (!container || !dependency) {
      setLinks([]);
      return;
    }

    const to = centreOf(dependency.to.row, dependency.to.col);
    if (!to) {
      setLinks([]);
      return;
    }

    const next: Link[] = [];
    for (const source of dependency.from) {
      const from = centreOf(source.row, source.col);
      if (!from) continue;
      // Bow the line away from the straight path so two sources reading into
      // one cell stay tellable apart, and neither hides under a row of digits.
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const lift = Math.max(10, Math.hypot(to.x - from.x, to.y - from.y) * 0.18);
      next.push({
        key: `${source.row}:${source.col}`,
        d: `M ${from.x} ${from.y} Q ${midX + lift * 0.35} ${midY - lift} ${to.x} ${to.y}`
      });
    }
    setLinks(next);
  }, [dependency, trail, rows]);

  return { host, links, path };
}

/** 2D lists: matrices, DP tables, character boards. */
export function GridView({ view }: { view: GridViewModel }) {
  const { host, links, path } = useDependencyLinks(view.dependency, view.trail, view.rows);
  const highlight = new Map(view.highlights.map((entry) => [`${entry.row}:${entry.col}`, entry.names]));
  const rowPointer = new Map<number, string[]>();
  for (const pointer of view.rowPointers) {
    rowPointer.set(pointer.index, [...(rowPointer.get(pointer.index) ?? []), pointer.name]);
  }
  const columns = Math.max(0, ...view.rows.map((row) => row.length));
  const compact = columns > 12;

  return (
    <div>
      <p className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-[13px] text-primary">{view.title}</span>
        <span className="text-technical-mono text-blueprint-muted">
          grid · {view.rows.length}×{columns}
        </span>
      </p>
      <div className="overflow-x-auto pb-1">
        <div ref={host} className="relative w-fit">
        <table className="border-collapse font-mono">
          <thead>
            <tr>
              <th />
              {Array.from({ length: columns }, (_, col) => (
                <th key={col} className="px-1 pb-1 text-center text-[10px] font-normal text-blueprint-muted">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th className="pr-2 text-right text-[10px] font-normal text-blueprint-muted">
                  <span className="whitespace-nowrap">
                    {rowPointer.has(rowIndex) && (
                      <span className="mr-1 rounded-full border border-blueprint-line bg-card px-1.5 text-[10px] text-blueprint-muted">
                        {rowPointer.get(rowIndex)!.join(",")}
                      </span>
                    )}
                    {rowIndex}
                  </span>
                </th>
                {row.map((cell, colIndex) => {
                  const names = highlight.get(`${rowIndex}:${colIndex}`);
                  return (
                    <td key={cell.key} className="p-0">
                      <span
                        data-cell={`${rowIndex}:${colIndex}`}
                        data-flow={`${view.key}:${rowIndex}:${colIndex}`}
                        title={names ? names.join(", ") : undefined}
                        className={cn(
                          "relative -ml-[1.25px] -mt-[1.25px] flex items-center justify-center border-[1.25px] transition-colors duration-300",
                          compact ? "h-8 min-w-8 px-1 text-[11px]" : "h-10 min-w-10 px-1.5 text-[12.5px]",
                          cell.changed
                            ? "border-transparent bg-[var(--fill-blue)] text-[var(--fill-blue-text)]"
                            : cell.comparing
                              ? "z-10 border-[var(--compare)] bg-[var(--compare-soft)] text-[var(--compare-text)]"
                              : cell.reading
                                ? "z-10 border-[var(--fill-blue)] bg-card text-primary"
                                : "border-blueprint-line bg-card text-primary",
                          // The row/column outline yields to the more specific news.
                          names && !cell.comparing && !cell.reading && "z-10 outline-2 outline-offset-[-3px] outline-primary"
                        )}
                      >
                        <span key={cell.label} className={cn(cell.changed && "value-commit")}>
                          {cell.label}
                        </span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Above the cells: a highlighted cell raises itself to sit over its
            neighbours' borders, and would otherwise cover the connectors. */}
        <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible" aria-hidden>
          <defs>
            <marker
              id="nf-dep-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
              className="text-[var(--compare)]"
            >
              <path d="M 0 1 L 8 5 L 0 9" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </marker>
          </defs>
          {/* The reconstruction: persistent, and in the accent rather than
              amber, because it is the answer's provenance and not a comparison. */}
          {path && (
            <motion.path
              d={path}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-[var(--fill-blue)]"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.9 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            />
          )}
          <AnimatePresence initial={false}>
            {links.map((link) => (
              <motion.path
                key={link.key}
                d={link.d}
                fill="none"
                strokeWidth={1.6}
                strokeLinecap="round"
                markerEnd="url(#nf-dep-arrow)"
                className="stroke-[var(--compare)]"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
              />
            ))}
          </AnimatePresence>
        </svg>
        </div>
      </div>
      {view.highlights.length > 0 && (
        <p className="mt-1 font-mono text-[11px] text-blueprint-muted">
          outlined: {view.highlights.map((entry) => `(${entry.names.join("")}) = (${entry.row}, ${entry.col})`).join(" · ")}
        </p>
      )}
    </div>
  );
}
