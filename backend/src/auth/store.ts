import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AuthResponse, AuthUser } from "@nodeflow/shared";

interface StoredUser extends AuthUser {
  passwordHash: string;
  salt: string;
}

interface StoredSession {
  tokenHash: string;
  userId: string;
  createdAt: string;
}

interface AuthStore {
  users: StoredUser[];
  sessions: StoredSession[];
  resetRequests: Array<{ email: string; requestedAt: string }>;
}

const backendRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const dataDir = path.join(backendRoot, "data");
const authPath = path.join(dataDir, "auth.json");
const lockPath = `${authPath}.lock`;

const emptyStore = (): AuthStore => ({
  users: [],
  sessions: [],
  resetRequests: []
});

const readStore = (): AuthStore => {
  if (!fs.existsSync(authPath)) return emptyStore();
  return { ...emptyStore(), ...(JSON.parse(fs.readFileSync(authPath, "utf8")) as Partial<AuthStore>) };
};

const writeStore = (store: AuthStore) => {
  fs.mkdirSync(dataDir, { recursive: true });
  const tempPath = `${authPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, authPath);
};

const waitSync = (ms: number) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

const acquireStoreLock = () => {
  fs.mkdirSync(dataDir, { recursive: true });
  const started = Date.now();

  while (true) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`, "utf8");
      return () => {
        fs.closeSync(fd);
        fs.rmSync(lockPath, { force: true });
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;

      try {
        const lockAge = Date.now() - fs.statSync(lockPath).mtimeMs;
        if (lockAge > 15_000) {
          fs.rmSync(lockPath, { force: true });
          continue;
        }
      } catch {
        continue;
      }

      if (Date.now() - started > 15_000) {
        throw new Error("Auth store is busy. Please try again.");
      }

      waitSync(25);
    }
  }
};

const updateStore = <T>(mutate: (store: AuthStore) => T): T => {
  const release = acquireStoreLock();
  try {
    const store = readStore();
    const result = mutate(store);
    writeStore(store);
    return result;
  } finally {
    release();
  }
};

const publicUser = (user: StoredUser): AuthUser => ({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt
});

const hashPassword = (password: string, salt: string) =>
  crypto.scryptSync(password, salt, 64).toString("hex");

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

const createSession = (store: AuthStore, user: StoredUser): AuthResponse => {
  const token = crypto.randomBytes(32).toString("base64url");
  store.sessions = store.sessions.filter((session) => session.userId !== user.id).slice(-100);
  store.sessions.push({
    tokenHash: hashToken(token),
    userId: user.id,
    createdAt: new Date().toISOString()
  });
  return { user: publicUser(user), token };
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const signUp = (email: string, password: string): AuthResponse => {
  return updateStore((store) => {
    const normalized = normalizeEmail(email);
    const existing = store.users.find((user) => user.email === normalized);
    if (existing) {
      throw new Error("An account already exists for this email.");
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const user: StoredUser = {
      id: `user_${crypto.randomUUID()}`,
      email: normalized,
      createdAt: new Date().toISOString(),
      salt,
      passwordHash: hashPassword(password, salt)
    };
    store.users.push(user);
    return createSession(store, user);
  });
};

export const signIn = (email: string, password: string): AuthResponse => {
  return updateStore((store) => {
    const normalized = normalizeEmail(email);
    const user = store.users.find((entry) => entry.email === normalized);
    if (!user || hashPassword(password, user.salt) !== user.passwordHash) {
      throw new Error("Invalid email or password.");
    }

    return createSession(store, user);
  });
};

export const userForToken = (token: string | undefined): AuthUser | null => {
  if (!token) return null;
  const store = readStore();
  const session = store.sessions.find((entry) => entry.tokenHash === hashToken(token));
  if (!session) return null;
  const user = store.users.find((entry) => entry.id === session.userId);
  return user ? publicUser(user) : null;
};

export const signOut = (token: string | undefined) => {
  if (!token) return;
  updateStore((store) => {
    store.sessions = store.sessions.filter((entry) => entry.tokenHash !== hashToken(token));
  });
};

export const recordResetRequest = (email: string) => {
  updateStore((store) => {
    store.resetRequests.push({ email: normalizeEmail(email), requestedAt: new Date().toISOString() });
  });
};
