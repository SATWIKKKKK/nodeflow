import { useEffect, useMemo, useState } from "react";
import { SquarePen } from "lucide-react";
import type { PublicProblem } from "@nodeflow/shared";
import { cn } from "../../lib/cn";
import { FieldLabel, InputFields, ValueBox } from "./values";

/**
 * Testcase: the cases Test runs, one chip each, with the inputs laid out the
 * way the function receives them. Any of them can be taken into Custom Input
 * to be changed and run, which is how LeetCode's editable cases work here.
 */
export function TestcasePanel({
  problem,
  onUseAsInput
}: {
  problem: PublicProblem;
  onUseAsInput: (input: Record<string, unknown>) => void;
}) {
  const cases = useMemo(
    () =>
      problem.visibleTestCases.length > 0
        ? problem.visibleTestCases.map((entry) => ({ id: entry.id, input: entry.input, expected: entry.expectedOutput }))
        : problem.examples.map((example, at) => ({ id: `example-${at}`, input: example.input, expected: example.output })),
    [problem]
  );
  const [selected, setSelected] = useState(0);
  useEffect(() => setSelected(0), [problem.id]);
  const current = cases[Math.min(selected, cases.length - 1)];

  if (!current) {
    return <p className="text-[13px] text-blueprint-muted">This problem has no visible cases.</p>;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <div role="tablist" aria-label="Visible cases" className="flat-tabs flex flex-wrap gap-1.5">
          {cases.map((entry, at) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={at === selected}
              onClick={() => setSelected(at)}
              className={cn(
                "case-chip no-lift flex h-7 items-center rounded-md px-2.5 text-[12.5px] font-medium transition-colors",
                at === selected ? "case-chip-on text-primary" : "text-blueprint-muted hover:bg-surface-hover hover:text-primary"
              )}
              style={{ minHeight: 0 }}
            >
              Case {at + 1}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onUseAsInput(current.input)}
          className="no-lift ml-auto flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-[var(--fill-blue)] transition-colors hover:bg-surface-hover"
          style={{ minHeight: 0 }}
        >
          <SquarePen size={13} aria-hidden /> Edit as custom input
        </button>
      </div>
      <div>
        <FieldLabel>Input</FieldLabel>
        <InputFields input={current.input} signature={problem.signature} />
      </div>
      <div>
        <FieldLabel>Expected</FieldLabel>
        <ValueBox value={current.expected} />
      </div>
    </div>
  );
}
