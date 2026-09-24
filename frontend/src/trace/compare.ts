import type { SerializedValue } from "@nodeflow/shared";

/**
 * Which cells the line about to run compares.
 *
 * A comparison leaves no trace of its own: the tracer records the state after a
 * line, never that `nums[j] > nums[j + 1]` was evaluated. The line's own source
 * does name both cells, though, and the step already carries the variables its
 * index expressions are written in — so reading the line is enough to light the
 * pair before the decision animates, with no new tracer capability in any of the
 * three languages.
 *
 * Nothing here executes user code. Index expressions are parsed as sums of
 * products over integer variables and literals; anything else is skipped, so an
 * expression this cannot understand simply goes unhighlighted.
 */

const sanitize = (line: string) =>
  line
    // Quoted text can hold anything, including brackets and operators.
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/#.*$/, "")
    // Shifts, member access and lambdas are not comparisons.
    .replace(/<<|>>|->|=>/g, " ");

/**
 * Reads one cell of a one-dimensional array by name. DP indexes through other
 * arrays constantly — `dp[i - 1][w - weights[i - 1]]` — so without this the
 * arrows would quietly vanish on exactly the problems that need them most.
 */
export type CellLookup = (name: string, index: number) => number | undefined;

/**
 * How long a named collection is, so a subscript counted from the end can be
 * turned into a real position. `stack[-1]` is how the last element is written
 * in Python, and a monotonic stack is nothing but that expression.
 */
export type CellLength = (name: string) => number | undefined;

/** A position counted from the end resolved against the collection's length. */
const settle = (name: string, index: number, lengthOf?: CellLength): number | undefined => {
  if (index >= 0) return index;
  const length = lengthOf?.(name);
  if (length === undefined) return undefined;
  const at = length + index;
  return at >= 0 ? at : undefined;
};

const resolve = (token: string, variables: Record<string, SerializedValue>): number | undefined => {
  if (/^\d+$/.test(token)) return Number(token);
  if (!/^[A-Za-z_]\w*$/.test(token)) return undefined;
  const value = variables[token];
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
};

/** Spans of `[...]` directly after `at`, bracket-matched so they may nest. */
const subscriptsAt = (text: string, start: number): { parts: string[]; end: number } => {
  const parts: string[] = [];
  let at = start;

  while (parts.length < 2) {
    while (text[at] === " ") at += 1;
    if (text[at] !== "[") break;

    let depth = 0;
    let scan = at;
    for (; scan < text.length; scan += 1) {
      if (text[scan] === "[") depth += 1;
      else if (text[scan] === "]") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) break;

    parts.push(text.slice(at + 1, scan));
    at = scan + 1;
  }

  return { parts, end: at };
};

/** `j`, `j + 1`, `n - i - 1`, `2 * i + 1`, `w - weights[i - 1]`. */
const evaluate = (
  expression: string,
  variables: Record<string, SerializedValue>,
  lookup?: CellLookup,
  lengthOf?: CellLength
): number | undefined => {
  let text = expression.trim();
  if (!text) return undefined;

  // Fold any inner array read down to its value before the arithmetic runs.
  for (let pass = 0; pass < 4 && /\[/.test(text); pass += 1) {
    const name = /[A-Za-z_]\w*(?=\s*\[)/.exec(text);
    if (!name || !lookup) return undefined;

    const { parts, end } = subscriptsAt(text, name.index + name[0].length);
    if (parts.length !== 1) return undefined;

    const raw = evaluate(parts[0], variables, lookup, lengthOf);
    const index = raw === undefined ? undefined : settle(name[0], raw, lengthOf);
    if (index === undefined) return undefined;

    const value = lookup(name[0], index);
    // A negative value would turn `w - x` into `w - -3`, which the term parser
    // below cannot read; such an index is not a real cell reference anyway.
    if (value === undefined || value < 0) return undefined;

    text = text.slice(0, name.index) + String(value) + text.slice(end);
  }

  // Parentheses and calls remain out of scope on purpose.
  if (/[()[\]]/.test(text)) return undefined;

  const terms = text.match(/[+-]?[^+-]+/g);
  if (!terms) return undefined;

  let total = 0;
  for (const term of terms) {
    const trimmed = term.trim();
    const body = trimmed.replace(/^[+-]\s*/, "");
    if (!body) return undefined;

    let product = 1;
    for (const factor of body.split("*")) {
      const value = resolve(factor.trim(), variables);
      if (value === undefined) return undefined;
      product *= value;
    }
    total += (trimmed.startsWith("-") ? -1 : 1) * product;
  }

  return Number.isInteger(total) ? total : undefined;
};

/** One subscript. `col` is set only for a two-dimensional reference. */
export interface CellRef {
  row: number;
  col?: number;
}

type RefMap = Map<string, CellRef[]>;

export interface LineSide {
  /** Subscripted references: `arr[i]`, `grid[i][j]`. */
  cells: RefMap;
  /**
   * Bare variable names the line mentions. A node is named rather than
   * indexed — `if a.val <= b.val` weighs two list nodes — so this is what
   * lets a figure light up the way a row of cells does.
   */
  names: Set<string>;
  /**
   * `owner.field` accesses. Which field matters: consulting `node.val` is a
   * visit, while `walk(node.left)` merely passes the node along. Without the
   * distinction a post-order traversal would be numbered in pre-order.
   */
  attrs: Array<{ owner: string; field: string }>;
}

export interface LineCells {
  /** What this line weighs against something. */
  compared: LineSide;
  /** What it only looks at. A read is not a write, and shows differently. */
  read: LineSide;
  /** What it assigns to — the target a dependency arrow points at. */
  written: LineSide;
}

const noSide = (): LineSide => ({ cells: new Map(), names: new Set(), attrs: [] });
const EMPTY: LineCells = { compared: noSide(), read: noSide(), written: noSide() };

/**
 * Identifiers standing on their own: not an attribute after a dot, not a call,
 * and not a subscript base, each of which is already accounted for elsewhere.
 */
const collectNames = (text: string): Set<string> => {
  const names = new Set<string>();
  for (const [, dot, name, opener] of text.matchAll(/(\.?)([A-Za-z_]\w*)\s*([([]?)/g)) {
    if (dot === "." || opener === "(" || opener === "[") continue;
    names.add(name);
  }
  return names;
};

const collectAttrs = (text: string): Array<{ owner: string; field: string }> => {
  const attrs: Array<{ owner: string; field: string }> = [];
  for (const [, owner, field] of text.matchAll(/([A-Za-z_]\w*)\s*\.\s*([A-Za-z_]\w*)/g)) {
    attrs.push({ owner, field });
  }
  return attrs;
};

const collect = (
  text: string,
  variables: Record<string, SerializedValue>,
  lookup?: CellLookup,
  lengthOf?: CellLength
): RefMap => {
  const found: RefMap = new Map();
  const names = /[A-Za-z_]\w*/g;

  // Not advanced past a match's subscripts, so an array used to index another
  // — the `weights` in `dp[i][w - weights[i - 1]]` — is still found in its turn.
  for (let name = names.exec(text); name; name = names.exec(text)) {
    const { parts } = subscriptsAt(text, name.index + name[0].length);
    if (parts.length === 0) continue;

    const counted = evaluate(parts[0], variables, lookup, lengthOf);
    const row = counted === undefined ? undefined : settle(name[0], counted, lengthOf);
    if (row === undefined) continue;

    let col: number | undefined;
    if (parts.length === 2) {
      // A column counted from the end would need the row's own length, which
      // is a lookup this parser does not have. `grid[i][-1]` is left alone.
      col = evaluate(parts[1], variables, lookup, lengthOf);
      // A second subscript that cannot be resolved makes the whole reference
      // ambiguous — `grid[i][?]` is not the same claim as `grid[i]`.
      if (col === undefined || col < 0) continue;
    }

    const refs = found.get(name[0]) ?? [];
    if (!refs.some((ref) => ref.row === row && ref.col === col)) refs.push({ row, col });
    found.set(name[0], refs);
  }

  return found;
};

/**
 * Where an assignment's left side ends: the first `=` that is not part of a
 * comparison. `+=` and friends split one character late, which is harmless
 * because the operator never sits inside a subscript.
 */
const assignmentAt = (text: string): number => {
  for (let at = 0; at < text.length; at += 1) {
    if (text[at] !== "=") continue;
    if (text[at + 1] === "=") continue;
    if (/[!<>=]/.test(text[at - 1] ?? "")) continue;
    return at;
  }
  return -1;
};

/** What the line about to run does to the cells it names. */
export function lineCells(
  source: string | undefined,
  line: number | undefined,
  variables: Record<string, SerializedValue>,
  lookup?: CellLookup,
  lengthOf?: CellLength
): LineCells {
  if (!source || !line) return EMPTY;

  const raw = source.split("\n")[line - 1];
  if (!raw) return EMPTY;

  const text = sanitize(raw);
  const side = (part: string): LineSide => ({
    cells: collect(part, variables, lookup, lengthOf),
    names: collectNames(part),
    attrs: collectAttrs(part)
  });

  // A comparison outranks a read: being weighed is the more specific news.
  if (/(<=|>=|==|!=|<|>)/.test(text)) {
    return { compared: side(text), read: noSide(), written: noSide() };
  }

  // Only the right-hand side is read. The left-hand side is a write, which the
  // heap diff already reports once it has happened — but naming it is what lets
  // a dependency arrow know where to point.
  const split = assignmentAt(text);
  if (split === -1) return { compared: noSide(), read: side(text), written: noSide() };

  return { compared: noSide(), read: side(text.slice(split + 1)), written: side(text.slice(0, split)) };
}
