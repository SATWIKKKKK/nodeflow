import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The backend package root (holds data/ and docker/). A bundled deployment sets
 * NOESIS_BACKEND_ROOT, because import.meta.url then points at the bundle.
 */
export const backendRoot = process.env.NOESIS_BACKEND_ROOT
  ? path.resolve(process.env.NOESIS_BACKEND_ROOT)
  : path.resolve(fileURLToPath(new URL("..", import.meta.url)));

export const dataDir = path.join(backendRoot, "data");

/** The repository root, where DSA.json lives. */
export const repoRoot = path.resolve(backendRoot, "..");
