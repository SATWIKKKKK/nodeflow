import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicProblem, ValueKind } from "@nodeflow/shared";
import { api } from "../lib/api";
import { readTestcases, takeLegacyCustomInput, writeTestcases, type StoredCase } from "./persist";

/**
 * The Testcase tab's cases: the problem's visible cases to begin with, which
 * the learner can edit in place, plus cases of their own. Run traces the
 * selected one, Test runs them all, and Submit judges the learner's own after
 * everything else. Each input is typed as JSON in its own field, the way
 * LeetCode lays a case out.
 */

/** Test sends at most this many cases; the server agrees (MAX_OWN_CASES). */
export const MAX_CASES = 10;

const KIND_HINTS: Partial<Record<ValueKind, string>> = {
  int: "whole number",
  long: "whole number",
  double: "number",
  bool: "true or false",
  string: '"text in quotes"',
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

/** One field per input: the parameters in order (a design problem's script is two). */
export const fieldsOf = (problem: PublicProblem): Array<{ name: string; hint: string; kind?: ValueKind }> => {
  const signature = problem.signature;
  if (signature.design) {
    return [
      { name: "operations", hint: `["${signature.design.className}", ...method names]` },
      { name: "arguments", hint: "one list of arguments per operation" }
    ];
  }
  return [
    ...signature.parameters.map((parameter) => ({
      name: parameter.name,
      hint: KIND_HINTS[parameter.kind] ?? parameter.kind,
      kind: parameter.kind
    })),
    ...(signature.sharedTail ? [{ name: signature.sharedTail, hint: "shared tail values" }] : [])
  ];
};

/** JSON on one line, with a space after each comma so lists read like LeetCode's. */
export const showValue = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(showValue).join(", ")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .map(([key, item]) => `${JSON.stringify(key)}: ${showValue(item)}`)
      .join(", ")}}`;
  }
  return JSON.stringify(value) ?? "null";
};

export const toFields = (problem: PublicProblem, input: Record<string, unknown>) =>
  Object.fromEntries(fieldsOf(problem).map(({ name }) => [name, name in input ? showValue(input[name]) : ""]));

export interface ParsedCase {
  input?: Record<string, unknown>;
  /** Per field: why its text is not a value. */
  errors: Record<string, string>;
}

export const parseCase = (problem: PublicProblem, fields: Record<string, string>): ParsedCase => {
  const input: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const { name, hint, kind } of fieldsOf(problem)) {
    const text = (fields[name] ?? "").trim();
    if (!text) {
      errors[name] = "Enter a value.";
      continue;
    }
    try {
      input[name] = JSON.parse(text);
    } catch {
      // A bare word is the most common slip: in a string field it wants quotes;
      // anywhere else, say what the field holds.
      const bareWord = /^[A-Za-z_]\w*$/.test(text);
      errors[name] =
        bareWord && kind === "string"
          ? `Strings need quotes: "${text}"`
          : bareWord
            ? `Expected a ${hint}.`
            : "Not valid JSON. Check the brackets, commas and quotes.";
    }
  }
  return Object.keys(errors).length ? { errors } : { input, errors };
};

/** The problem's own visible cases, as the tab starts out. */
export const sampleCases = (problem: PublicProblem) =>
  (problem.visibleTestCases.length > 0
    ? problem.visibleTestCases.map((entry) => ({ input: entry.input, expected: entry.expectedOutput }))
    : problem.examples.map((example) => ({ input: example.input, expected: example.output }))
  ).slice(0, MAX_CASES);

const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const startingCases = (problem: PublicProblem): StoredCase[] =>
  sampleCases(problem).map((entry, at) => ({ id: `sample-${at}`, origin: "sample", fields: toFields(problem, entry.input) }));

export type ExpectedState =
  | { status: "known"; value: unknown }
  | { status: "loading" }
  | { status: "ready"; value: unknown }
  | { status: "unavailable"; message: string };

export interface CaseView {
  id: string;
  origin: "sample" | "custom";
  fields: Record<string, string>;
  parsed: ParsedCase;
  /** A sample whose inputs no longer match the problem's case. */
  edited: boolean;
  /** The answer this case should give, when it is known. */
  known?: { value: unknown };
}

export function useTestcases(problem: PublicProblem | null) {
  const [state, setState] = useState<{ owner: string; cases: StoredCase[]; selected: number }>({
    owner: "",
    cases: [],
    selected: 0
  });
  const problemId = problem?.id ?? "";
  const ready = Boolean(problem) && state.owner === problemId;

  // A problem brings back its own cases, or starts from its samples.
  useEffect(() => {
    if (!problem) return;
    const saved = readTestcases(problem.id);
    const names = fieldsOf(problem).map((field) => field.name);
    const fits = (entry: StoredCase) => names.every((name) => typeof entry.fields?.[name] === "string");
    let cases = saved?.cases?.filter(fits).slice(0, MAX_CASES) ?? [];
    if (!cases.length) cases = startingCases(problem);
    let selected = Math.min(Math.max(0, saved?.selected ?? 0), cases.length - 1);
    if (!saved) {
      // The old Custom Input box, switched on, becomes a case of its own.
      const legacy = takeLegacyCustomInput(problem.id);
      if (legacy && cases.length < MAX_CASES) {
        try {
          const input = JSON.parse(legacy) as Record<string, unknown>;
          cases = [...cases, { id: newId(), origin: "custom", fields: toFields(problem, input) }];
          selected = cases.length - 1;
        } catch {
          // Not JSON: nothing worth keeping.
        }
      }
      // Written at once, so the old box is only ever read the one time.
      writeTestcases(problem.id, { cases, selected });
    }
    setState({ owner: problem.id, cases, selected });
    // Only a new problem resets the tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId]);

  useEffect(() => {
    if (!ready) return;
    writeTestcases(state.owner, { cases: state.cases, selected: state.selected });
  }, [ready, state]);

  const samples = useMemo(() => (problem ? sampleCases(problem) : []), [problem]);

  const views: CaseView[] = useMemo(() => {
    if (!problem || !ready) return [];
    return state.cases.map((entry) => {
      const parsed = parseCase(problem, entry.fields);
      const key = parsed.input ? JSON.stringify(parsed.input) : null;
      const sample = key ? samples.find((candidate) => JSON.stringify(candidate.input) === key) : undefined;
      const original = entry.origin === "sample" ? samples[Number(entry.id.replace("sample-", ""))] : undefined;
      return {
        ...entry,
        parsed,
        edited: entry.origin === "sample" && (!original || JSON.stringify(original.input) !== key),
        known: sample ? { value: sample.expected } : undefined
      };
    });
  }, [problem, ready, state.cases, samples]);

  const selected = Math.min(state.selected, Math.max(0, views.length - 1));
  const current = views[selected];

  const select = useCallback((at: number) => setState((previous) => ({ ...previous, selected: at })), []);

  const setField = useCallback((at: number, name: string, text: string) => {
    setState((previous) => ({
      ...previous,
      cases: previous.cases.map((entry, index) =>
        index === at ? { ...entry, fields: { ...entry.fields, [name]: text } } : entry
      )
    }));
  }, []);

  /** A new case starts as a copy of the one on screen, as LeetCode's does. */
  const add = useCallback(() => {
    setState((previous) => {
      if (previous.cases.length >= MAX_CASES) return previous;
      const from = previous.cases[previous.selected] ?? previous.cases[0];
      const fields = from ? { ...from.fields } : {};
      const cases = [...previous.cases, { id: newId(), origin: "custom" as const, fields }];
      return { ...previous, cases, selected: cases.length - 1 };
    });
  }, []);

  /** A case from elsewhere (a failing judged input), selected so Run traces it next. */
  const addInput = useCallback(
    (input: Record<string, unknown>) => {
      if (!problem) return;
      setState((previous) => {
        if (previous.cases.length >= MAX_CASES) return previous;
        const cases = [...previous.cases, { id: newId(), origin: "custom" as const, fields: toFields(problem, input) }];
        return { ...previous, cases, selected: cases.length - 1 };
      });
    },
    [problem]
  );

  const remove = useCallback((at: number) => {
    setState((previous) => {
      if (previous.cases.length <= 1) return previous;
      const cases = previous.cases.filter((_, index) => index !== at);
      const selectedNow =
        previous.selected > at ? previous.selected - 1 : Math.min(previous.selected, cases.length - 1);
      return { ...previous, cases, selected: selectedNow };
    });
  }, []);

  /** A sample back to the problem's own inputs. */
  const resetCase = useCallback(
    (at: number) => {
      if (!problem) return;
      setState((previous) => ({
        ...previous,
        cases: previous.cases.map((entry, index) => {
          if (index !== at || entry.origin !== "sample") return entry;
          const original = samples[Number(entry.id.replace("sample-", ""))];
          return original ? { ...entry, fields: toFields(problem, original.input) } : entry;
        })
      }));
    },
    [problem, samples]
  );

  /** Every case back to the problem's samples; the learner's own go. */
  const resetAll = useCallback(() => {
    if (!problem) return;
    setState({ owner: problem.id, cases: startingCases(problem), selected: 0 });
  }, [problem]);

  // --- expected answers ------------------------------------------------------
  //
  // A sample's answer is part of the problem. Anything else is put to the
  // reference solution, once per distinct input, a moment after typing stops.

  const [answers, setAnswers] = useState<Record<string, ExpectedState>>({});
  const asked = useRef(new Set<string>());
  useEffect(() => {
    setAnswers({});
    asked.current = new Set();
  }, [problemId]);

  const expectedFor = useCallback(
    (view: CaseView | undefined): ExpectedState | undefined => {
      if (!view?.parsed.input) return undefined;
      if (view.known) return { status: "known", value: view.known.value };
      return answers[JSON.stringify(view.parsed.input)] ?? { status: "loading" };
    },
    [answers]
  );

  const currentKey = current?.parsed.input && !current.known ? JSON.stringify(current.parsed.input) : null;
  useEffect(() => {
    if (!problem || !currentKey || asked.current.has(currentKey)) return;
    const input = JSON.parse(currentKey) as Record<string, unknown>;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      asked.current.add(currentKey);
      api
        .expected(problem.id, input, controller.signal)
        .then((response) =>
          setAnswers((previous) => ({
            ...previous,
            [currentKey]: response.ok
              ? { status: "ready", value: response.expectedOutput }
              : { status: "unavailable", message: response.message ?? "The expected answer is unknown." }
          }))
        )
        .catch((error: unknown) => {
          asked.current.delete(currentKey);
          if (error instanceof DOMException && error.name === "AbortError") return;
          setAnswers((previous) => ({
            ...previous,
            [currentKey]: { status: "unavailable", message: "We couldn't work out the expected answer right now." }
          }));
        });
    }, 650);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [problem, currentKey]);

  /** What Test runs: every case, in order, once all of them parse. */
  const firstInvalid = views.findIndex((view) => !view.parsed.input);
  const allInputs = useMemo(
    () => (firstInvalid >= 0 ? null : views.map((view) => view.parsed.input!)),
    [views, firstInvalid]
  );
  /** What Submit adds to its own cases: the learner's, and samples they changed. */
  const ownInputs = useMemo(
    () => views.filter((view) => view.parsed.input && (view.origin === "custom" || view.edited) && !view.known).map((view) => view.parsed.input!),
    [views]
  );
  /** Whether Test can leave the cases to the server (nothing has been changed). */
  const pristine = views.length === samples.length && views.every((view) => view.origin === "sample" && !view.edited);

  return {
    ready,
    cases: views,
    selected,
    current,
    select,
    setField,
    add,
    addInput,
    remove,
    resetCase,
    resetAll,
    expectedFor,
    firstInvalid,
    allInputs,
    ownInputs,
    pristine,
    canAdd: views.length < MAX_CASES
  };
}

export type Testcases = ReturnType<typeof useTestcases>;
