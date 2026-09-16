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
    node: new THREE.Color("#ffffff"),
    nodeActive: new THREE.Color("#1a1a1a"),
    nodeSelected: new THREE.Color("#d6d0d0"),
    label: "#1a1a1a",
    edge: new THREE.Color("#b9b1b1"),
    edgeActive: new THREE.Color("#1a1a1a")
  },
  dark: {
    background: "#171717",
    gridCell: "#232323",
    gridSection: "#343434",
    shadowOpacity: 0.4,
    node: new THREE.Color("#3d3d3d"),
    nodeActive: new THREE.Color("#f3ecec"),
    nodeSelected: new THREE.Color("#6a6a6a"),
    label: "#f4f4f4",
    edge: new THREE.Color("#4d4d4d"),
    edgeActive: new THREE.Color("#f3ecec")
  }
};
