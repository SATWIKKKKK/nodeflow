// Prerenders the public pages into static HTML, so search engines and link
// previews get the real text, title, description and canonical of each page
// from the first byte instead of an empty app shell.
//
// Serves the built frontend, opens each public page in headless Chromium,
// waits for it to settle and saves the rendered document. Pages behind
// sign-in are not prerendered; they keep the plain shell (app.html).
//
//   node scripts/prerender.mjs <built dir> <output dir>
//
// Exported for build-vercel.mjs. Needs Playwright's Chromium; without it the
// build carries on with the plain shell and says so.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The public paths, read from the one list the app and the sitemap use. */
const publicPaths = () => {
  const source = fs.readFileSync(path.join(root, "frontend", "src", "lib", "publicPages.ts"), "utf8");
  const block = source.slice(source.indexOf("PUBLIC_META"));
  return [...block.matchAll(/^\s{2}"(\/[^"]*)":\s*\{/gm)].map((match) => match[1]);
};

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json"
};

/** A static server for the build, with the app's fallback and /api proxied. */
const serve = (dir, apiOrigin) =>
  new Promise((resolve) => {
    const server = http.createServer(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        try {
          const upstream = await fetch(`${apiOrigin}${url.pathname}${url.search}`, { method: request.method });
          response.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") ?? "application/json" });
          response.end(Buffer.from(await upstream.arrayBuffer()));
        } catch {
          response.writeHead(502).end();
        }
        return;
      }
      let file = path.join(dir, decodeURIComponent(url.pathname));
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        file = path.join(dir, "index.html");
      }
      response.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
      fs.createReadStream(file).pipe(response);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });

/**
 * Renders every public page. Returns the overrides Vercel needs to serve
 * `about.html` at `/about`, or null when Chromium is not available.
 */
export async function prerender(builtDir, outDir, { apiOrigin = process.env.PRERENDER_API ?? "https://noesis-dsa.vercel.app" } = {}) {
  let chromium;
  try {
    ({ chromium } = createRequire(path.join(root, "frontend", "package.json"))("playwright"));
  } catch {
    console.warn("prerender: Playwright is not installed; public pages ship as the plain app shell.");
    return null;
  }

  const shell = fs.readFileSync(path.join(builtDir, "index.html"), "utf8");
  const server = await serve(builtDir, apiOrigin);
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch();
  } catch (error) {
    server.close();
    console.warn(`prerender: Chromium could not start (${error.message.split("\n")[0]}); shipping the plain shell.`);
    return null;
  }

  const overrides = {};
  try {
    for (const route of publicPaths()) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const html = await page.evaluate(() => `<!doctype html>\n${document.documentElement.outerHTML}`);
      await page.close();

      if (!html.includes('id="root"><') || html.includes('id="root"></div>')) {
        throw new Error(`${route} rendered nothing`);
      }
      const file = route === "/" ? "index.html" : `${route.slice(1)}.html`;
      fs.writeFileSync(path.join(outDir, file), html);
      if (route !== "/") overrides[file] = { path: route.slice(1) };
      console.log(`prerender: ${route} -> ${file}`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  // Every other route is the app itself: the plain shell, not the landing page.
  fs.writeFileSync(path.join(outDir, "app.html"), shell);
  return overrides;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [builtDir, outDir] = process.argv.slice(2);
  const result = await prerender(path.resolve(builtDir), path.resolve(outDir ?? builtDir));
  console.log(JSON.stringify(result, null, 2));
}
