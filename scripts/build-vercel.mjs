// Builds a Vercel "prebuilt" deployment in .vercel/output (Build Output API v3):
// the static frontend plus one Node function that serves /api. Only public data
// is copied in: never auth, submission or classroom stores.
//
//   node scripts/build-vercel.mjs && vercel deploy --prebuilt --prod

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { prerender } from "./prerender.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".vercel", "output");
const func = path.join(output, "functions", "api.func");

const run = (command) => execSync(command, { cwd: root, stdio: "inherit" });
const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
};

fs.rmSync(output, { recursive: true, force: true });

run("npm run build --workspace shared");
run("npm run build --workspace frontend");
copy(path.join(root, "frontend", "dist"), path.join(output, "static"));

// Public pages as real HTML for search engines and link previews. Without
// Chromium this returns null and every route serves the plain shell.
const overrides = await prerender(path.join(root, "frontend", "dist"), path.join(output, "static"));

await build({
  entryPoints: [path.join(root, "backend", "src", "vercel.ts")],
  outfile: path.join(func, "index.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  // Express and friends still call require(); give the ESM bundle one.
  banner: { js: "import { createRequire as __noesisRequire } from 'node:module'; const require = __noesisRequire(import.meta.url);" },
  logLevel: "warning"
});

copy(path.join(root, "backend", "data", "reviewed-phase1.json"), path.join(func, "backend", "data", "reviewed-phase1.json"));
copy(path.join(root, "backend", "data", "problems"), path.join(func, "backend", "data", "problems"));
// Submit's generated stress suite (problem-src/stress.py).
copy(path.join(root, "backend", "data", "stress"), path.join(func, "backend", "data", "stress"));
copy(path.join(root, "DSA.json"), path.join(func, "DSA.json"));

fs.writeFileSync(
  path.join(func, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      // A traced Java run can take ~45s in the sandbox.
      maxDuration: 60,
      memory: 1024
    },
    null,
    2
  )
);

fs.writeFileSync(
  path.join(output, "config.json"),
  JSON.stringify(
    {
      version: 3,
      // `about.html` is served at /about, and so on for each prerendered page.
      ...(overrides ? { overrides } : {}),
      routes: [
        { src: "/api/(.*)", dest: "/api" },
        { src: "/assets/(.*)", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
        { handle: "filesystem" },
        // Everything else is the app: the plain shell when the landing page
        // has been prerendered into index.html, the shell itself otherwise.
        { src: "/(.*)", dest: overrides ? "/app.html" : "/index.html" }
      ]
    },
    null,
    2
  )
);

const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(path.relative(func, full));
  }
};
walk(func);
console.log(`Function files: ${files.length}\n  ${files.filter((file) => !file.includes("problems")).join("\n  ")}`);
