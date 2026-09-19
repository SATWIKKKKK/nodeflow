import { useMemo } from "react";
import { motion } from "framer-motion";
import type { ProblemSignature, TraceDiff, TraceStep } from "@nodeflow/shared";
import { cn } from "../lib/cn";
import { buildListSlots, buildStepModel, type ViewModel } from "./model";
import { ArrayView } from "./views/ArrayView";
import { GraphView } from "./views/GraphView";
import { GridView } from "./views/GridView";
import { ListView } from "./views/ListView";
import { MapView, ObjectView } from "./views/TableViews";
import { TreeView } from "./views/TreeView";

/**
 * The 2D replay: every structure on the heap drawn in its own shape, the
 * variables as chips, the call stack when recursion is involved, and one
 * sentence saying what the last line did.
 */

function renderView(view: ViewModel) {
  switch (view.kind) {
    case "list":
      return <ListView view={view} />;
    case "tree":
      return <TreeView view={view} />;
    case "array":
      return <ArrayView view={view} />;
    case "grid":
      return <GridView view={view} />;
    case "graph":
      return <GraphView view={view} />;
    case "map":
      return <MapView view={view} />;
    case "object":
      return <ObjectView view={view} />;
  }
}

export function TraceDiagram({
  trace,
  diffs,
  index,
  signature,
  className
}: {
  trace: TraceStep[];
  diffs: TraceDiff[];
  index: number;
  signature?: ProblemSignature;
  className?: string;
}) {
  const slots = useMemo(() => buildListSlots(trace), [trace]);
  const model = useMemo(
    () => buildStepModel({ trace, diffs, index, slots, signature }),
    [trace, diffs, index, slots, signature]
  );

  const isGraphLike = (view: ViewModel) => view.kind === "list" || view.kind === "tree" || view.kind === "graph";
  const figures = model.views.filter(isGraphLike);
  const tables = model.views.filter((view) => !isGraphLike(view));

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-card", className)}>
      <div className="min-h-0 flex-1 overflow-auto px-5 py-5 sm:px-6">
        {figures.map((view) => (
          <section key={view.key} className="mb-6" aria-label={view.title}>
            {view.kind !== "graph" && (
              <p className="mb-1 flex items-baseline gap-2">
                <span className="font-mono text-[13px] text-primary">{view.title}</span>
                <span className="text-technical-mono text-blueprint-muted">
                  {view.kind === "list" ? "linked list" : "tree"}
                </span>
              </p>
            )}
            {renderView(view)}
          </section>
        ))}

        {tables.length > 0 && (
          <div className="grid gap-6">
            {tables.map((view) => (
              <motion.section key={view.key} layout="position" aria-label={view.title}>
                {renderView(view)}
              </motion.section>
            ))}
          </div>
        )}

        {model.variables.length > 0 && (
          <section className={cn(model.views.length > 0 && "mt-6")} aria-label="Variables">
            <p className="mb-2 text-technical-mono text-blueprint-muted">variables</p>
            <div className="flex flex-wrap gap-1.5">
              {model.variables.map((chip) => (
                <span
                  key={chip.name}
                  className={cn(
                    "max-w-full truncate rounded-full border px-2.5 py-1 font-mono text-[12px] leading-none transition-colors duration-300",
                    chip.changed
                      ? "border-transparent bg-[var(--fill-blue)] text-[var(--fill-blue-text)]"
                      : chip.isNone
                        ? "border-dashed border-blueprint-line text-blueprint-muted"
                        : "border-blueprint-line bg-card text-primary"
                  )}
                >
                  {chip.name} = {chip.value}
                </span>
              ))}
            </div>
          </section>
        )}

        {model.frames.length > 1 && (
          <section className="mt-6" aria-label="Call stack">
            <p className="mb-2 text-technical-mono text-blueprint-muted">call stack · {model.frames.length} deep</p>
            <ol className="grid gap-1">
              {model.frames
                .map((frame, depth) => ({ frame, depth }))
                .reverse()
                .slice(0, 8)
                .map(({ frame, depth }, position) => (
                  <li
                    key={`${depth}-${frame.function}`}
                    className={cn(
                      "flex items-baseline gap-2 rounded-lg border px-3 py-1.5 font-mono text-[12px]",
                      position === 0 ? "border-primary text-primary" : "border-blueprint-line text-blueprint-muted"
                    )}
                    style={{ marginLeft: Math.min(depth, 12) * 6 }}
                  >
                    <span className="truncate">
                      {frame.function}({frame.args})
                    </span>
                    <span className="ml-auto shrink-0 text-[10.5px]">line {frame.line}</span>
                  </li>
                ))}
              {model.frames.length > 8 && (
                <li className="px-3 font-mono text-[11px] text-blueprint-muted">+{model.frames.length - 8} older frames</li>
              )}
            </ol>
          </section>
        )}

        {model.views.length === 0 && model.variables.length === 0 && (
          <p className="text-body-md text-blueprint-muted">No variables yet at this step.</p>
        )}
      </div>

      <p className="min-h-12 shrink-0 border-t border-blueprint-line px-5 py-3 text-body-md text-primary sm:px-6" aria-live="off">
        {model.caption}
      </p>
    </div>
  );
}
