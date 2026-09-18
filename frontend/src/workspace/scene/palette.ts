import * as THREE from "three";
import type { ResolvedTheme } from "../../lib/theme";

/**
 * Scene colours, mirrored from the design tokens in index.css. WebGL cannot
 * read CSS variables, so each theme gets its own resolved set.
 */
export interface ScenePalette {
  background: string;
  gridCell: string;
  gridSection: string;
  shadowOpacity: number;
  node: THREE.Color;
  nodeActive: THREE.Color;
  nodeSelected: THREE.Color;
  label: string;
  edge: THREE.Color;
  edgeActive: THREE.Color;
}

export const scenePalettes: Record<ResolvedTheme, ScenePalette> = {
  light: {
    background: "#ffffff",
    gridCell: "#ece8e8",
    gridSection: "#d9d2d2",
    shadowOpacity: 0.12,
    // Dark blocks on the light canvas; the active block takes the hero accent blue.
    node: new THREE.Color("#1a1a1a"),
    nodeActive: new THREE.Color("#123d8a"),
    nodeSelected: new THREE.Color("#5a5a5a"),
    // Labels float above the blocks, so they contrast with the canvas, not the block.
    label: "#1a1a1a",
    edge: new THREE.Color("#b9b1b1"),
    edgeActive: new THREE.Color("#1a1a1a")
  },
  dark: {
    background: "#171717",
    gridCell: "#232323",
    gridSection: "#343434",
    shadowOpacity: 0.4,
    // Light blocks on the dark canvas.
    node: new THREE.Color("#ece8e8"),
    nodeActive: new THREE.Color("#93c5fd"),
    nodeSelected: new THREE.Color("#b5b0b0"),
    label: "#f4f4f4",
    edge: new THREE.Color("#4d4d4d"),
    edgeActive: new THREE.Color("#f3ecec")
  }
};
