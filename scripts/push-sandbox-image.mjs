// Builds backend/docker/vercel/Dockerfile and pushes it to Vercel Container
// Registry, where Vercel Sandbox boots it (see backend/src/execution/vercelSandbox.ts).
// The tag is a content hash of the Dockerfile and every harness file it copies,
// so a tracer change becomes a new image instead of silently reusing the old one.
//
//   node scripts/push-sandbox-image.mjs            # build + push, prints the tag
//   node scripts/push-sandbox-image.mjs --tag-only # just print the tag
//
// Requires Docker, a linked Vercel project (`vercel link`) and a registry login
// (`npx vercel@latest vcr login docker`).

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const repository = process.env.NOESIS_SANDBOX_REPOSITORY ?? "noesis-runner";

const filesUnder = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "__pycache__" ? [] : filesUnder(full);
      return [full];
    })
    .sort();

const inputs = [
  path.join(backend, "docker", "vercel", "Dockerfile"),
  path.join(backend, "docker", "vercel", "nf-run"),
  ...filesUnder(path.join(backend, "src", "execution", "python")),
  ...filesUnder(path.join(backend, "src", "execution", "cpp")),
  ...filesUnder(path.join(backend, "src", "execution", "java")),
  ...filesUnder(path.join(backend, "src", "execution", "common"))
];

const hash = crypto.createHash("sha1");
for (const file of inputs) {
  hash.update(path.relative(backend, file).split(path.sep).join("/"));
  hash.update(fs.readFileSync(file));
}
const version = hash.digest("hex").slice(0, 12);
const tag = `${repository}:${version}`;

if (process.argv.includes("--tag-only")) {
  console.log(tag);
  process.exit(0);
}

// shell: true so `npx` resolves to npx.cmd on Windows.
const run = (command, args, options = {}) =>
  execFileSync(command, args, { cwd: backend, stdio: "inherit", shell: true, ...options });

/**
 * The image's full name inside Vercel Container Registry, which includes the
 * team and project slugs. `vcr push` prints the reference it would push, so ask
 * it rather than guessing. NOESIS_VCR_PATH skips the lookup.
 */
const registryRef = () => {
  if (process.env.NOESIS_VCR_PATH) return `${process.env.NOESIS_VCR_PATH}/${tag}`;
  let output = "";
  try {
    output = execFileSync("npx", ["--yes", "vercel@latest", "vcr", "push", "docker", tag, "--cwd", root], {
      cwd: backend,
      shell: true,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    // Expected before the image is tagged locally: the output still names the reference.
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  const found = output.match(/vcr\.vercel\.com\/[^\s"'[\]]+/);
  if (!found) throw new Error(`Could not work out the registry path.\n${output}`);
  const [name] = found[0].split(/[:@]/);
  return `${name}:${version}`;
};

console.log(`Building ${tag}…`);
// A plain single-platform amd64 image: Sandbox cannot boot a multi-platform
// index, which is what buildx produces by default (with attestations).
run("docker", [
  "buildx",
  "build",
  "--platform",
  "linux/amd64",
  "--provenance=false",
  "--sbom=false",
  "--load",
  "-t",
  tag,
  "-f",
  path.join("docker", "vercel", "Dockerfile"),
  "."
]);

const ref = registryRef();
const latest = `${ref.split(":")[0]}:latest`;
console.log(`Pushing ${ref}…`);
run("docker", ["tag", tag, ref]);
run("docker", ["push", ref]);
// `latest` as well, so a deployment without NOESIS_SANDBOX_IMAGE still boots.
run("docker", ["tag", tag, latest]);
run("docker", ["push", latest]);

console.log(`\nDone. Point the deployment at this image:\n  NOESIS_SANDBOX_IMAGE=${tag}`);
