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
import type { Language, Problem, ProblemTestCase, PublicProblem } from "@nodeflow/shared";
import { runProblemCase } from "../execution/service.js";
import { sql, ensureSchema, usingDatabase } from "../store/db.js";
import { buildStarterCodeByLanguage } from "./starterCode.js";

const ENDPOINT = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-reasoner";
const TIMEOUT_MS = 60_000;
const MAX_TOKENS = 2000;

export const MAX_TERM = 60;

const apiKey = () => process.env.DEEPSEEK_API_KEY ?? "";
export const variantsEnabled = () => apiKey().length > 0;

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

let loaded = false;

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

export const loadVariants = async (): Promise<void> => {
  if (loaded || !usingDatabase()) {
    loaded = true;
    return;
  }
  try {
    await ensureVariantTable();
    const rows = (await sql!`select id, number, source_id, term, replacement, data
      from noesis_problem_variants order by number`) as Array<{
      id: string;
      number: number;
      source_id: string;
      term: string;
      replacement: string;
      data: Problem;
    }>;
    for (const row of rows) {
      asked.set(askKey(row.source_id, row.term, row.replacement), row.id);
      if (created.some((problem) => problem.id === row.id)) continue;
      created.push(row.data);
      numbers.set(row.id, row.number);
    }
  } catch (error) {
    console.error("Could not load problem variants", error);
  }
  loaded = true;
};

export const variantProblems = (): Problem[] => created;
export const variantNumber = (id: string): number | undefined => numbers.get(id);
export const getVariant = (id: string): Problem | undefined => created.find((problem) => problem.id === id);

// ------------------------------------------------------------- the pipeline

interface Rewritten {
  valid: boolean;
  reason?: string;
  title?: string;
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
- Keep the same function name, parameter names and shapes. Only the meaning changes.
- referenceCode must be Python 3, define exactly that function, and be correct.
- Linked lists arrive as ListNode objects with .val and .next, trees as TreeNode
  with .val, .left, .right. Do not redefine those classes.
- inputs must be a list of argument objects keyed by parameter name, using the
  same shapes as the originals, adjusted so they satisfy the new statement.
- Never state expected outputs. They are computed by running your solution.

Reply with JSON only:
{"valid":true,"title":"...","description":"...","constraints":["..."],"referenceCode":"...","inputs":[{...}]}
or
{"valid":false,"reason":"..."}`;

const askForRewrite = async (problem: Problem, term: string, replacement: string): Promise<Rewritten> => {
  const key = apiKey();
  if (!key) return { valid: false, reason: "Variants are not enabled on this deployment." };

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
      return { valid: false, reason: "The assistant could not be reached. Try again shortly." };
    }
    const content = body.choices?.[0]?.message?.content?.trim();
    if (!content) return { valid: false, reason: "The assistant returned nothing." };
    return JSON.parse(content) as Rewritten;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { valid: false, reason: "That took too long. Try again." };
    }
    console.error("Variant rewrite errored", error);
    return { valid: false, reason: "The assistant could not answer. Try again shortly." };
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
  existing: Problem[]
): Promise<VariantOutcome> => {
  const trimmed = replacement.trim();
  if (!trimmed || trimmed.length > MAX_TERM) {
    return { status: "invalid", reason: "Pick a word or short phrase." };
  }
  if (normalise(trimmed) === normalise(term)) {
    return { status: "invalid", reason: "That is the word already there." };
  }
  if (!source.description.includes(term)) {
    return { status: "invalid", reason: "That word is not in this statement." };
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
  const candidate = normalise(source.description.split(term).join(trimmed));
  const already = existing.find((problem) => normalise(problem.description) === candidate);
  if (already) {
    return {
      status: "exists",
      problemId: already.id,
      title: already.title,
      number: existing.indexOf(already) + 1
    };
  }

  const rewritten = await askForRewrite(source, term, trimmed);
  if (!rewritten.valid) {
    return { status: "invalid", reason: rewritten.reason ?? "That is not a variation of this problem." };
  }
  if (!rewritten.description || !rewritten.referenceCode || !rewritten.inputs?.length) {
    return { status: "invalid", reason: "The rewrite came back incomplete. Try again." };
  }

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

  // Now the part that makes the answers trustworthy: run the solution.
  const draft: Problem = {
    ...source,
    id: `${slugify(rewritten.title ?? source.title)}-${randomUUID().slice(0, 6)}`,
    // A variant sharing its parent's title is indistinguishable in a list,
    // and the model often keeps the original. The word that changed is the
    // one thing that tells them apart, so it goes in the name.
    title: distinctTitle(source.title, rewritten.title, trimmed),
    description: rewritten.description.trim(),
    constraints: rewritten.constraints?.length ? rewritten.constraints : source.constraints,
    referenceCode: rewritten.referenceCode,
    examples: [],
    testCases: [],
    defaultInput: rewritten.inputs[0]
  };

  const cases: ProblemTestCase[] = [];
  for (const [at, input] of rewritten.inputs.slice(0, 6).entries()) {
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
            ? "The rewritten solution would not run, so the answers could not be checked."
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
    starterCodeByLanguage: buildStarterCodeByLanguage(draft.signature, draft.starterCode)
  };

  const number = existing.length + created.length + 1;
  created.push(problem);
  numbers.set(problem.id, number);
  asked.set(askKey(source.id, term, trimmed), problem.id);

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
