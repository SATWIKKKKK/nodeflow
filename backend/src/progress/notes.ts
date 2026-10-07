import fs from "node:fs";
import path from "node:path";
import { dataDir } from "../paths.js";
import { ensureSchema, sql } from "../store/db.js";

/**
 * A learner's own notes on a problem: free text, one note per problem, kept
 * with their account so it follows them between devices.
 *
 * Postgres when DATABASE_URL is set, otherwise backend/data/notes.json.
 */

export const MAX_NOTE = 20_000;

const notesPath = path.join(dataDir, "notes.json");

type NoteFile = Record<string, { text: string; updatedAt: string }>;

const readFile = (): NoteFile => {
  try {
    return JSON.parse(fs.readFileSync(notesPath, "utf8")) as NoteFile;
  } catch {
    return {};
  }
};

let tableReady: Promise<void> | null = null;
const ensureTable = () => {
  if (!sql) return Promise.resolve();
  tableReady ??= (async () => {
    await ensureSchema();
    await sql!`create table if not exists noesis_notes (
      user_id text not null,
      problem_id text not null,
      text text not null,
      updated_at timestamptz not null default now(),
      primary key (user_id, problem_id)
    )`;
  })().catch((error) => {
    tableReady = null;
    throw error;
  });
  return tableReady;
};

export const noteFor = async (userId: string, problemId: string) => {
  if (sql) {
    await ensureTable();
    const rows = (await sql`select text, updated_at from noesis_notes
      where user_id = ${userId} and problem_id = ${problemId}`) as Array<{ text: string; updated_at: string | Date }>;
    return rows[0] ? { text: rows[0].text, updatedAt: new Date(rows[0].updated_at).toISOString() } : null;
  }
  return readFile()[`${userId}|${problemId}`] ?? null;
};

export const saveNote = async (userId: string, problemId: string, text: string) => {
  const updatedAt = new Date().toISOString();
  if (sql) {
    await ensureTable();
    if (!text.trim()) {
      await sql`delete from noesis_notes where user_id = ${userId} and problem_id = ${problemId}`;
    } else {
      await sql`insert into noesis_notes (user_id, problem_id, text, updated_at)
        values (${userId}, ${problemId}, ${text}, ${updatedAt})
        on conflict (user_id, problem_id) do update set text = excluded.text, updated_at = excluded.updated_at`;
    }
    return { updatedAt };
  }
  const all = readFile();
  const key = `${userId}|${problemId}`;
  if (text.trim()) all[key] = { text, updatedAt };
  else delete all[key];
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(notesPath, `${JSON.stringify(all, null, 2)}\n`, "utf8");
  return { updatedAt };
};
