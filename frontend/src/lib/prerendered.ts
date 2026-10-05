/**
 * True when this page arrived as prerendered HTML (scripts/prerender.mjs).
 *
 * Read once, before React renders over it. The landing hero's entrance
 * animation is skipped in that case: its text is already on screen, and
 * fading it out to fade it back in would only make it blink.
 */
export const PRERENDERED =
  typeof document !== "undefined" && Boolean(document.getElementById("root")?.firstElementChild);
