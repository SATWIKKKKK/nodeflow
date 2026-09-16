import { cn } from "../../lib/cn";
import type { GridViewModel } from "../model";

/** 2D lists: matrices, DP tables, character boards. */
export function GridView({ view }: { view: GridViewModel }) {
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
                        title={names ? names.join(", ") : undefined}
                        className={cn(
                          "relative -ml-[1.25px] -mt-[1.25px] flex items-center justify-center border-[1.25px] transition-colors duration-300",
                          compact ? "h-8 min-w-8 px-1 text-[11px]" : "h-10 min-w-10 px-1.5 text-[12.5px]",
                          cell.changed
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-blueprint-line bg-card text-primary",
                          names && "z-10 outline-2 outline-offset-[-3px] outline-primary"
                        )}
                      >
                        {cell.label}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view.highlights.length > 0 && (
        <p className="mt-1 font-mono text-[11px] text-blueprint-muted">
          outlined: {view.highlights.map((entry) => `(${entry.names.join("")}) = (${entry.row}, ${entry.col})`).join(" · ")}
        </p>
      )}
    </div>
  );
}
