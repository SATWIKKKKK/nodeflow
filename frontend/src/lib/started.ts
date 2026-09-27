import type { Difficulty, Language, StructureType, UnfinishedProblem } from "@nodeflow/shared";

/**
 * Problems opened on this device and not yet solved here: Continue Solving's
 * record for guests, and the list an account is topped up from on sign-in.
 *
 * A problem goes in the moment it is opened, typed in or not, and comes out
 * when it is accepted. Kept in localStorage, so it survives closing the
 * window and signing out; every read may come back empty.
 */

const KEY = "noesis:started";
/** Problems accepted on this device: reopening one does not make it unfinished again. */
const SOLVED_KEY = "noesis:solved-here";
const SYNCED_KEY = (userId: string) => `noesis:started-synced:${userId}`;
const LIMIT = 300;

export interface StartedEntry {
  problemId: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  structureType: StructureType;
  language: Language;
  at: string;
}

const read = (): StartedEntry[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as StartedEntry[]) : [];
  } catch {
    return [];
  }
};

const write = (entries: StartedEntry[]) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
  } catch {
    // Continue Solving falls back to the account, or to nothing, for this visit.
  }
};

const readSolved = (): string[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SOLVED_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
};

/** Newest first, without anything solved here since. */
export const readStarted = () => {
  const solved = new Set(readSolved());
  return read()
    .filter((entry) => !solved.has(entry.problemId))
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
};

export const markStarted = (
  problem: { id: string; title: string; topic: string; difficulty: Difficulty; structureType: StructureType },
  language: Language
) => {
  if (readSolved().includes(problem.id)) return;
  const rest = read().filter((entry) => entry.problemId !== problem.id);
  write([
    {
      problemId: problem.id,
      title: problem.title,
      topic: problem.topic,
      difficulty: problem.difficulty,
      structureType: problem.structureType,
      language,
      at: new Date().toISOString()
    },
    ...rest
  ]);
};

/** Off the list: the problem no longer exists. */
export const forgetStarted = (problemId: string) => write(read().filter((entry) => entry.problemId !== problemId));

/** Off the list for good: accepted here. */
export const markSolvedHere = (problemId: string) => {
  forgetStarted(problemId);
  try {
    const solved = new Set(readSolved());
    solved.add(problemId);
    window.localStorage.setItem(SOLVED_KEY, JSON.stringify([...solved].slice(-2000)));
  } catch {
    // The account's own record still excludes it for a signed-in learner.
  }
};

/** As Continue Solving rows, for a guest. */
export const startedAsUnfinished = (): UnfinishedProblem[] =>
  readStarted().map((entry) => ({
    problemId: entry.problemId,
    title: entry.title,
    topic: entry.topic,
    difficulty: entry.difficulty,
    structureType: entry.structureType,
    language: entry.language,
    updatedAt: entry.at,
    attempts: 0
  }));

/** Entries this account has not been sent yet. */
export const unsyncedStarted = (userId: string) => {
  let since = 0;
  try {
    since = Number(window.localStorage.getItem(SYNCED_KEY(userId)) ?? "0") || 0;
  } catch {
    since = 0;
  }
  return readStarted().filter((entry) => Date.parse(entry.at) > since);
};

export const markStartedSynced = (userId: string, upTo: number) => {
  try {
    window.localStorage.setItem(SYNCED_KEY(userId), String(upTo));
  } catch {
    // Sent again next time; the server keeps the newer time, so that is harmless.
  }
};
