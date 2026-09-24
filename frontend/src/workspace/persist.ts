import type { ExecutionResponse, Language, PublicProblem } from "@nodeflow/shared";

/**
 * Per-viewer workspace memory: drafts, custom input, and the last problem and
 * trace, so a reload paints the scene immediately instead of waiting on the
 * sandbox. Everything here is a convenience; any read may come back empty.
 */

const read = <T>(key: string): T | null => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const remove = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to clean up.
  }
};

/** Keeps at most `limit` keys of one family, dropping the oldest. */
const touchIndex = (indexKey: string, key: string, limit: number) => {
  const index = (read<string[]>(indexKey) ?? []).filter((entry) => entry !== key);
  index.push(key);
  while (index.length > limit) remove(index.shift()!);
  write(indexKey, index);
};

// --- drafts ------------------------------------------------------------------

const draftKey = (problemId: string, language: Language) => `noesis:draft:${problemId}:${language}`;

export const readDraft = (problemId: string, language: Language) =>
  read<string>(draftKey(problemId, language));

export const writeDraft = (problemId: string, language: Language, code: string) => {
  const key = draftKey(problemId, language);
  write(key, code);
  touchIndex("noesis:draft-index", key, 120);
};

export const clearDraft = (problemId: string, language: Language) => remove(draftKey(problemId, language));

// --- language ----------------------------------------------------------------

export const readLanguage = (): Language => {
  const value = read<string>("noesis:language");
  return value === "cpp" || value === "java" ? value : "python";
};

export const writeLanguage = (language: Language) => write("noesis:language", language);

// --- custom input --------------------------------------------------------------

export interface CustomInputState {
  enabled: boolean;
  text: string;
}

const inputKey = (problemId: string) => `noesis:custom-input:${problemId}`;

export const readCustomInput = (problemId: string) => read<CustomInputState>(inputKey(problemId));

export const writeCustomInput = (problemId: string, state: CustomInputState) => {
  write(inputKey(problemId), state);
  touchIndex("noesis:custom-input-index", inputKey(problemId), 80);
};

// --- problems ----------------------------------------------------------------

const problemKey = (problemId: string) => `noesis:problem:${problemId}`;

export const readCachedProblem = (problemId: string) => read<PublicProblem>(problemKey(problemId));

export const writeCachedProblem = (problem: PublicProblem) => {
  write(problemKey(problem.id), problem);
  touchIndex("noesis:problem-index", problemKey(problem.id), 40);
};

// --- traces ------------------------------------------------------------------

const MAX_TRACE_CHARS = 900_000;
const traceKey = (problemId: string, language: Language) => `noesis:trace:${problemId}:${language}`;

interface CachedTrace {
  /** language + input + code, exactly as the preview that produced it. */
  key: string;
  response: ExecutionResponse;
}

export const readCachedTrace = (problemId: string, language: Language, key: string) => {
  const cached = read<CachedTrace>(traceKey(problemId, language));
  return cached?.key === key ? cached.response : null;
};

export const writeCachedTrace = (problemId: string, language: Language, key: string, response: ExecutionResponse) => {
  const storageKey = traceKey(problemId, language);
  const payload = JSON.stringify({ key, response });
  if (payload.length > MAX_TRACE_CHARS) return;
  try {
    window.localStorage.setItem(storageKey, payload);
  } catch {
    // Storage full: drop the older traces and try once more.
    for (const old of read<string[]>("noesis:trace-index") ?? []) remove(old);
    write("noesis:trace-index", []);
    try {
      window.localStorage.setItem(storageKey, payload);
    } catch {
      return;
    }
  }
  touchIndex("noesis:trace-index", storageKey, 8);
};
