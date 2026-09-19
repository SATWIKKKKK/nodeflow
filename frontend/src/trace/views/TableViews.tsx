import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { MapViewModel, ObjectViewModel } from "../model";

/** Hash maps, counters and dictionaries: a key → value ledger. */
export function MapView({ view }: { view: MapViewModel }) {
  return (
    <div>
      <p className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-[13px] text-primary">{view.title}</span>
        <span className="text-technical-mono text-blueprint-muted">
          {view.typeName === "dict" ? "map" : view.typeName} · {view.entries.length + view.truncated}
        </span>
      </p>
      {view.entries.length === 0 ? (
        <span className="inline-flex h-9 items-center rounded-lg border-[1.25px] border-dashed border-blueprint-line px-3 font-mono text-[12px] text-blueprint-muted">
          empty
        </span>
      ) : (
        <div className="inline-grid max-w-full grid-cols-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border-[1.25px] border-blueprint-line font-mono text-[12.5px]">
          <AnimatePresence initial={false}>
            {view.entries.map((entry) => (
              <motion.div
                key={entry.key}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "col-span-2 grid grid-cols-subgrid border-b border-blueprint-line last:border-b-0 transition-colors duration-300",
                  entry.changed ? "bg-[var(--fill-blue)] text-[var(--fill-blue-text)]" : "bg-card text-primary"
                )}
              >
                <span className="border-r border-blueprint-line px-3 py-1.5">{entry.key}</span>
                <span className="truncate px-3 py-1.5">{entry.value}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {view.truncated > 0 && (
        <p className="mt-1 font-mono text-[11px] text-blueprint-muted">+{view.truncated} more entries</p>
      )}
    </div>
  );
}

/** Any other object (a design problem's `self`, a Pair...). */
export function ObjectView({ view }: { view: ObjectViewModel }) {
  return (
    <div>
      <p className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-[13px] text-primary">{view.title}</span>
        <span className="text-technical-mono text-blueprint-muted">{view.typeName}</span>
      </p>
      {view.fields.length === 0 ? (
        <span className="font-mono text-[12px] text-blueprint-muted">no fields</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {view.fields.map((field) => (
            <span
              key={field.name}
              className={cn(
                "rounded-lg border-[1.25px] px-2.5 py-1 font-mono text-[12px] transition-colors duration-300",
                field.changed ? "border-transparent bg-[var(--fill-blue)] text-[var(--fill-blue-text)]" : "border-blueprint-line bg-card text-primary"
              )}
            >
              <span className={field.changed ? "opacity-80" : "text-blueprint-muted"}>{field.name}</span> {field.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
