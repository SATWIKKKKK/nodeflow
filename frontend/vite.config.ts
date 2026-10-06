import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { PUBLIC_PATHS } from "./src/lib/publicPages";

/** Signed-in pages: nothing on them for a search engine to read. */
const PRIVATE_PREFIXES = [
  "/problems",
  "/dashboard",
  "/problem-map",
  "/continue",
  "/classrooms",
  "/workspace",
  "/pricing",
  "/roadmap",
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/dev",
  "/api"
];

/**
 * Fills the site URL into index.html and writes robots.txt and sitemap.xml
 * for it. One variable, VITE_SITE_URL, moves the whole site to a new domain.
 */
function seo(siteUrl: string): Plugin {
  const today = new Date().toISOString().slice(0, 10);
  const priority = (path: string) =>
    path === "/" ? "1.0" : path === "/docs" ? "0.8" : "0.5";

  return {
    name: "noesis-seo",
    transformIndexHtml: (html) => html.replaceAll("__SITE_URL__", siteUrl),
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: [
          "User-agent: *",
          "Allow: /",
          ...PRIVATE_PREFIXES.map((path) => `Disallow: ${path}`),
          "",
          `Sitemap: ${siteUrl}/sitemap.xml`,
          ""
        ].join("\n")
      });
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...PUBLIC_PATHS.map(
            (path) =>
              `  <url><loc>${siteUrl}${path}</loc><lastmod>${today}</lastmod><changefreq>${
                path === "/" ? "weekly" : "monthly"
              }</changefreq><priority>${priority(path)}</priority></url>`
          ),
          "</urlset>",
          ""
        ].join("\n")
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const siteUrl = (env.VITE_SITE_URL || "https://noesis-dsa.vercel.app").replace(/\/$/, "");

  return {
    plugins: [react(), tailwindcss(), seo(siteUrl)],
    build: {
      chunkSizeWarningLimit: 1300,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            motion: ["framer-motion"],
            codemirror: ["@uiw/react-codemirror", "@codemirror/lang-python", "@codemirror/view"]
          }
        }
      }
    },
    server: {
      port: 5173,
      proxy: {
        "/api": "http://localhost:8787"
      }
    }
  };
});
