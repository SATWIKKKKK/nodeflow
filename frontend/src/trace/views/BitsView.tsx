import { cn } from "../../lib/cn";
import type { BitsViewModel } from "../model";

/**
 * Integers stacked as bit rows, aligned in columns so one column is one bit
 * position across every operand and the result. A bit that flipped this step is
 * filled; a row being weighed takes the comparing colour, exactly as a cell
 * does, so the same rules carry over from the array views.
 */
export function BitsView({ view }: { view: BitsViewModel }) {
  const places = Array.from({ length: view.width }, (_, column) => view.width - 1 - column);

  return (
    <div>
      <p className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-[13px] text-primary">{view.title}</span>
        <span className="text-technical-mono text-blueprint-muted">binary · {view.width} bits</span>
      </p>

      <div className="overflow-x-auto pb-1">
        <table className="border-collapse font-mono">
          <thead>
            <tr>
              <th />
              {places.map((place) => (
                <th key={place} className="px-0 pb-1 text-center text-[9.5px] font-normal text-blueprint-muted">
                  {place % 4 === 0 ? place : ""}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => (
              <tr key={row.name}>
                <th className="pr-2 text-right text-[11px] font-normal">
                  <span className={cn(row.comparing ? "text-[var(--compare)]" : "text-blueprint-muted")}>
                    {row.name}
                  </span>
                </th>
                {row.bits.map((bit, column) => (
                  <td key={column} className="p-0">
                    <span
                      className={cn(
                        "-ml-[1.25px] flex h-7 w-6 items-center justify-center border-[1.25px] text-[11.5px] transition-colors duration-300",
                        // Only a flipped bit takes colour. Tinting the whole
                        // row because it is being read drowns out the one or
                        // two bits that actually moved.
                        bit.flipped
                          ? "border-transparent bg-[var(--fill-blue)] text-[var(--fill-blue-text)]"
                          : bit.on
                            ? "border-blueprint-line bg-card text-primary"
                            : "border-blueprint-line bg-card text-blueprint-muted"
                      )}
                    >
                      {bit.on ? "1" : "0"}
                    </span>
                  </td>
                ))}
                <td className="p-0">
                  <span
                    className={cn(
                      "pl-3 text-[11.5px] tabular-nums",
                      row.changed ? "text-primary" : "text-blueprint-muted"
                    )}
                  >
                    = {row.value}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
