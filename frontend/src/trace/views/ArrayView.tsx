import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { ArrayViewModel, CellModel, PointerModel } from "../model";
import { placeAt } from "./placeAt";

const CELL_BASE =
  "flex h-11 min-w-11 items-center justify-center border-[1.25px] px-2 font-mono text-[13px] transition-colors duration-300";

/** The states every cell can report, wherever it is drawn. */
const cellClass = (cell: CellModel) =>
  cn(
    CELL_BASE,
    cell.changed
      ? "border-transparent bg-[var(--fill-blue)] text-[var(--fill-blue-text)]"
      : cell.comparing
        ? "border-[var(--compare)] bg-[var(--compare-soft)] text-[var(--compare-text)]"
        : cell.reading
          ? "border-[var(--fill-blue)] bg-card text-primary"
          : "border-blueprint-line bg-card text-primary"
  );

/**
 * A cell in an indexed row carries three separate pieces of news, in order of
 * urgency: it just changed, the next line is weighing it, or the sort has
 * finished with it. Comparing is amber rather than blue so "being looked at"
 * never reads as "was written".
 */
const indexedCellClass = (cell: CellModel, pointed: boolean, settled: boolean) =>
  cn(
    CELL_BASE,
    cell.changed
      ? "border-transparent bg-[var(--fill-blue)] text-[var(--fill-blue-text)]"
      : cell.comparing
        ? "border-[var(--compare)] bg-[var(--compare-soft)] text-[var(--compare-text)]"
        : // A read borrows the accent for its border only. Filling it would say
          // the cell was written, which is the one thing it was not.
          cell.reading
          ? "border-[var(--fill-blue)] bg-card text-primary"
          : settled
            ? "border-blueprint-line bg-surface-inset text-blueprint-muted"
            : "border-blueprint-line bg-card text-primary",
    // The outline follows whichever cell a variable names, so a running
    // minimum visibly transfers rather than just recolouring. It yields to any
    // more specific state: an index almost always names the cell being read,
    // and the dark outline would simply hide that news.
    pointed && !cell.changed && !cell.comparing && !cell.reading && "z-10 outline-2 outline-offset-[-3px] outline-primary"
  );

function Pointers({ pointers }: { pointers: PointerModel[] }) {
  if (!pointers.length) return <span className="h-4" />;
  return (
    <span className="flex flex-col items-center gap-0.5">
      <svg width="8" height="6" viewBox="0 0 8 6" aria-hidden className="text-[var(--graphics-inactive)]">
        <path d="M4 0 L8 6 L0 6 Z" fill="currentColor" />
      </svg>
      {pointers.map((pointer) => (
        <motion.span
          layoutId={`ptr-${pointer.name}`}
          key={pointer.name}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            "rounded-full border px-1.5 py-px font-mono text-[10.5px] leading-tight",
            pointer.changed
              ? "border-transparent bg-[var(--fill-blue)] text-[var(--fill-blue-text)]"
              : "border-blueprint-line bg-card text-blueprint-muted"
          )}
        >
          {pointer.name}
        </motion.span>
      ))}
    </span>
  );
}

const settled = (view: ArrayViewModel, index: number) =>
  view.settled !== undefined &&
  (index < view.settled.prefix || index >= view.cells.length - view.settled.suffix);

const HEAP_RADIUS = 18;
const HEAP_LEVEL = 60;
const HEAP_TOP = 24;
const HEAP_SLOT = 58;

const depthOf = (index: number) => Math.floor(Math.log2(index + 1));

/**
 * A heap drawn as the tree its indices already describe: cell `i` sits under
 * `(i - 1) / 2`. Nothing new is inferred — the array and the tree are two
 * renderings of one list, and because both read the same cell models a
 * comparison lights the same value in both at once.
 *
 * Nodes are keyed by the cell, so in a heap that only ever rearranges itself
 * the key follows the value and a sift step animates as two nodes trading
 * places along their edge rather than two labels blinking.
 */
function HeapTree({ view }: { view: ArrayViewModel }) {
  const count = view.cells.length;
  if (count === 0) return null;

  const deepest = depthOf(count - 1);
  const width = Math.max(2 ** deepest, 1) * HEAP_SLOT;
  const height = HEAP_TOP + deepest * HEAP_LEVEL + HEAP_RADIUS + 10;

  const at = (index: number) => {
    const depth = depthOf(index);
    const first = 2 ** depth - 1;
    return {
      x: ((index - first + 0.5) / 2 ** depth) * width,
      y: HEAP_TOP + depth * HEAP_LEVEL
    };
  };

  return (
    <div className="overflow-x-auto pb-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Heap as a tree: ${view.cells.map((cell) => cell.label).join(", ")}`}
        className="h-auto"
        style={{ width: "100%", maxWidth: width * 1.1, minWidth: Math.min(width, count * 34 + 40) }}
      >
        {view.cells.slice(1).map((_, offset) => {
          const child = offset + 1;
          const parent = Math.floor((child - 1) / 2);
          const from = at(parent);
          const to = at(child);
          return (
            <line
              key={`${parent}-${child}`}
              x1={from.x}
              y1={from.y + HEAP_RADIUS}
              x2={to.x}
              y2={to.y - HEAP_RADIUS}
              strokeWidth={1.5}
              className="stroke-blueprint-line"
            />
          );
        })}

        {view.cells.map((cell, index) => {
          const spot = at(index);
          return (
            <g key={cell.key} style={placeAt(spot.x, spot.y)}>
              <circle
                r={HEAP_RADIUS}
                strokeWidth={cell.comparing ? 2.25 : 1.5}
                className={cn(
                  "transition-[fill] duration-300",
                  cell.comparing
                    ? "fill-[var(--compare-soft)] stroke-[var(--compare)]"
                    : cell.changed
                      ? "fill-[var(--fill-blue)] stroke-[var(--graphics-node)]"
                      : cell.reading
                        ? "fill-card stroke-[var(--fill-blue)]"
                        : "fill-card stroke-[var(--graphics-node)]"
                )}
              />
              <text
                y={4}
                textAnchor="middle"
                className={cn(
                  "font-mono text-[12px] transition-[fill] duration-300",
                  cell.comparing
                    ? "fill-[var(--compare-text)]"
                    : cell.changed
                      ? "fill-[var(--fill-blue-text)]"
                      : "fill-[var(--graphics-node)]"
                )}
              >
                {cell.label.length > 4 ? `${cell.label.slice(0, 3)}…` : cell.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const FOREST_RADIUS = 16;
const FOREST_LEVEL = 54;
const FOREST_SLOT = 52;
const FOREST_TOP = 22;

/**
 * A disjoint-set array as the forest it describes.
 *
 * Edges are keyed by the pair they join, so path compression reads the way it
 * should: the link to the old parent leaves and a link straight to the root
 * draws itself in, rather than a number in a row quietly changing.
 */
function Forest({ view }: { view: ArrayViewModel }) {
  const parent = view.forest;
  if (!parent) return null;

  const children = new Map<number, number[]>();
  const roots: number[] = [];
  parent.forEach((up, node) => {
    if (up === node) roots.push(node);
    else children.set(up, [...(children.get(up) ?? []), node]);
  });

  const spot = new Map<number, { x: number; depth: number }>();
  const seen = new Set<number>();
  let cursor = 0;

  const place = (node: number, depth: number): number => {
    // A malformed parent array can cycle; a node is laid out once at most.
    if (seen.has(node)) return spot.get(node)?.x ?? cursor;
    seen.add(node);

    const kids = children.get(node) ?? [];
    if (kids.length === 0) {
      const x = cursor;
      cursor += 1;
      spot.set(node, { x, depth });
      return x;
    }

    const spread = kids.map((kid) => place(kid, depth + 1));
    const x = (Math.min(...spread) + Math.max(...spread)) / 2;
    spot.set(node, { x, depth });
    return x;
  };

  for (const root of roots) place(root, 0);
  // Anything inside a cycle still gets drawn, after the well-formed trees.
  parent.forEach((_, node) => place(node, 0));

  const deepest = Math.max(0, ...[...spot.values()].map((at) => at.depth));
  const width = Math.max(cursor, 1) * FOREST_SLOT;
  const height = FOREST_TOP + deepest * FOREST_LEVEL + FOREST_RADIUS + 12;
  const at = (node: number) => {
    const where = spot.get(node) ?? { x: 0, depth: 0 };
    return { x: (where.x + 0.5) * FOREST_SLOT, y: FOREST_TOP + where.depth * FOREST_LEVEL };
  };

  return (
    <div className="overflow-x-auto pb-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Disjoint sets: ${parent.map((up, node) => `${node}→${up}`).join(", ")}`}
        className="h-auto"
        style={{ width: "100%", maxWidth: width * 1.1, minWidth: Math.min(width, parent.length * 34 + 40) }}
      >
        <AnimatePresence initial={false}>
          {parent.map((up, node) => {
            if (up === node) return null;
            const from = at(node);
            const to = at(up);
            return (
              <motion.line
                key={`${node}->${up}`}
                x1={from.x}
                y1={from.y - FOREST_RADIUS}
                x2={to.x}
                y2={to.y + FOREST_RADIUS}
                strokeWidth={1.5}
                className="stroke-[var(--graphics-node)]"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              />
            );
          })}
        </AnimatePresence>

        {parent.map((_, node) => {
          const cell = view.cells[node];
          const where = at(node);
          return (
            <g key={node} style={placeAt(where.x, where.y)}>
              <circle
                r={FOREST_RADIUS}
                strokeWidth={cell?.comparing ? 2.25 : 1.5}
                className={cn(
                  "transition-[fill] duration-300",
                  cell?.comparing
                    ? "fill-[var(--compare-soft)] stroke-[var(--compare)]"
                    : cell?.changed
                      ? "fill-[var(--fill-blue)] stroke-[var(--graphics-node)]"
                      : "fill-card stroke-[var(--graphics-node)]"
                )}
              />
              <text
                y={4}
                textAnchor="middle"
                className={cn(
                  "font-mono text-[11px] transition-[fill] duration-300",
                  cell?.changed ? "fill-[var(--fill-blue-text)]" : "fill-[var(--graphics-node)]"
                )}
              >
                {node}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Row of cells with index numbers and the index variables that point at them. */
function IndexedRow({ view, scope }: { view: ArrayViewModel; scope: string }) {
  const byIndex = new Map<number, PointerModel[]>();
  for (const pointer of view.pointers) {
    byIndex.set(pointer.index, [...(byIndex.get(pointer.index) ?? []), pointer]);
  }
  // An index one past the end (e.g. `right = len(nums)`) gets a ghost slot.
  const ghost = byIndex.has(view.cells.length);

  return (
    // Pointer pills and travelling cells animate within this view only.
    <LayoutGroup id={scope}>
    <div className="flex items-start">
      {/* Real empty columns rather than a computed width: the row then lines
          up under the one above it whatever a cell turns out to measure, and
          the browser does the arithmetic. They animate in and out, so a slide
          reads as the pattern moving rather than as cells being re-dealt. */}
      <AnimatePresence initial={false}>
        {Array.from({ length: view.aligned?.offset ?? 0 }, (_, gap) => (
          <motion.div
            key={`gap-${gap}`}
            layout
            aria-hidden
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="-ml-[1.25px] flex shrink-0 flex-col items-center first:ml-0"
          >
            <span className={cn(CELL_BASE, "border-transparent")} />
          </motion.div>
        ))}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {view.cells.map((cell, index) => (
          // The column is the slot: it holds the index, the pointers and the
          // window band, none of which travel when a value moves.
          <motion.div
            key={`slot-${index}`}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
            className="relative -ml-[1.25px] flex flex-col items-center first:ml-0"
          >
            {view.divider !== undefined && index === Math.min(view.divider, view.cells.length - 1) && (
              // One element for the whole row, so moving it between columns is
              // a slide rather than a blink. Past the last cell it pins to the
              // right edge: everything weighed so far went to the low side.
              <motion.span
                aria-hidden
                layoutId={`${scope}:divider`}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className={cn(
                  "absolute -top-[5px] z-20 h-[54px] w-[2.5px] rounded-full bg-[var(--compare)]",
                  view.divider > index ? "right-0 translate-x-1/2" : "left-0 -translate-x-1/2"
                )}
              />
            )}
            <motion.span
              // In a permuting array the box follows its value between slots,
              // so a swap reads as two cells trading places.
              layoutId={view.permuting ? `${scope}:cell:${cell.key}` : undefined}
              data-flow={`${view.key}:${index}`}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className={cn(
                indexedCellClass(cell, byIndex.has(index), settled(view, index)),
                // Confirmed to match what it is sitting over. Quieter than a
                // comparison, which is a question rather than an answer.
                view.aligned !== undefined &&
                  index < view.aligned.matched &&
                  !cell.comparing &&
                  "border-[var(--fill-blue)] bg-[var(--fill-blue)]/15",
                // The value has been lifted out of the row and everything else
                // is being measured against it, so the cell keeps a standing
                // mark even on the steps where nothing touches it.
                view.pivot === index && "outline-2 outline-offset-2 outline-dashed outline-[var(--compare)]",
                cell.ref && "text-[11.5px]"
              )}
            >
              {/* Keyed by the value so the commit animation re-fires on a write. */}
              <span key={cell.label} className={cn(cell.changed && "value-commit")}>
                {cell.label}
              </span>
            </motion.span>
            {cell.previous !== undefined ? (
              <span className="value-was mt-1 font-mono text-[10px] leading-none">{cell.previous}</span>
            ) : (
              view.cells.some((other) => other.previous !== undefined) && <span className="mt-1 h-[10px]" />
            )}
            {view.window && (
              <span
                aria-hidden
                className={cn(
                  "mt-1 h-[3px] self-stretch",
                  index >= view.window.from && index <= view.window.to
                    ? "bg-[var(--fill-blue)] opacity-60"
                    : "bg-transparent",
                  index === view.window.from && "rounded-l-full",
                  index === view.window.to && "rounded-r-full"
                )}
              />
            )}
            {view.sumSpan && (
              // The stretch a running total is being asked about. Amber,
              // because it is a question the line is putting to the row, not
              // something the row has become.
              <motion.span
                aria-hidden
                layout
                className={cn(
                  "mt-1 h-[3px] self-stretch",
                  index >= view.sumSpan.from && index <= view.sumSpan.to
                    ? "bg-[var(--compare)]"
                    : "bg-transparent",
                  index === view.sumSpan.from && "rounded-l-full",
                  index === view.sumSpan.to && "rounded-r-full"
                )}
              />
            )}
            {view.variant !== "set" && (
              <span className="mt-1 font-mono text-[10px] text-blueprint-muted">{index}</span>
            )}
            <Pointers pointers={byIndex.get(index) ?? []} />
          </motion.div>
        ))}
      </AnimatePresence>
      {ghost && (
        <div className="ml-1 flex flex-col items-center">
          <span className="flex h-11 min-w-11 items-center justify-center border-[1.25px] border-dashed border-blueprint-line px-2 font-mono text-[11px] text-blueprint-muted">
            end
          </span>
          <span className="mt-1 font-mono text-[10px] text-blueprint-muted">{view.cells.length}</span>
          <Pointers pointers={byIndex.get(view.cells.length) ?? []} />
        </div>
      )}
      {view.cells.length === 0 && !ghost && (
        <span className="flex h-11 items-center rounded-lg border-[1.25px] border-dashed border-blueprint-line px-3 font-mono text-[12px] text-blueprint-muted">
          empty
        </span>
      )}
    </div>
    </LayoutGroup>
  );
}

function StackColumn({ view }: { view: ArrayViewModel }) {
  const cells = [...view.cells].reverse();
  return (
    <div className="flex items-end gap-3">
      <div className="flex w-24 flex-col items-stretch">
        {view.merged && (
          // Two operands have just become one. The three steps that did it —
          // pop, pop, push — each looked like an ordinary stack move, so the
          // arithmetic is spelled out above the cell that now stands for both.
          <motion.span
            key={`${view.merged.left}${view.merged.op}${view.merged.right}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className="mb-1 text-center font-mono text-[10.5px] text-[var(--compare-text)]"
          >
            {view.merged.left} {view.merged.op} {view.merged.right}
          </motion.span>
        )}
        <AnimatePresence initial={false}>
          {cells.map((cell, index) => (
            <motion.div
              key={`${view.cells.length - 1 - index}`}
              layout
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              // Consumed rather than merely popped: an operand that fed a
              // result sinks toward where the result now sits.
              exit={{ opacity: 0, y: view.merged ? 10 : -14, scale: view.merged ? 0.8 : 1 }}
              transition={{ duration: 0.25 }}
              className="-mt-[1.25px] first:mt-0"
            >
              <span data-flow={`${view.key}:${view.cells.length - 1 - index}`} className={cn(cellClass(cell), "w-full")}>
                {cell.label}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        <span className="mt-1 h-[3px] rounded-full bg-[var(--fill-blue)]" aria-hidden />
      </div>
      <span className="pb-1 font-mono text-[11px] text-blueprint-muted">
        {view.cells.length ? "← top" : "empty"}
      </span>
    </div>
  );
}

function QueueRow({ view }: { view: ArrayViewModel }) {
  // Keys survive a dequeue: the nth occurrence of a value keeps its identity.
  const seen = new Map<string, number>();
  const keys = view.cells.map((cell) => {
    const count = seen.get(cell.label) ?? 0;
    seen.set(cell.label, count + 1);
    return `${cell.label}#${count}`;
  });
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10.5px] text-blueprint-muted">front</span>
      <div className="flex">
        <AnimatePresence initial={false} mode="popLayout">
          {view.cells.map((cell, index) => (
            <motion.span
              key={keys[index]}
              data-flow={`${view.key}:${index}`}
              layout
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.25 }}
              className={cn(cellClass(cell), "-ml-[1.25px] first:ml-0")}
            >
              {cell.label}
            </motion.span>
          ))}
        </AnimatePresence>
        {view.cells.length === 0 && (
          <span className="flex h-11 items-center rounded-lg border-[1.25px] border-dashed border-blueprint-line px-3 font-mono text-[12px] text-blueprint-muted">
            empty
          </span>
        )}
      </div>
      <span className="font-mono text-[10.5px] text-blueprint-muted">back</span>
    </div>
  );
}

function SetChips({ view }: { view: ArrayViewModel }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <AnimatePresence initial={false}>
        {view.cells.map((cell) => (
          <motion.span
            key={cell.label}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={cn(
              "rounded-full border-[1.25px] px-2.5 py-1 font-mono text-[12px]",
              cell.changed ? "border-transparent bg-[var(--fill-blue)] text-[var(--fill-blue-text)]" : "border-blueprint-line bg-card text-primary"
            )}
          >
            {cell.label}
          </motion.span>
        ))}
      </AnimatePresence>
      {view.cells.length === 0 && <span className="font-mono text-[12px] text-blueprint-muted">empty set</span>}
    </div>
  );
}

const VARIANT_LABEL: Record<ArrayViewModel["variant"], string> = {
  list: "array",
  tuple: "tuple",
  stack: "stack",
  queue: "queue",
  deque: "deque",
  heap: "heap",
  set: "set",
  string: "string"
};

export function ArrayView({ view, scope }: { view: ArrayViewModel; scope: string }) {
  return (
    <div>
      <p className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-[13px] text-primary">{view.title}</span>
        <span className="text-technical-mono text-blueprint-muted">
          {VARIANT_LABEL[view.variant]} · {view.cells.length + view.truncated}
        </span>
        {view.sumSpan && (
          <span className="text-technical-mono text-[var(--compare-text)]">
            sum {view.sumSpan.from}…{view.sumSpan.to} = {view.sumSpan.total}
          </span>
        )}
      </p>
      {/* A heap is shown twice: the tree its indices describe, above the row
          they are stored in. Both read the same cells, so one comparison
          lights the same value in both. */}
      {view.variant === "heap" && <HeapTree view={view} />}
      {view.forest && <Forest view={view} />}

      <div className="overflow-x-auto pb-1">
        {view.variant === "stack" ? (
          <StackColumn view={view} />
        ) : view.variant === "queue" || view.variant === "deque" ? (
          <QueueRow view={view} />
        ) : view.variant === "set" ? (
          <SetChips view={view} />
        ) : (
          <IndexedRow view={view} scope={`${scope}:${view.key}`} />
        )}
      </div>
      {view.truncated > 0 && (
        <p className="mt-1 font-mono text-[11px] text-blueprint-muted">+{view.truncated} more not shown</p>
      )}
      {view.variant === "heap" && (
        <p className="mt-1 font-mono text-[11px] text-blueprint-muted">index 0 is the top of the heap</p>
      )}
    </div>
  );
}
