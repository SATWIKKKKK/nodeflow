import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Entry for the Vercel serverless function (see scripts/build-vercel.mjs).
 * Vercel has no Docker and a read-only filesystem, so the function serves the
 * problem bank while code execution and accounts report themselves as off.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
process.env.NOESIS_BACKEND_ROOT ??= path.join(here, "backend");
process.env.NOESIS_SANDBOX ??= "off";
process.env.NOESIS_ACCOUNTS ??= "off";

// Imported after the environment is set: modules read it while loading.
const { app } = await import("./app.js");

export default app;
