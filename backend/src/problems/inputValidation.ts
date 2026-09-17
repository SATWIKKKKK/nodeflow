import type { Problem, ProblemParameter, ValueKind } from "@nodeflow/shared";

/**
 * Checks a learner's custom input against a problem's signature before it
 * reaches the sandbox. A malformed input would otherwise surface as a crash
 * inside the harness and read as "your code raised", which it is not.
 */

const INT_MIN = -(2 ** 31);
const INT_MAX = 2 ** 31 - 1;
const MAX_ELEMENTS = 50_000;
const MAX_STRING = 100_000;
export const MAX_CUSTOM_INPUT_BYTES = 256_000;

class InputError extends Error {}

interface Budget {
  elements: number;
}

const fail = (path: string, message: string): never => {
  throw new InputError(`${path}: ${message}`);
};

const spend = (budget: Budget, count: number, path: string) => {
  budget.elements += count;
  if (budget.elements > MAX_ELEMENTS) fail(path, `too large (at most ${MAX_ELEMENTS.toLocaleString("en-US")} values in total)`);
};

const isInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

const checkInt = (value: unknown, path: string, wide = false) => {
  if (!isInt(value)) fail(path, `expected a whole number, got ${JSON.stringify(value)}`);
  const number = value as number;
  if (wide ? !Number.isSafeInteger(number) : number < INT_MIN || number > INT_MAX) {
    fail(path, wide ? "number is too large" : "number does not fit in a 32-bit int");
  }
};

const checkArray = (value: unknown, path: string, budget: Budget): unknown[] => {
  if (!Array.isArray(value)) fail(path, `expected a list, got ${JSON.stringify(value)?.slice(0, 40)}`);
  spend(budget, (value as unknown[]).length, path);
  return value as unknown[];
};

const checkString = (value: unknown, path: string) => {
  if (typeof value !== "string") fail(path, `expected a string, got ${JSON.stringify(value)?.slice(0, 40)}`);
  if ((value as string).length > MAX_STRING) fail(path, "string is too long");
};

const checkValue = (kind: ValueKind, value: unknown, path: string, budget: Budget): void => {
  switch (kind) {
    case "int":
      return checkInt(value, path);
    case "long":
      return checkInt(value, path, true);
    case "double":
      if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "expected a number");
      return;
    case "bool":
      if (typeof value !== "boolean") fail(path, "expected true or false");
      return;
    case "string":
      return checkString(value, path);
    case "array":
    case "linked_list":
    case "doubly_linked_list":
    case "y_list":
      checkArray(value, path, budget).forEach((item, index) => checkInt(item, `${path}[${index}]`));
      return;
    case "long_array":
      checkArray(value, path, budget).forEach((item, index) => checkInt(item, `${path}[${index}]`, true));
      return;
    case "double_array":
      checkArray(value, path, budget).forEach((item, index) => checkValue("double", item, `${path}[${index}]`, budget));
      return;
    case "bool_array":
      checkArray(value, path, budget).forEach((item, index) => checkValue("bool", item, `${path}[${index}]`, budget));
      return;
    case "string_array":
      checkArray(value, path, budget).forEach((item, index) => checkString(item, `${path}[${index}]`));
      return;
    case "matrix":
    case "graph":
    case "child_list":
      checkArray(value, path, budget).forEach((row, r) =>
        checkArray(row, `${path}[${r}]`, budget).forEach((item, c) => checkInt(item, `${path}[${r}][${c}]`))
      );
      return;
    case "char_matrix":
    case "string_matrix":
      checkArray(value, path, budget).forEach((row, r) =>
        checkArray(row, `${path}[${r}]`, budget).forEach((item, c) => {
          checkString(item, `${path}[${r}][${c}]`);
          if (kind === "char_matrix" && (item as string).length !== 1) fail(`${path}[${r}][${c}]`, "expected one character");
        })
      );
      return;
    case "tree":
      checkArray(value, path, budget).forEach((item, index) => {
        if (item !== null) checkInt(item, `${path}[${index}]`);
      });
      if (Array.isArray(value) && value.length > 0 && value[0] === null) fail(path, "the root cannot be null; use [] for an empty tree");
      return;
    case "cyclic_list": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        fail(path, 'expected {"values": [...], "pos": n}');
      }
      const spec = value as { values?: unknown; pos?: unknown };
      checkArray(spec.values, `${path}.values`, budget).forEach((item, index) => checkInt(item, `${path}.values[${index}]`));
      if (spec.pos !== undefined) checkInt(spec.pos, `${path}.pos`);
      return;
    }
    case "random_list": {
      const pairs = checkArray(value, path, budget);
      pairs.forEach((pair, index) => {
        const entry = checkArray(pair, `${path}[${index}]`, budget);
        if (entry.length < 1 || entry.length > 2) fail(`${path}[${index}]`, "expected [value, randomIndex or null]");
        checkInt(entry[0], `${path}[${index}][0]`);
        const target = entry[1];
        if (target !== undefined && target !== null) {
          checkInt(target, `${path}[${index}][1]`);
          if ((target as number) < 0 || (target as number) >= pairs.length) fail(`${path}[${index}][1]`, "random index is out of range");
        }
      });
      return;
    }
    default:
      fail(path, `inputs of kind ${kind} cannot be set by hand`);
  }
};

const checkParameters = (parameters: ProblemParameter[], values: unknown[], path: string, budget: Budget) => {
  if (values.length !== parameters.length) {
    fail(path, `expected ${parameters.length} argument${parameters.length === 1 ? "" : "s"}, got ${values.length}`);
  }
  parameters.forEach((parameter, index) => checkValue(parameter.kind, values[index], `${path} ${parameter.name}`, budget));
};

/** Returns a readable message when the input does not fit the problem, otherwise null. */
export const validateCustomInput = (problem: Problem, input: unknown): string | null => {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      fail("input", "expected a JSON object");
    }
    if (JSON.stringify(input).length > MAX_CUSTOM_INPUT_BYTES) fail("input", "is too large");
    const record = input as Record<string, unknown>;
    const budget: Budget = { elements: 0 };
    const { signature } = problem;

    if (signature.design) {
      const design = signature.design;
      const operations = checkArray(record.operations, "operations", budget);
      const argumentsList = checkArray(record.arguments, "arguments", budget);
      if (operations.length !== argumentsList.length) fail("input", "operations and arguments must be the same length");
      if (operations.length === 0 || operations[0] !== design.className) {
        fail("operations[0]", `the first operation must be "${design.className}"`);
      }
      const methods = new Map(design.methods.map((method) => [method.name, method]));
      operations.forEach((operation, index) => {
        const path = `operations[${index}]`;
        checkString(operation, path);
        const args = checkArray(argumentsList[index], `arguments[${index}]`, budget);
        if (operation === design.className) {
          if (index !== 0) fail(path, `"${design.className}" can only be the first operation`);
          checkParameters(design.constructorParameters, args, `arguments[${index}]`, budget);
          return;
        }
        const method = methods.get(operation as string);
        if (!method) fail(path, `unknown operation "${String(operation)}"`);
        checkParameters(method!.parameters, args, `arguments[${index}]`, budget);
      });
      return null;
    }

    for (const parameter of signature.parameters) {
      if (!(parameter.name in record)) fail(parameter.name, "is missing");
      checkValue(parameter.kind, record[parameter.name], parameter.name, budget);
    }
    if (signature.sharedTail) {
      const tail = record[signature.sharedTail];
      if (tail === undefined) fail(signature.sharedTail, "is missing");
      checkValue("array", tail, signature.sharedTail, budget);
    }
    const allowed = new Set([...signature.parameters.map((parameter) => parameter.name), signature.sharedTail].filter(Boolean));
    const extra = Object.keys(record).filter((key) => !allowed.has(key));
    if (extra.length) fail(extra[0], "is not an input of this problem");
    return null;
  } catch (error) {
    if (error instanceof InputError) return error.message;
    throw error;
  }
};
