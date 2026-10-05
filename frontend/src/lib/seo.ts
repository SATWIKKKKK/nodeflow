import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { DEFAULT_DESCRIPTION, PUBLIC_META, type PageMeta } from "./publicPages";

/**
 * Search and share metadata, one source for every page.
 *
 * The site URL comes from VITE_SITE_URL, so moving to a custom domain is one
 * environment variable and a rebuild: canonical links, social cards, the
 * sitemap and robots.txt all follow it.
 */
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "https://noesis-dsa.vercel.app").replace(/\/$/, "");
export const SITE_NAME = "Noesis";
export { PUBLIC_META, PUBLIC_PATHS } from "./publicPages";

const setMeta = (selector: string, attribute: string, key: string, content: string) => {
  let element = document.head.querySelector<HTMLElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
};

const setCanonical = (href: string) => {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
};

/**
 * Keeps the document head in step with the route: title, description,
 * canonical, social cards and robots. Public pages use their own entry above;
 * anything else is a signed-in page and is kept out of search results.
 */
export function useRouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const known = PUBLIC_META[pathname];
    const meta: PageMeta = known ?? {
      title: `${SITE_NAME} — DSA workspace`,
      description: DEFAULT_DESCRIPTION,
      noindex: true
    };
    const url = `${SITE_URL}${pathname === "/" ? "/" : pathname}`;

    document.title = meta.title;
    setMeta('meta[name="description"]', "name", "description", meta.description);
    setMeta('meta[name="robots"]', "name", "robots", meta.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
    setMeta('meta[property="og:title"]', "property", "og:title", meta.title);
    setMeta('meta[property="og:description"]', "property", "og:description", meta.description);
    setMeta('meta[property="og:url"]', "property", "og:url", url);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", meta.title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", meta.description);
    setCanonical(known ? url : `${SITE_URL}/`);
  }, [pathname]);
}
