import type { ReactNode } from "react";
import type { ProblemSignature } from "@nodeflow/shared";
import { cn } from "../../lib/cn";

/** A value as the learner would type it: JSON, on one line. */
export const show = (value: unknown) => {
  if (value === undefined) return "—";
  return JSON.stringify(value) ?? String(value);
};

/** The case's inputs in the order the function takes them, then anything else. */
export const orderedInput = (input: Record<string, unknown>, signature?: ProblemSignature) => {
  const names = signature?.parameters.map((parameter) => parameter.name) ?? [];
  const known = names.filter((name) => name in input);
  const rest = Object.keys(input).filter((name) => !known.includes(name));
  return [...known, ...rest].map((name) => [name, input[name]] as const);
};

export function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-xs font-medium text-blueprint-muted">{children}</p>;
}

/**
 * One value in a recessed box, LeetCode's way: a small label above, the
 * value in mono below, wrapping rather than scrolling sideways.
 */
export function ValueBox({
  name,
  value,
  tone,
  raw
}: {
  /** Shown as "name =" above the value, for a parameter. */
  name?: string;
  value: unknown;
  tone?: "wrong";
  /** Text to show as it is, for stdout. */
  raw?: boolean;
}) {
  return (
    <div className="value-box rounded-lg bg-surface-inset px-3 py-2.5">
      {name && <p className="mb-1 font-mono text-[11.5px] text-blueprint-muted">{name} =</p>}
      <pre
        className={cn(
          "max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[13px] leading-relaxed",
          tone === "wrong" ? "text-[var(--verdict-fail)]" : "text-primary"
        )}
      >
        {raw ? String(value) : show(value)}
      </pre>
    </div>
  );
}

export function InputFields({ input, signature }: { input: Record<string, unknown>; signature?: ProblemSignature }) {
  return (
    <div className="grid gap-2">
      {orderedInput(input, signature).map(([name, value]) => (
        <ValueBox key={name} name={name} value={value} />
      ))}
    </div>
  );
}
