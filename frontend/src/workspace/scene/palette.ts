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
    // Blue blocks on the light canvas; the active one goes deeper, not darker.
    node: new THREE.Color("#2f6fe0"),
    nodeActive: new THREE.Color("#12327d"),
    nodeSelected: new THREE.Color("#7d9fd6"),
    // Labels float above the blocks, so they contrast with the canvas, not the block.
    label: "#1a1a1a",
    edge: new THREE.Color("#b9b1b1"),
    edgeActive: new THREE.Color("#2f6fe0")
  },
  dark: {
    background: "#171717",
    gridCell: "#232323",
    gridSection: "#343434",
    shadowOpacity: 0.4,
    // The hero word's blue on the dark canvas; the active one is brighter still.
    node: new THREE.Color("#9ecbff"),
    nodeActive: new THREE.Color("#dcecff"),
    nodeSelected: new THREE.Color("#6f93bd"),
    label: "#f4f4f4",
    edge: new THREE.Color("#4d4d4d"),
    edgeActive: new THREE.Color("#9ecbff")
  }
};
