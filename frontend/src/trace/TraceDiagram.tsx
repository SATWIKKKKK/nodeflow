import { useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ProblemSignature, TraceDiff, TraceStep } from "@nodeflow/shared";
import { cn } from "../lib/cn";
import {
  buildArrayRoles,
  buildFailingReturns,
  buildListSlots,
  buildBitPlan,
  buildCallTree,
  buildGridTrails,
  buildStepModel,
  buildEdgeVerdicts,
  buildPivots,
  buildPrefixSums,
  buildTimelinePlan,
  buildVisitOrder,
  type ViewModel
} from "./model";
import { ArrayView } from "./views/ArrayView";
import { GraphView } from "./views/GraphView";
import { GridView } from "./views/GridView";
import { ListView } from "./views/ListView";
import { MapView, ObjectView } from "./views/TableViews";
import { TreeView } from "./views/TreeView";
import { TrieView } from "./views/TrieView";
import { BitsView } from "./views/BitsView";
import { CallTreeView } from "./views/CallTreeView";
import { FlowLinks } from "./views/FlowLinks";
import { TimelineView } from "./views/TimelineView";

/**
 * The 2D replay: every structure on the heap drawn in its own shape, the
 * variables as chips, the call stack when recursion is involved, and one
 * sentence saying what the last line did.
 */

/**
 * Shared-layout ids are matched globally, and a heap id like `obj_1` means a
 * different array in a different run. Without a per-trace scope, replacing the
 * trace lets framer pair a cell with an unrelated one and animate it away.
 */
let generation = 0;

function renderView(view: ViewModel, scope: string) {
  switch (view.kind) {
    case "list":
      return <ListView view={view} />;
    case "tree":
      return <TreeView view={view} />;
    case "trie":
      return <TrieView view={view} />;
    case "bits":
      return <BitsView view={view} />;
    case "calls":
      return <CallTreeView view={view} />;
    case "array":
      return <ArrayView view={view} scope={scope} />;
    case "grid":
      return <GridView view={view} />;
    case "timeline":
      return <TimelineView view={view} />;
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
  source,
  className
}: {
  trace: TraceStep[];
  diffs: TraceDiff[];
  index: number;
  signature?: ProblemSignature;
  /** The program being replayed; lets a step show what its line compares. */
  source?: string;
  className?: string;
}) {
  const slots = useMemo(() => buildListSlots(trace), [trace]);
  const roles = useMemo(() => buildArrayRoles(trace, source), [trace, source]);
  const failing = useMemo(() => buildFailingReturns(trace), [trace]);
  const visits = useMemo(() => buildVisitOrder(trace, source), [trace, source]);
  const trails = useMemo(() => buildGridTrails(trace, source), [trace, source]);
  const bits = useMemo(() => buildBitPlan(trace, source), [trace, source]);
  const calls = useMemo(
    () => buildCallTree(trace, failing, (step) => step.heap, source),
    [trace, failing, source]
  );
  const verdicts = useMemo(() => buildEdgeVerdicts(trace), [trace]);
  const pivots = useMemo(() => buildPivots(trace, source), [trace, source]);
  const timeline = useMemo(() => buildTimelinePlan(trace), [trace]);
  const sums = useMemo(() => buildPrefixSums(trace), [trace]);
  const scope = useMemo(() => `t${(generation += 1)}`, [trace]);
  // Connectors between rows are drawn over the scrolling content, so they need
  // its box to measure against.
  const flowHost = useRef<HTMLDivElement>(null);
  const model = useMemo(
    () => buildStepModel({ trace, diffs, index, slots, roles, failing, visits, trails, bits, calls, verdicts, pivots, timeline, sums, source, signature }),
    [trace, diffs, index, slots, roles, failing, visits, trails, bits, calls, verdicts, pivots, timeline, sums, source, signature]
  );

  const isGraphLike = (view: ViewModel) => view.kind === "list" || view.kind === "tree" || view.kind === "trie" || view.kind === "calls" || view.kind === "graph";
  const figures = model.views.filter(isGraphLike);
  const tables = model.views.filter((view) => !isGraphLike(view));

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-card", className)}>
      <div className="min-h-0 flex-1 overflow-auto px-5 py-5 sm:px-6">
        <div ref={flowHost} className="relative">
        <FlowLinks flows={model.flows} host={flowHost} revision={index} />
        {figures.map((view) => (
          <section key={view.key} className="mb-6" aria-label={view.title}>
            {view.kind !== "graph" && (
              <p className="mb-1 flex items-baseline gap-2">
                <span className="font-mono text-[13px] text-primary">{view.title}</span>
                <span className="text-technical-mono text-blueprint-muted">
                  {view.kind === "list" ? "linked list" : view.kind === "trie" ? "trie" : "tree"}
                </span>
              </p>
            )}
            {renderView(view, scope)}
          </section>
        ))}

        {tables.length > 0 && (
          <div className="grid gap-6">
            {tables.map((view) => (
              <motion.section key={view.key} layout="position" aria-label={view.title}>
                {renderView(view, scope)}
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
              <AnimatePresence initial={false}>
                {model.frames
                  .map((frame, depth) => ({ frame, depth }))
                  .reverse()
                  .slice(0, 8)
                  .map(({ frame, depth }, position) => {
                    const abandoned = frame.returning?.deadEnd === true;
                    return (
                      <motion.li
                        key={`${depth}-${frame.function}`}
                        layout
                        initial={{ opacity: 0, x: 18, scale: 0.97 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        // A path that gave up should not leave like one that
                        // finished: it greys out and sinks rather than springing away.
                        exit={
                          abandoned
                            ? { opacity: 0, x: -10, filter: "grayscale(1)", transition: { duration: 0.34 } }
                            : { opacity: 0, x: 18, scale: 0.97, transition: { duration: 0.18 } }
                        }
                        transition={{ type: "spring", stiffness: 260, damping: 28 }}
                        className={cn(
                          "flex items-baseline gap-2 rounded-lg border px-3 py-1.5 font-mono text-[12px]",
                          abandoned
                            ? "border-dashed border-blueprint-line text-blueprint-muted"
                            : position === 0
                              ? "border-primary bg-surface-inset text-primary"
                              : "border-blueprint-line text-blueprint-muted"
                        )}
                        style={{ marginLeft: Math.min(depth, 12) * 6 }}
                      >
                        <span className="truncate">
                          {frame.function}({frame.args})
                        </span>
                        {frame.returning ? (
                          <span
                            className={cn(
                              "ml-auto shrink-0 rounded px-1.5 py-px text-[10.5px]",
                              abandoned
                                ? "bg-surface-inset text-blueprint-muted"
                                : "bg-[var(--fill-blue)] text-[var(--fill-blue-text)]"
                            )}
                          >
                            {abandoned ? "gave up" : `→ ${frame.returning.value}`}
                          </span>
                        ) : (
                          <span className="ml-auto shrink-0 text-[10.5px]">line {frame.line}</span>
                        )}
                      </motion.li>
                    );
                  })}
              </AnimatePresence>
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
      </div>

      <p className="min-h-12 shrink-0 border-t border-blueprint-line px-5 py-3 text-body-md text-primary sm:px-6" aria-live="off">
        {model.caption}
      </p>
    </div>
  );
}
