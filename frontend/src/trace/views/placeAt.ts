import type { CSSProperties } from "react";

/**
 * Positions an SVG group with a CSS transform that eases between steps.
 * Used on a plain <g>: framer-motion's animated x/y can stop following its target when
 * AnimatePresence reorders siblings (a tree node becoming another's child), leaving a node
 * behind its edges, and it ignores later style.transform updates. A CSS transition always lands.
 */
export const placeAt = (x: number, y: number): CSSProperties => ({
  transform: `translate(${x}px, ${y}px)`,
  transition: "transform 380ms cubic-bezier(0.4, 0, 0.2, 1)"
});
