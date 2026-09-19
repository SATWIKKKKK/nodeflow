import { useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import type { PublicProblem, ValueKind } from "@nodeflow/shared";
import { cn } from "../lib/cn";
import { button } from "../components/ui";

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
  const [open, setOpen] = useState(enabled);
  const signature = problem.signature;
  const hint = signature.design
    ? `{"operations": ["${signature.design.className}", ...], "arguments": [[...], ...]}`
    : [
        ...signature.parameters.map((parameter) => `${parameter.name}: ${KIND_HINTS[parameter.kind] ?? parameter.kind}`),
        ...(signature.sharedTail ? [`${signature.sharedTail}: shared tail values`] : [])
      ].join(" · ");

  return (
    <section aria-label="Custom input" className="surface-frame shrink-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="custom-input-body"
          className="no-lift flex items-center gap-2 text-ui-label text-blueprint-muted hover:text-primary"
          style={{ minHeight: 0 }}
        >
          <ChevronDown size={15} aria-hidden className={cn("transition-transform duration-300", open && "rotate-180")} />
          Custom input
        </button>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-blueprint-muted">
          <span>Use for Run and preview</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => {
              onEnabled(!enabled);
              if (!enabled) setOpen(true);
            }}
            className={cn(
              "no-lift relative h-5 w-9 rounded-full border transition-colors",
              enabled ? "border-transparent bg-[var(--fill-blue)]" : "border-blueprint-line bg-surface-inset"
            )}
            style={{ minHeight: 0 }}
          >
            <span
              className={cn(
                "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-[left,background-color]",
                enabled ? "left-[18px] bg-white" : "left-0.5 bg-blueprint-muted"
              )}
            />
          </button>
        </label>
      </div>

      {open && (
        <div id="custom-input-body" className="border-t border-blueprint-line px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {problem.examples.slice(0, 3).map((example, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onText(pretty(example.input))}
                className={cn(button.outlineSm, "px-3 py-1.5 text-[11px]")}
                style={{ minHeight: 0 }}
              >
                Example {index + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onText(pretty(problem.defaultInput))}
              className={cn(button.ghost, "no-lift ml-auto px-2 py-1.5 text-[11px]")}
              style={{ minHeight: 0 }}
              title="Back to the default input"
            >
              <RotateCcw size={12} aria-hidden /> Reset
            </button>
          </div>
          <textarea
            value={text}
            onChange={(event) => onText(event.target.value)}
            spellCheck={false}
            aria-label="Custom input as JSON"
            aria-invalid={Boolean(error)}
            rows={Math.min(12, Math.max(4, text.split("\n").length))}
            className={cn(
              "w-full resize-y rounded-xl border bg-surface-inset px-3 py-2.5 font-mono text-xs leading-relaxed text-primary outline-none focus:border-primary",
              error ? "border-red-500/70" : "border-blueprint-line"
            )}
          />
          {error ? (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p>
          ) : (
            <p className="mt-2 break-words font-mono text-[11px] text-blueprint-muted">{hint}</p>
          )}
        </div>
      )}
    </section>
  );
}
