import fs from "node:fs";
import path from "node:path";
import type { Language, SavedDraft, UnfinishedProblem } from "@nodeflow/shared";
import { getProblem } from "../problems/seeds.js";
import { getVariant } from "../problems/variants.js";
import { dataDir } from "../paths.js";
import { ensureSchema, sql } from "../store/db.js";
import { readSubmissions } from "./summary.js";

/**
 * The code a signed-in learner is part-way through, one draft per problem.
 *
 * The browser keeps its own copy for instant reloads, but that copy is lost
 * with the browser and never reaches another device. This one is what lets
 * Continue Solving bring a learner back to a problem after signing out,
 * closing the window or moving to a different machine.
 *
 * Postgres when DATABASE_URL is set, otherwise backend/data/drafts.json.
 */

const MAX_CODE = 60_000;
const storePath = path.join(dataDir, "drafts.json");

interface StoredDraft extends SavedDraft {
  userId: string;
}

const readFile = (): StoredDraft[] => {
  if (!fs.existsSync(storePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredDraft[]) : [];
  } catch {
    return [];
  }
};

const writeFile = (drafts: StoredDraft[]) => {
  fs.mkdirSync(dataDir, { recursive: true });
  const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(drafts, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, storePath);
};

interface DraftRow {
  problem_id: string;
  language: Language;
  code: string;
  updated_at: string | Date;
}

const fromRow = (row: DraftRow): SavedDraft => ({
  problemId: row.problem_id,
  language: row.language,
  code: row.code,
  updatedAt: new Date(row.updated_at).toISOString()
});

const draftsFor = async (userId: string): Promise<SavedDraft[]> => {
  if (sql) {
    await ensureSchema();
    const rows = (await sql`select problem_id, language, code, updated_at from noesis_drafts
      where user_id = ${userId}`) as DraftRow[];
    return rows.map(fromRow);
  }
  return readFile()
    .filter((draft) => draft.userId === userId)
    .map(({ userId: _owner, ...draft }) => draft);
};

export const saveDraft = async (
  userId: string,
  problemId: string,
  language: Language,
  code: string
): Promise<SavedDraft> => {
  const trimmed = code.slice(0, MAX_CODE);
  const updatedAt = new Date().toISOString();
  if (sql) {
    await ensureSchema();
    await sql`insert into noesis_drafts (user_id, problem_id, language, code, updated_at)
      values (${userId}, ${problemId}, ${language}, ${trimmed}, ${updatedAt})
      on conflict (user_id, problem_id) do update
        set language = excluded.language, code = excluded.code, updated_at = excluded.updated_at`;
    return { problemId, language, code: trimmed, updatedAt };
  }
  const all = readFile().filter((draft) => !(draft.userId === userId && draft.problemId === problemId));
  all.push({ userId, problemId, language, code: trimmed, updatedAt });
  writeFile(all);
  return { problemId, language, code: trimmed, updatedAt };
};

export const clearDraft = async (userId: string, problemId: string) => {
  if (sql) {
    await ensureSchema();
    await sql`delete from noesis_drafts where user_id = ${userId} and problem_id = ${problemId}`;
    return;
  }
  const all = readFile();
  const kept = all.filter((draft) => !(draft.userId === userId && draft.problemId === problemId));
  if (kept.length !== all.length) writeFile(kept);
};

/** The saved draft, or failing that the code of the latest submission. */
export const draftFor = async (userId: string, problemId: string): Promise<SavedDraft | null> => {
  const saved = (await draftsFor(userId)).find((draft) => draft.problemId === problemId);
  if (saved) return saved;
  if (sql) {
    await ensureSchema();
    const rows = (await sql`select problem_id, language, code, created_at as updated_at from noesis_submissions
      where user_id = ${userId} and problem_id = ${problemId} order by created_at desc limit 1`) as DraftRow[];
    return rows[0] ? fromRow(rows[0]) : null;
  }
  return null;
};

/**
 * Every problem started and not yet accepted, most recent first: those with a
 * draft, and those submitted without ever passing.
 */
export const unfinishedFor = async (userId: string): Promise<UnfinishedProblem[]> => {
  const [drafts, submissions] = await Promise.all([draftsFor(userId), readSubmissions([userId])]);
  const solved = new Set(submissions.filter((entry) => entry.verdict === "Accepted").map((entry) => entry.problemId));

  const out = new Map<string, UnfinishedProblem>();
  const touch = (problemId: string, at: string, language?: Language) => {
    const problem = getProblem(problemId) ?? getVariant(problemId);
    if (!problem || solved.has(problemId)) return;
    const tried = submissions.filter((entry) => entry.problemId === problemId);
    const current = out.get(problemId);
    if (current && Date.parse(current.updatedAt) >= Date.parse(at)) return;
    out.set(problemId, {
      problemId,
      title: problem.title,
      topic: problem.topic,
      difficulty: problem.difficulty,
      structureType: problem.structureType,
      language: language ?? current?.language,
      updatedAt: at,
      attempts: tried.length,
      lastVerdict: tried[tried.length - 1]?.verdict
    });
  };
  for (const draft of drafts) touch(draft.problemId, draft.updatedAt, draft.language);
  for (const entry of submissions) touch(entry.problemId, entry.timestamp);
  return [...out.values()].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
};
