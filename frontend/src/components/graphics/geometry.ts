/**
 * Path maths for the illustration primitives. Kept apart from the components so
 * the numbers that define the drawing style live in one place.
 */

const radius = 22;
const stroke = 2.5;
const edge = 2;
const gap = 8;

const sign = (value: number) => (value < 0 ? -1 : 1);

/**
 * Edge between two nodes on a row, stopping `gap` short of each circle so the
 * chevron never touches the outline.
 */
const straightEdge = (x1: number, x2: number, y: number, r = radius, space = gap) => {
  const dir = sign(x2 - x1);
  return `M ${x1 + dir * (r + space)} ${y} L ${x2 - dir * (r + space)} ${y}`;
};

/**
 * Back-pointers dip under the row, so a reversed list never draws an arrow on
 * top of the forward one it replaced.
 */
const curvedEdge = (x1: number, x2: number, y: number, r = radius, depth?: number) => {
  const dir = sign(x2 - x1);
  const lift = depth ?? 26 + Math.abs(x2 - x1) * 0.07;
  const sx = x1 + dir * 8;
  const ex = x2 - dir * 9;
  const sy = y + r - 2;
  const ey = y + r + 6;
  return `M ${sx} ${sy} C ${sx} ${sy + lift}, ${ex} ${ey + lift}, ${ex} ${ey}`;
};

/** Null: a stub from the node ending in a vertical bar. */
const nullStub = (x: number, y: number, r = radius, space = gap, length = 26) => {
  const start = x + r + space;
  const end = start + length;
  return `M ${start} ${y} H ${end} M ${end} ${y - 7} V ${y + 7}`;
};

/** A bar on its own, for "stops here" marks that are not attached to a node. */
const stopBar = (x: number, y: number, half = 7) => `M ${x} ${y - half} V ${y + half}`;

/** Rounded rectangle path, for sandbox walls and code blocks. */
const roundedRect = (x: number, y: number, w: number, h: number, r: number) =>
  `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} ` +
  `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} ` +
  `V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;

export const geometry = {
  radius,
  stroke,
  edge,
  gap,
  straightEdge,
  curvedEdge,
  nullStub,
  stopBar,
  roundedRect
};
