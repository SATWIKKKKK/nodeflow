import { RotateCcw } from "lucide-react";
import type { PublicProblem, ValueKind } from "@nodeflow/shared";
import { cn } from "../lib/cn";

const KIND_HINTS: Partial<Record<ValueKind, string>> = {
  int: "whole number",
  long: "whole number",
  double: "number",
  bool: "true or false",
  string: "string",
  array: "list of numbers",
  long_array: "list of numbers",
  double_array: "list of numbers",
  bool_array: "list of true/false",
  string_array: "list of strings",
  matrix: "list of rows",
  graph: "adjacency list",
  char_matrix: "rows of one-character strings",
  string_matrix: "rows of strings",
  linked_list: "list values in order",
  doubly_linked_list: "list values in order",
  y_list: "values before the shared tail",
  cyclic_list: '{"values": [...], "pos": index or -1}',
  random_list: "[[value, randomIndex or null], ...]",
  child_list: "columns, each top to bottom",
  tree: "level order, null for gaps"
};

export const pretty = (value: unknown) => {
  const text = JSON.stringify(value, null, 2) ?? "{}";
  // Keep short number lists on one line so inputs stay readable.
  return text.replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_match, inner: string) => `[${inner.replace(/\s*\n\s*/g, " ")}]`);
};

/** Parses the textarea; returns the object or a readable error. */
export const parseCustomInput = (text: string): { value?: Record<string, unknown>; error?: string } => {
  if (!text.trim()) return { error: "Enter a JSON object." };
  try {
    const value = JSON.parse(text) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { error: "The input must be a JSON object, like the examples." };
    }
    return { value: value as Record<string, unknown> };
  } catch (error) {
    return { error: `Not valid JSON: ${error instanceof Error ? error.message : "check the brackets and quotes"}` };
  }
};

/**
 * Custom Input: the learner's own case, as JSON. When it is switched on, Run
 * and the live trace use it instead of the first example, and Run checks the
 * answer against the reference solution.
 */
export function CustomInputPanel({
  problem,
  enabled,
  text,
  error,
  onEnabled,
  onText
}: {
  problem: PublicProblem;
  enabled: boolean;
  text: string;
  error: string;
  onEnabled: (enabled: boolean) => void;
  onText: (text: string) => void;
}) {
  const signature = problem.signature;
  const hint = signature.design
    ? `{"operations": ["${signature.design.className}", ...], "arguments": [[...], ...]}`
    : [
        ...signature.parameters.map((parameter) => `${parameter.name}: ${KIND_HINTS[parameter.kind] ?? parameter.kind}`),
        ...(signature.sharedTail ? [`${signature.sharedTail}: shared tail values`] : [])
      ].join(" · ");

  // Which example the box currently holds, compared by value so reformatting
  // the JSON by hand does not lose the highlight.
  const parsed = parseCustomInput(text).value;
  const current = parsed ? JSON.stringify(parsed) : null;
  const showing = problem.examples.findIndex((example) => JSON.stringify(example.input) === current);

  return (
    <div className="flex h-full min-h-[220px] flex-col gap-3 lg:min-h-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-primary">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onEnabled(!enabled)}
            className={cn(
              "no-lift relative h-5 w-9 shrink-0 rounded-full border transition-colors",
              enabled ? "border-transparent bg-[var(--fill-blue)]" : "border-blueprint-line bg-surface-inset"
            )}
            style={{ minHeight: 0 }}
          >
            <span
              className={cn(
                "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-[left,background-color] duration-200",
                enabled ? "left-[18px] bg-white" : "left-0.5 bg-blueprint-muted"
              )}
            />
          </button>
          Use for Run and the live trace
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {problem.examples.slice(0, 3).map((example, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onText(pretty(example.input))}
              aria-pressed={showing === index}
              className={cn(
                "case-chip no-lift flex h-7 items-center rounded-md px-2.5 text-[12.5px] font-medium transition-colors",
                showing === index ? "case-chip-on text-primary" : "text-blueprint-muted hover:bg-surface-hover hover:text-primary"
              )}
              style={{ minHeight: 0 }}
            >
              Example {index + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onText(pretty(problem.defaultInput))}
            className="no-lift flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-blueprint-muted transition-colors hover:bg-surface-hover hover:text-primary"
            style={{ minHeight: 0 }}
            title="Back to the default input"
          >
            <RotateCcw size={12} aria-hidden /> Reset
          </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(event) => onText(event.target.value)}
        spellCheck={false}
        aria-label="Custom input as JSON"
        aria-invalid={Boolean(error)}
        className={cn(
          "min-h-[72px] w-full flex-1 resize-none rounded-lg border bg-surface-inset px-3 py-2.5 font-mono text-[13px] leading-relaxed text-primary outline-none",
          error ? "border-red-500/70" : enabled ? "border-[var(--fill-blue)]" : "border-blueprint-line"
        )}
      />
      {error ? (
        <p className="text-xs text-[var(--verdict-fail)]">{error}</p>
      ) : (
        <p className="break-words font-mono text-[11.5px] text-blueprint-muted">{hint}</p>
      )}
    </div>
  );
}
