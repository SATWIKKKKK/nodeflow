import * as THREE from "three";

/**
 * Node value labels rendered to cached canvas textures.
 *
 * Deliberately not drei's <Text>: troika fetches its default typeface from a CDN,
 * and Noesis has to keep working with no network. Textures are cached per label
 * and colour, so a 50-node scene of small integers builds a handful of textures.
 */

const cache = new Map<string, THREE.CanvasTexture>();

const WIDTH = 256;
const HEIGHT = 128;

export function labelTexture(label: string, color: string): THREE.CanvasTexture {
  const key = `${color}|${label}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = color;
  context.font = "500 60px 'JetBrains Mono', ui-monospace, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, WIDTH / 2, HEIGHT / 2, WIDTH * 0.86);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  cache.set(key, texture);
  return texture;
}
