/**
 * Problem variants: one word of a statement changed, and everything that
 * follows from it worked out again.
 *
 * A learner reading "two nondecreasing lists" may reasonably wonder what the
 * same exercise looks like nonincreasing. Changing the word is the easy part.
 * Every expected answer in the problem changes with it, and that is where this
 * has to be careful: if a model is asked what the new answers are, it tells us,
 * and nobody has checked. A learner would then write correct code, fail, and
 * have no way of knowing the platform was wrong.
 *
 * So the model is never asked for an answer. It is asked for a *statement* and
 * a *solution*, and the solution is then run in the same sandbox everything
 * else runs in. The machine works out the answers. A variant whose solution
 * will not run is refused rather than published.
 */

import { randomUUID } from "node:crypto";
import type { Language, Problem, ProblemTestCase, PublicProblem, ValueKind } from "@nodeflow/shared";
import { runProblemCase } from "../execution/service.js";
import { sql, ensureSchema, usingDatabase } from "../store/db.js";
import { buildStarterCodeByLanguage } from "./starterCode.js";
import { validateCustomInput } from "./inputValidation.js";

/**
 * Kinds a variant may ask for.
 *
 * Every one of these can be written as JSON, which is what a test input is.
 * `void` and the node-value kinds are deliberately absent: they cannot be set
 * by hand, so a variant that wanted one could never be given a case to run.
 */
const INPUT_KINDS: ValueKind[] = [
  "int", "long", "double", "bool", "string",
  "array", "long_array", "double_array", "bool_array", "string_array",
  "matrix", "graph", "char_matrix", "string_matrix",
  "linked_list", "doubly_linked_list", "cyclic_list", "y_list", "random_list", "child_list",
  "tree"
];
const RETURN_KINDS: ValueKind[] = [...INPUT_KINDS, "void"];

const ENDPOINT = "https://api.deepseek.com/chat/completions";
// The chat model in JSON mode. The reasoner spent its whole token budget
// thinking and came back empty or cut off mid-JSON, which reached the learner
// as "the assistant could not answer"; the run in the sandbox is what checks
// the answers either way.
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 45_000;
const MAX_TOKENS = 4000;

export const MAX_TERM = 60;

const apiKey = () => process.env.DEEPSEEK_API_KEY ?? "";
export const variantsEnabled = () => apiKey().length > 0;

/** What the server is doing, as it does it. */
export type VariantStage =
  | { stage: "rewriting" }
  | { stage: "checking" }
  | { stage: "running"; done: number; of: number };

export type VariantOutcome =
  | { status: "invalid"; reason: string }
  | { status: "exists"; problemId: string; title: string; number: number }
  | { status: "created"; problem: PublicProblem; number: number };

/** Punctuation and spacing carry no meaning for "is this the same problem". */
const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const distinctTitle = (sourceTitle: string, written: string | undefined, replacement: string) => {
  const candidate = written?.trim();
  if (candidate && normalise(candidate) !== normalise(sourceTitle)) return candidate;
  return `${sourceTitle} (${replacement})`;
};

/** A name the three harnesses can all declare. */
const looksLikeIdentifier = (name: string | undefined) =>
  typeof name === "string" && /^[a-z][a-z0-9_]{1,48}$/.test(name.trim());

/**
 * A new name, worked out rather than asked for.
 *
 * The model is told to rename and usually does, but "usually" is not a
 * guarantee and a variant that keeps its parent's name is a second problem
 * answering to the same call. Where the changed word appears in the name it is
 * swapped there too — `count_odds` becomes `count_evens` — and where it does
 * not, the replacement is appended, which is ugly but never wrong and never
 * collides.
 */
const derivedName = (original: string, term: string, replacement: string) => {
  const slug = replacement
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  if (!slug) return original;

  const swapped = original.split(term.toLowerCase()).join(slug);
  if (swapped !== original && looksLikeIdentifier(swapped)) return swapped;
  const appended = `${original}_${slug}`.slice(0, 48);
  return looksLikeIdentifier(appended) ? appended : original;
};

const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

// ---------------------------------------------------------------- the store

/**
 * Variants live in the database rather than in the seed file, because they are
 * written at runtime and the seed file is code. They are held in memory too, so
 * a lookup costs nothing and the app keeps working if the database is absent —
 * in that case a variant lasts as long as the process does, which is the
 * honest degradation rather than a crash.
 */
const created: Problem[] = [];
const numbers = new Map<string, number>();

/**
 * What was asked for, not what came back.
 *
 * Matching on the rewritten statement alone is not enough: a model asked the
 * same question twice words it differently each time, so the same change
 * requested again would miss and be rewritten from scratch. The request itself
 * — this problem, this word, this replacement — is exact, and answers
 * instantly without spending anything.
 */
const asked = new Map<string, string>();
const askKey = (sourceId: string, term: string, replacement: string) =>
  `${sourceId}|${term.toLowerCase()}|${replacement.toLowerCase()}`;

/**
 * Where each variant came from, and the change that made it.
 *
 * Without this, undoing a change makes a third problem. Asking for
 * `sorted -> unsorted` and then `unsorted -> sorted` is two different
 * requests on two different problems, so neither the request key nor the
 * statement matches — and the statements never will, because a model reworded
 * to the same meaning does not word it the same way twice. The lineage is
 * exact where the text is not: a change that inverts the one just made is a
 * way back, not a new problem.
 */
const lineage = new Map<string, { sourceId: string; term: string; replacement: string }>();

/**
 * Variants are shared between server instances through the database.
 *
 * On a serverless host each request can land on a different instance, and an
 * instance only knows the variants it made itself or read at start-up. Read
 * once and never again, a variant made on one instance was "Problem not
 * found" on the next request that landed elsewhere: the learner was sent to a
 * problem that, for that instance, did not exist, and every later change to
 * it failed the same way. So the list is reread when it is more than a few
 * seconds old, and a single unknown id is always looked up before anyone is
 * told it does not exist.
 */
let loadedAt = 0;
const REFRESH_MS = 15_000;

interface VariantRow {
  id: string;
  number: number;
  source_id: string;
  term: string;
  replacement: string;
  data: Problem;
}

const remember = (row: VariantRow) => {
  asked.set(askKey(row.source_id, row.term, row.replacement), row.id);
  lineage.set(row.id, { sourceId: row.source_id, term: row.term, replacement: row.replacement });
  numbers.set(row.id, row.number);
  if (!created.some((problem) => problem.id === row.id)) created.push(row.data);
};

const ensureVariantTable = async () => {
  if (!sql) return;
  await ensureSchema();
  await sql`create table if not exists noesis_problem_variants (
    id text primary key,
    number integer not null,
    source_id text not null,
    term text not null,
    replacement text not null,
    data jsonb not null,
    created_at timestamptz not null default now()
  )`;
};

export const loadVariants = async (force = false): Promise<void> => {
  if (!usingDatabase()) return;
  if (!force && loadedAt && Date.now() - loadedAt < REFRESH_MS) return;
  try {
    await ensureVariantTable();
    const rows = (await sql!`select id, number, source_id, term, replacement, data
      from noesis_problem_variants order by number`) as VariantRow[];
    for (const row of rows) remember(row);
    loadedAt = Date.now();
  } catch (error) {
    console.error("Could not load problem variants", error);
  }
};

export const variantProblems = (): Problem[] => created;
export const variantNumber = (id: string): number | undefined => numbers.get(id);
export const getVariant = (id: string): Problem | undefined => created.find((problem) => problem.id === id);

/** A variant by id, from this instance or, failing that, from the database. */
export const fetchVariant = async (id: string): Promise<Problem | undefined> => {
  const known = getVariant(id);
  if (known || !usingDatabase()) return known;
  try {
    await ensureVariantTable();
    const rows = (await sql!`select id, number, source_id, term, replacement, data
      from noesis_problem_variants where id = ${id}`) as VariantRow[];
    for (const row of rows) remember(row);
  } catch (error) {
    console.error("Could not look up problem variant", error);
  }
  return getVariant(id);
};

// ------------------------------------------------------------- the pipeline

interface Rewritten {
  valid: boolean;
  reason?: string;
  /** Set when the reply could not be used at all, so it is worth asking again. */
  retry?: boolean;
  title?: string;
  functionName?: string;
  parameters?: Array<{ name: string; kind: string }>;
  returnKind?: string;
  description?: string;
  constraints?: string[];
  referenceCode?: string;
  inputs?: Array<Record<string, unknown>>;
}

const SYSTEM_PROMPT = `You adapt data-structures-and-algorithms problems.

The user replaces one word in a problem statement. Decide whether the result is
a coherent DSA problem, and if it is, rewrite the problem around it.

Reject, with valid=false and a one-sentence reason, when the replacement is not
a real algorithmic variation: a name, slang, a random string, or a word that
leaves the statement meaningless or self-contradictory.

When it is valid, return the rewritten problem. Rules:
- functionName is snake_case, describes the NEW problem, and must differ from the
  original. A statement about even numbers must not be solved by a function called
  count_odds, and a variant must never share its parent's name.
- When the changed word is a count of inputs ("two lists" becoming "three
  lists"), the parameters change to match: one parameter per input, named in
  the same style (list1, list2, list3). Never more than six parameters: if
  the new count would need more, reply valid=false and say the change needs
  more than six separate inputs. "one" means a single input.
- When the changed word is a count of things to find or return ("two
  elements" becoming "five elements", "two indices" becoming "three"), that is
  a valid variation: rewrite the problem to find that many, keep the inputs'
  shape, and make the inputs big enough to contain an answer. Only refuse a
  count above 20, because the inputs would be too large to read.
- When the changed word is any other number (a target, a size, an index),
  keep the parameters and change the statement and inputs to match.
- Prefer a coherent rewrite over a refusal. Refuse only when no reasonable
  reading of the changed statement is a well-defined problem.
- parameters and returnKind describe the NEW problem and may differ from the
  original when the meaning demands it. A statement about a doubly linked list
  takes doubly_linked_list, not linked_list; one that returns the values rather
  than a count returns array, not int. Keep them unchanged when the meaning has
  not moved.
- Allowed kinds: int, long, double, bool, string, array, long_array,
  double_array, bool_array, string_array, matrix, graph, char_matrix,
  string_matrix, linked_list, doubly_linked_list, cyclic_list, y_list,
  random_list, child_list, tree. returnKind may also be void.
- referenceCode must be Python 3, define exactly functionName, and be correct.
- Linked lists arrive as ListNode objects with .val and .next, trees as TreeNode
  with .val, .left, .right. Do not redefine those classes.
- inputs must be a list of argument objects keyed by parameter name, using the
  same shapes as the originals, adjusted so they satisfy the new statement.
- Never state expected outputs. They are computed by running your solution.

Reply with JSON only:
{"valid":true,"title":"...","functionName":"...","parameters":[{"name":"...","kind":"..."}],"returnKind":"...","description":"...","constraints":["..."],"referenceCode":"...","inputs":[{...}]}
or
{"valid":false,"reason":"..."}`;

/** One retry when the first answer is unusable: a transient bad reply is common. */
const askForRewrite = async (problem: Problem, term: string, replacement: string): Promise<Rewritten> => {
  const first = await requestRewrite(problem, term, replacement);
  const unusable = first.valid !== false && (!first.description || !first.referenceCode || !first.inputs?.length);
  if (first.retry || unusable) return requestRewrite(problem, term, replacement);
  return first;
};

const requestRewrite = async (problem: Problem, term: string, replacement: string): Promise<Rewritten> => {
  const key = apiKey();
  if (!key) return { valid: false, reason: "Changing a word isn't available right now. Please try again later." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              replace: term,
              with: replacement,
              title: problem.title,
              description: problem.description,
              constraints: problem.constraints,
              functionName: problem.signature.functionName,
              parameters: problem.signature.parameters,
              returnKind: problem.signature.returnKind,
              structureType: problem.structureType,
              originalInputs: problem.testCases.map((testCase) => testCase.input).slice(0, 6)
            })
          }
        ]
      }),
      signal: controller.signal
    });

    const body = (await response.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      console.error("Variant rewrite failed", response.status, body.error?.message ?? "");
      return { valid: false, retry: true, reason: "We couldn't rewrite the problem just now. Please try again in a moment." };
    }
    const content = body.choices?.[0]?.message?.content?.trim();
    if (!content) return { valid: false, reason: "The rewrite came back empty. Try again." };
    const json = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(json) as Rewritten;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { valid: false, reason: "That took too long. Try again." };
    }
    console.error("Variant rewrite errored", error);
    return { valid: false, retry: true, reason: "The rewrite could not be read. Try again." };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Create a variant, or explain why not.
 *
 * The cheap refusals come first: a word that is not in the statement, and a
 * variation the problem set already covers. Both are decided without spending
 * a request, and the second is what stops the library filling with duplicates.
 */
export const createVariant = async (
  source: Problem,
  term: string,
  replacement: string,
  existing: Problem[],
  report: (stage: VariantStage) => void = () => {}
): Promise<VariantOutcome> => {
  const trimmed = replacement.trim();
  if (!trimmed || trimmed.length > MAX_TERM) {
    return { status: "invalid", reason: "Pick a word or short phrase." };
  }
  if (normalise(trimmed) === normalise(term)) {
    return { status: "invalid", reason: "That is the word already there." };
  }
  const wordPattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  if (!wordPattern.test(source.description)) {
    return { status: "invalid", reason: "That word is not in this statement any more. Pick one that is underlined now." };
  }

  // Undoing the change that made this problem. The way back is the problem it
  // was made from, whatever either statement happens to say now.
  const came = lineage.get(source.id);
  if (
    came &&
    came.term.toLowerCase() === trimmed.toLowerCase() &&
    came.replacement.toLowerCase() === term.toLowerCase()
  ) {
    const back = existing.find((problem) => problem.id === came.sourceId);
    if (back) {
      return {
        status: "exists",
        problemId: back.id,
        title: back.title,
        number: numbers.get(back.id) ?? existing.indexOf(back) + 1
      };
    }
  }

  // The same request made before, which is the case a learner actually hits:
  // they changed this word here once already.
  const seen = asked.get(askKey(source.id, term, trimmed));
  const madeBefore = seen ? created.find((problem) => problem.id === seen) : undefined;
  if (madeBefore) {
    return {
      status: "exists",
      problemId: madeBefore.id,
      title: madeBefore.title,
      number: numbers.get(madeBefore.id) ?? existing.indexOf(madeBefore) + 1
    };
  }

  // What the statement would read as. If some problem already says exactly
  // that, the variation is not new and the learner should be sent to it.
  const candidate = normalise(source.description.replace(wordPattern, trimmed));
  const already = existing.find((problem) => normalise(problem.description) === candidate);
  if (already) {
    return {
      status: "exists",
      problemId: already.id,
      title: already.title,
      number: existing.indexOf(already) + 1
    };
  }

  report({ stage: "rewriting" });
  const rewritten = await askForRewrite(source, term, trimmed);
  if (!rewritten.valid) {
    return { status: "invalid", reason: rewritten.reason ?? "That is not a variation of this problem." };
  }
  if (!rewritten.description || !rewritten.referenceCode || !rewritten.inputs?.length) {
    return { status: "invalid", reason: "The rewrite came back incomplete. Try again." };
  }

  report({ stage: "checking" });

  // The rewrite may land on a problem that already exists even though the
  // naive replacement did not, so the same check runs again on what it wrote.
  const rewrittenKey = normalise(rewritten.description);
  const collision = existing.find((problem) => normalise(problem.description) === rewrittenKey);
  if (collision) {
    return {
      status: "exists",
      problemId: collision.id,
      title: collision.title,
      number: existing.indexOf(collision) + 1
    };
  }

  /**
   * The name has to move with the meaning.
   *
   * C++ and Java starters are generated from the signature, and the harness
   * calls whatever it says. Leaving `count_odds` on a problem that now counts
   * evens hands the learner a stub whose name contradicts the question, and
   * the moment they rename it to match, the harness cannot find it. The
   * Python starter is prose rather than generated, so the old name is swapped
   * out of it directly.
   */
  const suggested = looksLikeIdentifier(rewritten.functionName)
    ? rewritten.functionName!.trim()
    : source.signature.functionName;
  const renamed =
    suggested === source.signature.functionName
      ? derivedName(source.signature.functionName, term, trimmed)
      : suggested;

  // Whatever was settled on, the solution has to answer to it — including any
  // recursive calls to itself, which is why this is a whole-word replace
  // rather than a patch of the `def` line.
  const reference =
    renamed === suggested
      ? rewritten.referenceCode
      : rewritten.referenceCode.replace(new RegExp(String.raw`\b${suggested}\b`, "g"), renamed);

  /**
   * The shape the variant asked for, kept only where it holds up.
   *
   * A statement about a doubly linked list needs nodes with a `prev`, and one
   * that returns values rather than a count returns an array — so the kinds
   * have to be allowed to move. What cannot be allowed is a kind the harness
   * has never heard of, or a parameter list that no longer matches the inputs
   * it will be handed, so both are checked against what the platform actually
   * supports rather than taken on the model's word.
   */
  const proposed = rewritten.parameters;
  const kindsHold =
    Array.isArray(proposed) &&
    proposed.length > 0 &&
    proposed.length <= 6 &&
    new Set(proposed.map((parameter) => parameter?.name)).size === proposed.length &&
    proposed.every(
      (parameter) =>
        typeof parameter?.name === "string" &&
        /^[a-z][a-z0-9_]{0,30}$/.test(parameter.name) &&
        INPUT_KINDS.includes(parameter.kind as ValueKind)
    );
  const returnHolds = RETURN_KINDS.includes(rewritten.returnKind as ValueKind);

  const signature = {
    ...source.signature,
    functionName: renamed,
    parameters: kindsHold
      ? proposed!.map((parameter) => ({ name: parameter.name, kind: parameter.kind as ValueKind }))
      : source.signature.parameters,
    returnKind: returnHolds ? (rewritten.returnKind as ValueKind) : source.signature.returnKind
  };

  /** A structure type that still describes what the reader will be shown. */
  const family = (kind: ValueKind) =>
    kind === "tree"
      ? "tree"
      : ["linked_list", "doubly_linked_list", "cyclic_list", "y_list", "random_list", "child_list"].includes(kind)
        ? "linked_list"
        : kind === "graph"
          ? "graph"
          : "array";
  const shown = family(signature.parameters[0]?.kind ?? "array");
  const structureType =
    family(source.signature.parameters[0]?.kind ?? "array") === shown ? source.structureType : shown;
  const pythonStarter =
    renamed === source.signature.functionName
      ? source.starterCode
      : source.starterCode.split(source.signature.functionName).join(renamed);

  // Now the part that makes the answers trustworthy: run the solution.
  const draft: Problem = {
    ...source,
    signature,
    structureType,
    starterCode: pythonStarter,
    id: `${slugify(rewritten.title ?? source.title)}-${randomUUID().slice(0, 6)}`,
    // A variant sharing its parent's title is indistinguishable in a list,
    // and the model often keeps the original. The word that changed is the
    // one thing that tells them apart, so it goes in the name.
    title: distinctTitle(source.title, rewritten.title, trimmed),
    description: rewritten.description.trim(),
    constraints: rewritten.constraints?.length ? rewritten.constraints : source.constraints,
    referenceCode: reference,
    examples: [],
    testCases: [],
    defaultInput: rewritten.inputs[0]
  };

  const cases: ProblemTestCase[] = [];
  for (const [at, input] of rewritten.inputs.slice(0, 6).entries()) {
    // Checked against the signature before a container is started: an input
    // that does not fit the kinds cannot produce an answer worth keeping, and
    // finding that out here costs nothing.
    const wrong = validateCustomInput(draft, input);
    if (wrong) {
      return {
        status: "invalid",
        reason: `The rewritten inputs do not fit the problem's shape (${wrong}).`
      };
    }
    report({ stage: "running", done: at, of: Math.min(rewritten.inputs.length, 6) });
    const run = await runProblemCase(draft, draft.referenceCode, input, {
      trace: false,
      stepLimit: 0,
      visualizeLimit: 0,
      language: "python" as Language
    });
    if (!run.ok) {
      return {
        status: "invalid",
        reason:
          at === 0
            ? "We couldn't check the answers for that change, so it wasn't made. Try again, or try a different word."
            : "Some of the rewritten inputs could not be solved. Try a different word."
      };
    }
    cases.push({
      id: `${draft.id}-case-${at + 1}`,
      input,
      expectedOutput: run.result,
      visible: at < 2
    });
  }
  if (cases.length === 0) {
    return { status: "invalid", reason: "No case could be worked out for that variation." };
  }

  const problem: Problem = {
    ...draft,
    testCases: cases,
    examples: cases.slice(0, 1).map((testCase) => ({ input: testCase.input, output: testCase.expectedOutput })),
    visibleTestCases: cases.filter((testCase) => testCase.visible),
    starterCodeByLanguage: buildStarterCodeByLanguage(signature, pythonStarter)
  };

  // `existing` already contains every variant, so adding their count again
  // double-counts and hands out a number that is already taken. Take the
  // highest of what is used and what is held, and go one past it.
  const number = Math.max(existing.length, 0, ...numbers.values()) + 1;
  created.push(problem);
  numbers.set(problem.id, number);
  asked.set(askKey(source.id, term, trimmed), problem.id);
  lineage.set(problem.id, { sourceId: source.id, term, replacement: trimmed });

  if (usingDatabase()) {
    try {
      await ensureVariantTable();
      await sql!`insert into noesis_problem_variants (id, number, source_id, term, replacement, data)
        values (${problem.id}, ${number}, ${source.id}, ${term}, ${trimmed}, ${JSON.stringify(problem)})
        on conflict (id) do nothing`;
    } catch (error) {
      // In memory is still a working variant; losing it on restart beats losing
      // the request.
      console.error("Could not persist problem variant", error);
    }
  }

  const { referenceCode: _reference, testCases: _cases, ...safe } = problem;
  return { status: "created", problem: safe, number };
};
