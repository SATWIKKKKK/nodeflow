/**
 * Last-known answers, kept in this browser so a page can draw at once.
 *
 * The problem list, a learner's progress and their in-progress problems all
 * come from the server, which can take a second, longer when it has been idle.
 * Waiting for them left the problem list with no solved or in-progress marks
 * for that whole time on every visit and every reload. Now the last answer is
 * shown straight away and replaced the moment a fresh one arrives.
 *
 * Entries are per user (or "guest"), so one account never sees another's
 * marks on a shared computer, and storage failures (private mode, a full
 * quota) just mean no head start.
 */

const PREFIX = "noesis:cache:";
const memory = new Map<string, unknown>();

const keyFor = (name: string, owner: string) => `${PREFIX}${name}:${owner}`;

export const readCached = <T>(name: string, owner: string): T | null => {
  const key = keyFor(name, owner);
  if (memory.has(key)) return memory.get(key) as T;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as T;
    memory.set(key, value);
    return value;
  } catch {
    return null;
  }
};

export const writeCached = <T>(name: string, owner: string, value: T) => {
  const key = keyFor(name, owner);
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the in-memory copy still serves this visit.
  }
};

/** Drops a user's cached answers, for sign-out. */
export const forgetCached = (owner: string) => {
  for (const key of [...memory.keys()]) if (key.endsWith(`:${owner}`)) memory.delete(key);
  try {
    for (let at = window.localStorage.length - 1; at >= 0; at -= 1) {
      const key = window.localStorage.key(at);
      if (key?.startsWith(PREFIX) && key.endsWith(`:${owner}`)) window.localStorage.removeItem(key);
    }
  } catch {
    // Nothing to clear.
  }
};
