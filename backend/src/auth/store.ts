import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AuthResponse, AuthUser } from "@nodeflow/shared";
import { dataDir } from "../paths.js";
import { ensureSchema, sql } from "../store/db.js";

/**
 * Email + password accounts with bearer-token sessions. Postgres when
 * DATABASE_URL is set, otherwise backend/data/auth.json. Passwords are salted
 * scrypt hashes; only a SHA-256 of each session token is stored.
 */

interface StoredUser extends AuthUser {
  passwordHash: string;
  salt: string;
}

interface StoredSession {
  tokenHash: string;
  userId: string;
  createdAt: string;
}

interface StoredReset {
  tokenHash: string;
  userId: string;
  expiresAt: string;
  usedAt?: string;
}

interface AuthFile {
  users: StoredUser[];
  sessions: StoredSession[];
  resetRequests: Array<{ email: string; requestedAt: string }>;
  resets: StoredReset[];
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/**
 * A session lasts as long as it is used. `createdAt` is really "last seen": it
 * moves forward (at most once a day) whenever the token is checked, so a
 * learner who keeps coming back is never signed out, and only one left unused
 * for SESSION_MAX_AGE_MS has to sign in again. Signing out ends it at once.
 */
const SESSIONS_PER_USER = 25;
const SESSION_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const SESSION_TOUCH_MS = 24 * 60 * 60 * 1000;

/**
 * scrypt off the main thread: the synchronous version holds the whole server
 * for every sign-in, so a burst of them would queue up behind each other.
 */
const hashPassword = (password: string, salt: string) =>
  new Promise<string>((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (error, key) => (error ? reject(error) : resolve(key.toString("hex"))))
  );
const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const newToken = () => crypto.randomBytes(32).toString("base64url");

const passwordMatches = async (password: string, user: Pick<StoredUser, "salt" | "passwordHash">) => {
  const actual = Buffer.from(await hashPassword(password, user.salt), "hex");
  const expected = Buffer.from(user.passwordHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

// A small per-process brake on password guessing: 8 failures per email in 10 minutes.
const failures = new Map<string, number[]>();
const FAILURE_WINDOW_MS = 10 * 60 * 1000;
const checkThrottle = (email: string) => {
  const recent = (failures.get(email) ?? []).filter((time) => Date.now() - time < FAILURE_WINDOW_MS);
  failures.set(email, recent);
  if (recent.length >= 8) throw new AuthError("Too many sign-in attempts. Try again in a few minutes.", 429);
};
const noteFailure = (email: string) => failures.set(email, [...(failures.get(email) ?? []), Date.now()]);

// ---------------------------------------------------------------- file store

const authPath = path.join(dataDir, "auth.json");
const lockPath = `${authPath}.lock`;

const emptyFile = (): AuthFile => ({ users: [], sessions: [], resetRequests: [], resets: [] });

const readFile = (): AuthFile => {
  if (!fs.existsSync(authPath)) return emptyFile();
  return { ...emptyFile(), ...(JSON.parse(fs.readFileSync(authPath, "utf8")) as Partial<AuthFile>) };
};

const writeFile = (store: AuthFile) => {
  fs.mkdirSync(dataDir, { recursive: true });
  const tempPath = `${authPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, authPath);
};

const waitSync = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// The verify scripts run several processes against one file, hence a lock file.
const acquireLock = () => {
  fs.mkdirSync(dataDir, { recursive: true });
  const started = Date.now();
  for (;;) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`, "utf8");
      return () => {
        fs.closeSync(fd);
        fs.rmSync(lockPath, { force: true });
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        if (Date.now() - fs.statSync(lockPath).mtimeMs > 15_000) {
          fs.rmSync(lockPath, { force: true });
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() - started > 15_000) throw new AuthError("Accounts are busy. Please try again.", 503);
      waitSync(25);
    }
  }
};

const updateFile = <T>(mutate: (store: AuthFile) => T): T => {
  const release = acquireLock();
  try {
    const store = readFile();
    const result = mutate(store);
    writeFile(store);
    return result;
  } finally {
    release();
  }
};

const publicUser = (user: { id: string; email: string; createdAt: string }): AuthUser => ({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt
});

const fileSession = (store: AuthFile, user: StoredUser): AuthResponse => {
  const token = newToken();
  const mine = store.sessions.filter((session) => session.userId === user.id).slice(-(SESSIONS_PER_USER - 1));
  store.sessions = [...store.sessions.filter((session) => session.userId !== user.id), ...mine];
  store.sessions.push({ tokenHash: hashToken(token), userId: user.id, createdAt: new Date().toISOString() });
  return { user: publicUser(user), token };
};

// ---------------------------------------------------------------- database

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  created_at: string | Date;
}

const rowUser = (row: UserRow): StoredUser => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  salt: row.salt,
  createdAt: new Date(row.created_at).toISOString()
});

const dbSession = async (user: StoredUser): Promise<AuthResponse> => {
  const db = sql!;
  const token = newToken();
  await db`insert into noesis_sessions (token_hash, user_id) values (${hashToken(token)}, ${user.id})`;
  // Keep the newest sessions per user; older devices sign in again.
  await db`delete from noesis_sessions where user_id = ${user.id} and token_hash not in (
    select token_hash from noesis_sessions where user_id = ${user.id} order by created_at desc limit ${SESSIONS_PER_USER}
  )`;
  return { user: publicUser(user), token };
};

// ---------------------------------------------------------------- API

export const signUp = async (email: string, password: string): Promise<AuthResponse> => {
  const normalized = normalizeEmail(email);
  const salt = crypto.randomBytes(16).toString("hex");
  const user: StoredUser = {
    id: `user_${crypto.randomUUID()}`,
    email: normalized,
    createdAt: new Date().toISOString(),
    salt,
    passwordHash: await hashPassword(password, salt)
  };

  if (sql) {
    await ensureSchema();
    const inserted = (await sql`
      insert into noesis_users (id, email, password_hash, salt)
      values (${user.id}, ${user.email}, ${user.passwordHash}, ${user.salt})
      on conflict (email) do nothing
      returning id
    `) as Array<{ id: string }>;
    if (!inserted.length) {
      // Someone signing up a second time with their own password is a
      // returning learner, not a conflict: let them in. That answer depends on
      // the password, so it is braked like a sign-in, or sign-up would be a
      // way round the guessing limit.
      checkThrottle(normalized);
      const rows = (await sql`select * from noesis_users where email = ${normalized}`) as UserRow[];
      const existing = rows[0] ? rowUser(rows[0]) : null;
      if (existing && (await passwordMatches(password, existing))) return dbSession(existing);
      noteFailure(normalized);
      throw new AuthError("An account already exists for this email. Sign in instead.", 409);
    }
    return dbSession(user);
  }

  // The hash is checked before taking the file lock, which it would otherwise hold.
  const existing = readFile().users.find((entry) => entry.email === normalized);
  if (existing) {
    checkThrottle(normalized);
    if (!(await passwordMatches(password, existing))) {
      noteFailure(normalized);
      throw new AuthError("An account already exists for this email. Sign in instead.", 409);
    }
  }
  return updateFile((store) => {
    const found = store.users.find((entry) => entry.email === normalized);
    if (found) return fileSession(store, found);
    store.users.push(user);
    return fileSession(store, user);
  });
};

export const signIn = async (email: string, password: string): Promise<AuthResponse> => {
  const normalized = normalizeEmail(email);
  checkThrottle(normalized);

  if (sql) {
    await ensureSchema();
    const rows = (await sql`select * from noesis_users where email = ${normalized}`) as UserRow[];
    const user = rows[0] ? rowUser(rows[0]) : null;
    if (!user || !(await passwordMatches(password, user))) {
      noteFailure(normalized);
      throw new AuthError("Invalid email or password.", 401);
    }
    return dbSession(user);
  }

  const known = readFile().users.find((entry) => entry.email === normalized);
  if (!known || !(await passwordMatches(password, known))) {
    noteFailure(normalized);
    throw new AuthError("Invalid email or password.", 401);
  }
  return updateFile((store) => {
    const user = store.users.find((entry) => entry.id === known.id);
    if (!user) throw new AuthError("Invalid email or password.", 401);
    return fileSession(store, user);
  });
};

export const userForToken = async (token: string | undefined): Promise<AuthUser | null> => {
  if (!token) return null;
  const tokenHash = hashToken(token);

  if (sql) {
    await ensureSchema();
    const cutoff = new Date(Date.now() - SESSION_MAX_AGE_MS).toISOString();
    const rows = (await sql`
      select u.id, u.email, u.created_at, s.created_at as seen_at
      from noesis_sessions s join noesis_users u on u.id = s.user_id
      where s.token_hash = ${tokenHash} and s.created_at > ${cutoff}
    `) as Array<{ id: string; email: string; created_at: string | Date; seen_at: string | Date }>;
    const row = rows[0];
    if (!row) return null;
    if (Date.now() - new Date(row.seen_at).getTime() > SESSION_TOUCH_MS) {
      await sql`update noesis_sessions set created_at = now() where token_hash = ${tokenHash}`;
    }
    return publicUser({ id: row.id, email: row.email, createdAt: new Date(row.created_at).toISOString() });
  }

  const store = readFile();
  const session = store.sessions.find((entry) => entry.tokenHash === tokenHash);
  if (!session || Date.now() - Date.parse(session.createdAt) > SESSION_MAX_AGE_MS) return null;
  const user = store.users.find((entry) => entry.id === session.userId);
  if (!user) return null;
  if (Date.now() - Date.parse(session.createdAt) > SESSION_TOUCH_MS) {
    updateFile((fresh) => {
      const mine = fresh.sessions.find((entry) => entry.tokenHash === tokenHash);
      if (mine) mine.createdAt = new Date().toISOString();
    });
  }
  return publicUser(user);
};

export const signOut = async (token: string | undefined): Promise<void> => {
  if (!token) return;
  const tokenHash = hashToken(token);
  if (sql) {
    await ensureSchema();
    await sql`delete from noesis_sessions where token_hash = ${tokenHash}`;
    return;
  }
  updateFile((store) => {
    store.sessions = store.sessions.filter((entry) => entry.tokenHash !== tokenHash);
  });
};

const RESET_TTL_MS = 60 * 60 * 1000;

/**
 * Starts a password reset. Returns the one-time token when the email exists, so
 * the caller can send it; the API always answers the same either way, to avoid
 * telling a stranger which addresses have accounts.
 */
export const startPasswordReset = async (email: string): Promise<{ token: string; email: string } | null> => {
  const normalized = normalizeEmail(email);
  const token = newToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();

  if (sql) {
    await ensureSchema();
    await sql`insert into noesis_reset_requests (email) values (${normalized})`;
    const rows = (await sql`select id from noesis_users where email = ${normalized}`) as Array<{ id: string }>;
    if (!rows[0]) return null;
    await sql`insert into noesis_password_resets (token_hash, user_id, expires_at)
      values (${tokenHash}, ${rows[0].id}, ${expiresAt})`;
    return { token, email: normalized };
  }

  return updateFile((store) => {
    store.resetRequests.push({ email: normalized, requestedAt: new Date().toISOString() });
    const user = store.users.find((entry) => entry.email === normalized);
    if (!user) return null;
    store.resets = [...store.resets.filter((entry) => Date.parse(entry.expiresAt) > Date.now()), { tokenHash, userId: user.id, expiresAt }];
    return { token, email: normalized };
  });
};

/** Sets a new password from a reset token and signs the learner in. */
export const completePasswordReset = async (token: string, password: string): Promise<AuthResponse> => {
  const tokenHash = hashToken(token);
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = await hashPassword(password, salt);
  const expired = new AuthError("That reset link has expired or was already used. Ask for a new one.", 400);

  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      update noesis_password_resets set used_at = now()
      where token_hash = ${tokenHash} and used_at is null and expires_at > now()
      returning user_id
    `) as Array<{ user_id: string }>;
    if (!rows[0]) throw expired;
    const userId = rows[0].user_id;
    const updated = (await sql`
      update noesis_users set password_hash = ${passwordHash}, salt = ${salt}
      where id = ${userId} returning id, email, created_at
    `) as UserRow[];
    if (!updated[0]) throw expired;
    // Every existing session belongs to whoever knew the old password.
    await sql`delete from noesis_sessions where user_id = ${userId}`;
    return dbSession({ ...rowUser({ ...updated[0], password_hash: passwordHash, salt }) });
  }

  return updateFile((store) => {
    const reset = store.resets.find((entry) => entry.tokenHash === tokenHash && !entry.usedAt);
    if (!reset || Date.parse(reset.expiresAt) < Date.now()) throw expired;
    const user = store.users.find((entry) => entry.id === reset.userId);
    if (!user) throw expired;
    reset.usedAt = new Date().toISOString();
    user.salt = salt;
    user.passwordHash = passwordHash;
    store.sessions = store.sessions.filter((session) => session.userId !== user.id);
    return fileSession(store, user);
  });
};

/** Public records for the given user ids (unknown ids are skipped). */
export const usersById = async (ids: string[]): Promise<Map<string, AuthUser>> => {
  if (!ids.length) return new Map();
  if (sql) {
    await ensureSchema();
    const rows = (await sql`select id, email, created_at from noesis_users where id = any(${ids})`) as Array<{
      id: string;
      email: string;
      created_at: string | Date;
    }>;
    return new Map(
      rows.map((row) => [row.id, publicUser({ id: row.id, email: row.email, createdAt: new Date(row.created_at).toISOString() })])
    );
  }
  const wanted = new Set(ids);
  return new Map(
    readFile()
      .users.filter((user) => wanted.has(user.id))
      .map((user) => [user.id, publicUser(user)])
  );
};
