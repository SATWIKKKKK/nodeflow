import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Entry for the Vercel serverless function (see scripts/build-vercel.mjs).
 * Vercel has no Docker and a read-only filesystem, so code runs in Vercel
 * Sandbox and accounts live in Postgres. Both switch themselves off (with a
 * clear message in the UI) when their configuration is missing.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
process.env.NOESIS_BACKEND_ROOT ??= path.join(here, "backend");
// Code runs in Vercel Sandbox (a microVM), since functions cannot start Docker.
process.env.NOESIS_SANDBOX ??= "vercel";
// Accounts need a database: a function's filesystem is read-only.
process.env.NOESIS_ACCOUNTS ??= process.env.DATABASE_URL || process.env.POSTGRES_URL ? "on" : "off";

// Imported after the environment is set: modules read it while loading.
const { app } = await import("./app.js");

export default app;
