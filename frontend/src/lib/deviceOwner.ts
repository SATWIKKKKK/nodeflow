/**
 * Whose work this browser is holding.
 *
 * Drafts, test cases, notes, the started and solved lists, traces, cached
 * progress and guest coins live in localStorage, keyed by problem rather than
 * by person. On a shared computer (a lab, a classroom) the next person to sign
 * in would otherwise open the last person's code, and their started list
 * would even be synced into the new account. So the browser remembers who it
 * belongs to, and whenever that changes (another account, or signing out)
 * everything personal is cleared before the next person's session begins.
 * Their work is not lost: drafts, progress and coins live on the account.
 *
 * Preferences (theme, language, layout) are not personal and stay.
 */

const OWNER_KEY = "noesis:device-owner";

const PERSONAL: Array<string | RegExp> = [
  /^noesis:draft:/,
  "noesis:draft-index",
  /^noesis:testcases:/,
  "noesis:testcases-index",
  /^noesis:custom-input:/,
  "noesis:custom-input-index",
  "noesis:started",
  /^noesis:started-synced:/,
  "noesis:solved-here",
  /^noesis:note:/,
  "noesis:coins",
  "noesis:coin-ledger",
  /^noesis:trace:/,
  "noesis:trace-index",
  /^noesis:cache:/
];

const isPersonal = (key: string) => PERSONAL.some((rule) => (typeof rule === "string" ? key === rule : rule.test(key)));

/**
 * Hands the browser to `owner` (a user id, or "guest"). Returns true when it
 * changed hands and the previous person's data was cleared.
 */
export const claimDevice = (owner: string) => {
  try {
    const storage = window.localStorage;
    if (storage.getItem(OWNER_KEY) === owner) return false;
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
      (key): key is string => Boolean(key)
    );
    for (const key of keys) if (isPersonal(key)) storage.removeItem(key);
    storage.setItem(OWNER_KEY, owner);
    return true;
  } catch {
    // Storage blocked: nothing was kept, so there is nothing to clear.
    return false;
  }
};
