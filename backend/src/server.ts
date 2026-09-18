import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.js";

// Local development reads .env.local (DATABASE_URL, VERCEL_OIDC_TOKEN, …), the
// same file `vercel env pull` writes; Vercel injects env vars itself. The app is
// imported afterwards, because its modules read the environment as they load.
for (const file of [path.join(repoRoot, ".env.local"), path.join(repoRoot, "backend", ".env.local")]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

const { app } = await import("./app.js");

const port = Number(process.env.PORT ?? 8787);

app.listen(port, () => {
  const sandbox = process.env.NOESIS_SANDBOX ?? "docker";
  const store = process.env.DATABASE_URL || process.env.DB_URL || process.env.POSTGRES_URL ? "postgres" : "json files";
  console.log(`Noesis backend listening on http://localhost:${port} (sandbox: ${sandbox}, store: ${store})`);
});
