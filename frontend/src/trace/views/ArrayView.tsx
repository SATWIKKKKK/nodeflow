import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { ArrayViewModel, PointerModel } from "../model";

const cellClass = (changed: boolean) =>
  cn(
    "flex h-11 min-w-11 items-center justify-center border-[1.25px] px-2 font-mono text-[13px] transition-colors duration-300",
    changed ? "border-transparent bg-[var(--fill-blue)] text-[var(--fill-blue-text)]" : "border-blueprint-line bg-card text-primary"
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

/** Row of cells with index numbers and the index variables that point at them. */
function IndexedRow({ view, scope }: { view: ArrayViewModel; scope: string }) {
  const byIndex = new Map<number, PointerModel[]>();
  for (const pointer of view.pointers) {
    byIndex.set(pointer.index, [...(byIndex.get(pointer.index) ?? []), pointer]);
  }
  // An index one past the end (e.g. `right = len(nums)`) gets a ghost slot.
  const ghost = byIndex.has(view.cells.length);

  return (
    // Pointer pills animate between cells of this view only.
    <LayoutGroup id={scope}>
    <div className="flex items-start">
      <AnimatePresence initial={false}>
        {view.cells.map((cell, index) => (
          <motion.div
            key={cell.key}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
            className="-ml-[1.25px] flex flex-col items-center first:ml-0"
          >
            <span className={cn(cellClass(cell.changed), cell.ref && "text-[11.5px]")}>{cell.label}</span>
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
        <AnimatePresence initial={false}>
          {cells.map((cell, index) => (
            <motion.div
              key={`${view.cells.length - 1 - index}`}
              layout
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.25 }}
              className="-mt-[1.25px] first:mt-0"
            >
              <span className={cn(cellClass(cell.changed), "w-full")}>{cell.label}</span>
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
              layout
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.25 }}
              className={cn(cellClass(cell.changed), "-ml-[1.25px] first:ml-0")}
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

export function ArrayView({ view }: { view: ArrayViewModel }) {
  return (
    <div>
      <p className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-[13px] text-primary">{view.title}</span>
        <span className="text-technical-mono text-blueprint-muted">
          {VARIANT_LABEL[view.variant]} · {view.cells.length + view.truncated}
        </span>
      </p>
      <div className="overflow-x-auto pb-1">
        {view.variant === "stack" ? (
          <StackColumn view={view} />
        ) : view.variant === "queue" || view.variant === "deque" ? (
          <QueueRow view={view} />
        ) : view.variant === "set" ? (
          <SetChips view={view} />
        ) : (
          <IndexedRow view={view} scope={view.key} />
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
