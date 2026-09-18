import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Postgres (Neon) when DATABASE_URL is set, otherwise null and every store
 * falls back to its JSON file under backend/data. Production on Vercel must use
 * Postgres: a function's filesystem is read-only and not shared.
 */
const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

export const sql: NeonQueryFunction<false, false> | null = url ? neon(url) : null;

export const usingDatabase = () => sql !== null;

let schemaReady: Promise<void> | null = null;

/** Creates the tables once per process; every statement is idempotent. */
export const ensureSchema = (): Promise<void> => {
  if (!sql) return Promise.resolve();
  if (!schemaReady) {
    const db = sql;
    schemaReady = (async () => {
      await db`create table if not exists noesis_users (
        id text primary key,
        email text not null unique,
        password_hash text not null,
        salt text not null,
        created_at timestamptz not null default now()
      )`;
      await db`create table if not exists noesis_sessions (
        token_hash text primary key,
        user_id text not null references noesis_users(id) on delete cascade,
        created_at timestamptz not null default now()
      )`;
      await db`create index if not exists noesis_sessions_user on noesis_sessions(user_id)`;
      await db`create table if not exists noesis_reset_requests (
        id bigserial primary key,
        email text not null,
        requested_at timestamptz not null default now()
      )`;
      await db`create table if not exists noesis_password_resets (
        token_hash text primary key,
        user_id text not null references noesis_users(id) on delete cascade,
        expires_at timestamptz not null,
        used_at timestamptz,
        created_at timestamptz not null default now()
      )`;
      await db`create table if not exists noesis_submissions (
        id text primary key,
        user_id text not null,
        problem_id text not null,
        language text not null,
        code text not null,
        verdict text not null,
        runtime_ms integer not null,
        created_at timestamptz not null default now()
      )`;
      await db`create index if not exists noesis_submissions_user on noesis_submissions(user_id, created_at)`;
      await db`create table if not exists noesis_classrooms (
        id text primary key,
        owner_id text not null,
        join_code text not null unique,
        version integer not null default 0,
        data jsonb not null,
        created_at timestamptz not null default now()
      )`;
      await db`create index if not exists noesis_classrooms_owner on noesis_classrooms(owner_id)`;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
};
