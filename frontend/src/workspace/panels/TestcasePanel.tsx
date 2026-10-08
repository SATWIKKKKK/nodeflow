import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Plus, RotateCcw, SquarePen, X } from "lucide-react";
import type { PublicProblem } from "@nodeflow/shared";
import { cn } from "../../lib/cn";
import { fieldsOf, MAX_CASES, type Testcases } from "../testcases";
import { FieldLabel, ValueBox } from "./values";

/**
 * Testcase: the cases Run, Test and Submit use, one chip each.
 *
 * Every case reads like LeetCode's: one box per input, "nums =" above it.
 * Edit (or a click on any box) turns the boxes into fields in place, with the
 * same shape and type, so nothing jumps; + adds a case of the learner's own,
 * starting as a copy of the one on screen. Run traces the selected case, Test
 * runs them all, and Submit judges the learner's own after its hidden ones.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function TestcasePanel({
  problem,
  testcases,
  inputError
}: {
  problem: PublicProblem;
  testcases: Testcases;
  /** The server's word on the selected case, when its input does not fit the problem. */
  inputError?: string;
}) {
  const still = useReducedMotion();
  const { cases, selected, current } = testcases;
  const [editing, setEditing] = useState(false);
  const [focusField, setFocusField] = useState<string | null>(null);
  const fields = fieldsOf(problem);

  // A new problem opens on its cases as they are.
  useEffect(() => setEditing(false), [problem.id]);

  if (!current) return <span className="skeleton h-24 w-full" aria-hidden />;

  const edit = (field?: string) => {
    setEditing(true);
    setFocusField(field ?? fields[0]?.name ?? null);
  };

  const add = () => {
    testcases.add();
    edit();
  };

  const expected = testcases.expectedFor(current);
  const ownCount = cases.filter((entry) => entry.origin === "custom" || entry.edited).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <div role="tablist" aria-label="Test cases" className="flat-tabs flex flex-wrap items-center gap-1.5">
          <AnimatePresence initial={false} mode="popLayout">
            {cases.map((entry, at) => {
              const on = at === selected;
              const invalid = !entry.parsed.input;
              const mine = entry.origin === "custom" || entry.edited;
              return (
                <motion.div
                  key={entry.id}
                  layout={!still}
                  initial={still ? false : { opacity: 0, scale: 0.86 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={still ? { opacity: 0 } : { opacity: 0, scale: 0.86 }}
                  transition={{ duration: 0.22, ease: EASE }}
                  className="group relative"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => testcases.select(at)}
                    title={invalid ? "This case has an input to fix" : mine ? (entry.edited ? "A sample you edited" : "Your own case") : undefined}
                    className={cn(
                      "case-chip no-lift flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors",
                      cases.length > 1 && "group-hover:pr-6 group-focus-within:pr-6",
                      on ? "case-chip-on text-primary" : "text-blueprint-muted hover:bg-surface-hover hover:text-primary"
                    )}
                    style={{ minHeight: 0, transition: "padding 180ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms" }}
                  >
                    {(invalid || mine) && (
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: invalid ? "var(--verdict-fail)" : "var(--fill-blue)" }}
                      />
                    )}
                    Case {at + 1}
                  </button>
                  {cases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => testcases.remove(at)}
                      aria-label={`Remove case ${at + 1}`}
                      className="no-lift absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-blueprint-muted opacity-0 transition-opacity hover:text-[var(--verdict-fail)] focus-visible:opacity-100 group-hover:opacity-100"
                      style={{ minHeight: 0 }}
                    >
                      <X size={12} aria-hidden />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          {testcases.canAdd && (
            <motion.button
              layout={!still}
              type="button"
              onClick={add}
              aria-label="Add a case"
              title="Add a case (starts as a copy of this one)"
              className="no-lift flex h-7 w-7 items-center justify-center rounded-md text-blueprint-muted transition-colors hover:bg-surface-hover hover:text-primary"
              style={{ minHeight: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              <Plus size={15} aria-hidden />
            </motion.button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {!testcases.pristine && (
            <button
              type="button"
              onClick={() => {
                testcases.resetAll();
                setEditing(false);
              }}
              title="Put back the problem's own cases"
              className="no-lift flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-blueprint-muted transition-colors hover:bg-surface-hover hover:text-primary"
              style={{ minHeight: 0 }}
            >
              <RotateCcw size={12} aria-hidden /> Reset
            </button>
          )}
          <button
            type="button"
            onClick={() => (editing ? setEditing(false) : edit())}
            aria-pressed={editing}
            className={cn(
              "no-lift flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium transition-colors hover:bg-surface-hover",
              editing ? "text-primary" : "text-[var(--fill-blue)]"
            )}
            style={{ minHeight: 0 }}
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={editing ? "done" : "edit"}
                initial={still ? false : { opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={still ? { opacity: 0 } : { opacity: 0, y: -3 }}
                transition={{ duration: 0.14 }}
                className="flex items-center gap-1.5"
              >
                {editing ? <Check size={13} aria-hidden /> : <SquarePen size={13} aria-hidden />}
                {editing ? "Done" : "Edit cases"}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      <motion.div
        key={current.id}
        initial={still ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16 }}
        className="grid gap-4"
      >
        <div className="grid gap-2.5">
          {fields.map(({ name, hint }) => (
            <CaseField
              key={name}
              name={name}
              hint={hint}
              text={current.fields[name] ?? ""}
              error={current.parsed.errors[name]}
              editing={editing}
              autoFocus={editing && focusField === name}
              onEdit={() => edit(name)}
              onText={(text) => testcases.setField(selected, name, text)}
              onDone={() => setEditing(false)}
            />
          ))}
        </div>

        {inputError && current.parsed.input && (
          <p className="verdict-box-slow rounded-lg px-3 py-2.5 text-[13px] leading-relaxed" role="status">
            This input doesn&apos;t fit the problem: {inputError}
          </p>
        )}

        <div>
          <FieldLabel>
            Expected
            {current.edited && (
              <button
                type="button"
                onClick={() => testcases.resetCase(selected)}
                className="no-lift ml-2 inline-flex items-center gap-1 rounded px-1 text-[11.5px] font-medium text-[var(--fill-blue)] hover:underline"
                style={{ minHeight: 0 }}
              >
                Edited · put back the sample
              </button>
            )}
          </FieldLabel>
          {!expected ? (
            <p className="rounded-lg bg-surface-inset px-3 py-2.5 text-[13px] text-blueprint-muted">
              Fix the input above to see what it should give.
            </p>
          ) : expected.status === "loading" ? (
            <span className="skeleton block h-10 w-full rounded-lg" aria-label="Working out the expected answer" />
          ) : expected.status === "unavailable" ? (
            <p className="verdict-box-slow rounded-lg px-3 py-2.5 text-[13px] leading-relaxed">{expected.message}</p>
          ) : (
            <ValueBox value={expected.value} />
          )}
        </div>
      </motion.div>

      <p className="text-[11.5px] leading-relaxed text-blueprint-muted">
        Run traces case {selected + 1}. Test runs all {cases.length}.
        {ownCount > 0
          ? ` Submit judges ${ownCount === 1 ? "your case" : `your ${ownCount} cases`} too, after its hidden ones.`
          : cases.length < MAX_CASES
            ? " Add your own with +; Submit judges them too."
            : ""}
      </p>
    </div>
  );
}

/**
 * One input: a value in a hollow, or the same hollow as a text field. The
 * swap keeps the box, its padding and its type, and only fades the text, so
 * switching to editing reads as the value becoming editable, not as a new form.
 */
function CaseField({
  name,
  hint,
  text,
  error,
  editing,
  autoFocus,
  onEdit,
  onText,
  onDone
}: {
  name: string;
  hint: string;
  text: string;
  error?: string;
  editing: boolean;
  autoFocus: boolean;
  onEdit: () => void;
  onText: (text: string) => void;
  onDone: () => void;
}) {
  const still = useReducedMotion();
  const area = useRef<HTMLTextAreaElement>(null);

  // Grows with what is typed, up to a few lines, then scrolls.
  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 168)}px`;
  }, [text, editing]);

  useEffect(() => {
    if (!autoFocus || !area.current) return;
    const element = area.current;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, [autoFocus]);

  return (
    <motion.div layout={still ? false : "position"} transition={{ duration: 0.2, ease: EASE }}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11.5px] text-blueprint-muted">{name} =</p>
        <AnimatePresence>
          {editing && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="truncate text-[11px] text-blueprint-muted"
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      {editing ? (
        <textarea
          ref={area}
          value={text}
          rows={1}
          spellCheck={false}
          aria-label={`${name}, as JSON`}
          aria-invalid={Boolean(error)}
          onChange={(event) => onText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onDone();
            }
          }}
          className={cn(
            "case-field block w-full resize-none overflow-auto rounded-lg border bg-surface-inset px-3 py-2.5 font-mono text-[13px] leading-relaxed text-primary outline-none",
            error ? "border-red-500/70" : "border-transparent"
          )}
        />
      ) : (
        <button
          type="button"
          onClick={onEdit}
          title="Click to edit"
          className="case-value no-lift block w-full cursor-text rounded-lg bg-surface-inset px-3 py-2.5 text-left"
          style={{ minHeight: 0 }}
        >
          <span
            className={cn(
              "block max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[13px] leading-relaxed",
              error ? "text-[var(--verdict-fail)]" : "text-primary"
            )}
          >
            {text || "—"}
          </span>
        </button>
      )}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            initial={still ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={still ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="overflow-hidden pt-1 text-xs text-[var(--verdict-fail)]"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
