import { useLayoutEffect, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Flow } from "../model";
import { ArrowMarkers } from "./ArrowMarkers";

/**
 * Connectors between rows: where a value that just arrived came from, or which
 * element turned another out of a stack.
 *
 * Measured rather than calculated, because the rows sit in separate sections
 * that size themselves to their contents. And routed rather than drawn
 * straight, because a straight line between two cells in different structures
 * crosses everything stacked between them: the source's own index and pointer
 * badges, the next structure's heading, its type label. A connector that cuts
 * a glyph in half makes the drawing harder to read than no connector at all.
 *
 * The route keeps to three kinds of space that hold no text by construction:
 *
 *   - the band between a row's heading and its cells, which is where a
 *     connector leaves and where it arrives, from the top of the cell;
 *   - the left gutter outside every structure, where it travels between them;
 *   - the band above a row, for an arc between two cells of the same row.
 *
 * Every glyph and every other cell on screen is an obstacle. Each band's height
 * is chosen between the nearest obstacle above it and the cell, and the gutter
 * sits clear of the leftmost obstacle anywhere along the way, so the route is
 * derived from what is actually there rather than from offsets that would
 * silently go wrong the moment a label grows.
 */

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const PAD = 2;
const CORNER = 7;
const GUTTER = 10;

const toLocal = (rect: DOMRect, origin: DOMRect): Box => ({
  left: rect.left - origin.left,
  top: rect.top - origin.top,
  right: rect.right - origin.left,
  bottom: rect.bottom - origin.top
});

/** Every glyph and cell in the drawing, except the two ends of this connector. */
const obstaclesIn = (container: HTMLElement, origin: DOMRect, skip: Element[]): Box[] => {
  const out: Box[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const owner = node.parentElement;
    if (!owner || !node.textContent?.trim()) continue;
    if (owner.closest("[data-flow-layer]")) continue;
    if (skip.some((element) => element.contains(owner))) continue;
    // A badge or pill is as big as its outline, not its glyph: a line that
    // clips the rim of a pointer badge crosses it just as surely.
    const style = getComputedStyle(owner);
    const outlined =
      owner.namespaceURI !== "http://www.w3.org/2000/svg" &&
      (parseFloat(style.borderTopWidth) > 0 || !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(style.backgroundColor));
    if (outlined && owner.getBoundingClientRect().width < 160) {
      out.push(toLocal(owner.getBoundingClientRect(), origin));
      continue;
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (rect.width > 0.5 && rect.height > 0.5) out.push(toLocal(rect, origin));
    }
  }
  for (const cell of container.querySelectorAll("[data-flow]")) {
    if (skip.includes(cell)) continue;
    out.push(toLocal(cell.getBoundingClientRect(), origin));
  }
  return out;
};

const overlapsX = (box: Box, from: number, to: number) =>
  box.right > Math.min(from, to) - PAD && box.left < Math.max(from, to) + PAD;
const overlapsY = (box: Box, from: number, to: number) =>
  box.bottom > Math.min(from, to) - PAD && box.top < Math.max(from, to) + PAD;

/**
 * The height of the band just above a cell, clear of anything above it.
 *
 * The band runs from the cell across to `toX`, so only obstacles lying across
 * that stretch count. The line sits midway between the lowest of them and the
 * cell's top edge, which keeps it off both.
 */
const bandAbove = (cell: Box, toX: number, obstacles: Box[]) => {
  let ceiling = cell.top - 16;
  for (const box of obstacles) {
    if (box.bottom > cell.top - 0.5) continue;
    if (!overlapsX(box, cell.left + (cell.right - cell.left) / 2, toX)) continue;
    ceiling = Math.max(ceiling, box.bottom);
  }
  return Math.min(cell.top - 2, (ceiling + cell.top) / 2);
};

type Point = [number, number];

/** Does an axis-aligned segment pass through any obstacle? */
const crosses = (a: Point, b: Point, obstacles: Box[]) =>
  obstacles.some(
    (box) =>
      Math.max(a[0], b[0]) > box.left - PAD &&
      Math.min(a[0], b[0]) < box.right + PAD &&
      Math.max(a[1], b[1]) > box.top - PAD &&
      Math.min(a[1], b[1]) < box.bottom + PAD
  );

const clear = (points: Point[], obstacles: Box[]) =>
  points.every((point, at) => at === 0 || !crosses(points[at - 1], point, obstacles));

const BEND = 24;

/**
 * The fallback for a cramped drawing: the shortest orthogonal route with the
 * fewest turns through the free space between obstacles.
 *
 * The lanes are the gaps between obstacles — every edge of every box, pushed
 * out by the padding, and the midline of each gap, so a route runs down the
 * middle of a corridor rather than scraping one side of it. Search runs over
 * lane crossings, with a turn costing as much as a short run, and has to leave
 * the source going up and reach the target coming down, which is how every
 * other connector here meets its cells.
 */
const search = (start: Point, end: Point, obstacles: Box[]): Point[] | null => {
  const margin = 90;
  const window = {
    left: Math.min(start[0], end[0]) - margin,
    right: Math.max(start[0], end[0]) + margin,
    top: Math.min(start[1], end[1]) - margin,
    bottom: Math.max(start[1], end[1]) + margin
  };
  const near = obstacles.filter(
    (box) => box.right > window.left && box.left < window.right && box.bottom > window.top && box.top < window.bottom
  );
  const lanes = (edges: number[], ends: number[]) => {
    const sorted = [...new Set(edges.map((value) => Math.round(value)))].sort((a, b) => a - b);
    const middles = sorted.slice(1).map((value, at) => (value + sorted[at]) / 2);
    return [...new Set([...sorted, ...middles, ...ends])].sort((a, b) => a - b);
  };
  const xs = lanes(
    near.flatMap((box) => [box.left - PAD - 4, box.right + PAD + 4]).concat(window.left, window.right),
    [start[0], end[0]]
  );
  const ys = lanes(
    near.flatMap((box) => [box.top - PAD - 4, box.bottom + PAD + 4]).concat(window.top, window.bottom),
    [start[1], end[1]]
  );
  const W = xs.length;
  const H = ys.length;
  const id = (i: number, j: number, dir: number) => (j * W + i) * 4 + dir;
  // Directions: 0 up, 1 right, 2 down, 3 left.
  const step = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
  ];
  const cost = new Float64Array(W * H * 4).fill(Infinity);
  const back = new Int32Array(W * H * 4).fill(-1);
  const si = xs.indexOf(start[0]);
  const sj = ys.indexOf(start[1]);
  const ei = xs.indexOf(end[0]);
  const ej = ys.indexOf(end[1]);
  const heap: Array<[number, number]> = [];
  const push = (state: number, value: number) => {
    heap.push([value, state]);
    for (let at = heap.length - 1; at > 0; ) {
      const parent = (at - 1) >> 1;
      if (heap[parent][0] <= heap[at][0]) break;
      [heap[parent], heap[at]] = [heap[at], heap[parent]];
      at = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let at = 0; ; ) {
        const l = at * 2 + 1;
        const r = l + 1;
        let low = at;
        if (l < heap.length && heap[l][0] < heap[low][0]) low = l;
        if (r < heap.length && heap[r][0] < heap[low][0]) low = r;
        if (low === at) break;
        [heap[low], heap[at]] = [heap[at], heap[low]];
        at = low;
      }
    }
    return top;
  };
  const first = id(si, sj, 0);
  cost[first] = 0;
  push(first, 0);
  let found = -1;
  while (heap.length) {
    const [value, state] = pop();
    if (value > cost[state]) continue;
    const dir = state % 4;
    const cell = (state - dir) / 4;
    const i = cell % W;
    const j = (cell - i) / W;
    if (i === ei && j === ej && dir === 2) {
      found = state;
      break;
    }
    for (let turn = 0; turn < 4; turn += 1) {
      if (turn === (dir + 2) % 4) continue;
      const ni = i + step[turn][0];
      const nj = j + step[turn][1];
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const from: Point = [xs[i], ys[j]];
      const to: Point = [xs[ni], ys[nj]];
      if (crosses(from, to, near)) continue;
      const next = id(ni, nj, turn);
      const total = value + Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]) + (turn === dir ? 0 : BEND);
      if (total < cost[next]) {
        cost[next] = total;
        back[next] = state;
        push(next, total);
      }
    }
  }
  if (found < 0) return null;
  const points: Point[] = [];
  for (let state = found; state >= 0; state = back[state]) {
    const cell = (state - (state % 4)) / 4;
    points.unshift([xs[cell % W], ys[Math.floor(cell / W)]]);
  }
  // Keep only the corners.
  return points.filter((point, at) => {
    if (at === 0 || at === points.length - 1) return true;
    const [px, py] = points[at - 1];
    const [nx, ny] = points[at + 1];
    return !((px === point[0] && point[0] === nx) || (py === point[1] && point[1] === ny));
  });
};

/** A polyline drawn with its corners rounded, so it reads as one stroke. */
export const rounded = (points: Array<[number, number]>) => {
  const kept = points.filter(
    (point, at) => at === 0 || Math.hypot(point[0] - points[at - 1][0], point[1] - points[at - 1][1]) > 0.5
  );
  let d = `M ${kept[0][0]} ${kept[0][1]}`;
  for (let at = 1; at < kept.length - 1; at += 1) {
    const [px, py] = kept[at - 1];
    const [cx, cy] = kept[at];
    const [nx, ny] = kept[at + 1];
    const into = Math.min(CORNER, Math.hypot(cx - px, cy - py) / 2);
    const out = Math.min(CORNER, Math.hypot(nx - cx, ny - cy) / 2);
    const ax = cx - (Math.sign(cx - px) * into);
    const ay = cy - (Math.sign(cy - py) * into);
    const bx = cx + (Math.sign(nx - cx) * out);
    const by = cy + (Math.sign(ny - cy) * out);
    d += ` L ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;
  }
  const last = kept[kept.length - 1];
  return `${d} L ${last[0]} ${last[1]}`;
};

export function FlowLinks({
  flows,
  host,
  revision
}: {
  flows: Flow[];
  host: RefObject<HTMLElement | null>;
  revision: unknown;
}) {
  const [paths, setPaths] = useState<Array<{ key: string; d: string; kind: Flow["kind"] }>>([]);

  useLayoutEffect(() => {
    const container = host.current;
    if (!container || flows.length === 0) {
      setPaths([]);
      return;
    }
    // The cells glide to their new places when a row grows or shrinks, so a
    // route measured now is a route to where they were. Measure again as the
    // layout moves and once more after it has come to rest.
    let frame = 0;
    const again = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setPaths(route(container)));
    };
    setPaths(route(container));
    const observer = new ResizeObserver(again);
    observer.observe(container);
    const timers = [120, 280, 520].map((delay) => window.setTimeout(again, delay));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [flows, host, revision]);

  function route(container: HTMLElement) {
    const origin = container.getBoundingClientRect();

    const next: Array<{ key: string; d: string; kind: Flow["kind"] }> = [];
    for (const flow of flows) {
      const fromCell = container.querySelector(`[data-flow="${flow.from}"]`);
      const toCell = container.querySelector(`[data-flow="${flow.to}"]`);
      if (!fromCell || !toCell) continue;
      const from = toLocal(fromCell.getBoundingClientRect(), origin);
      const to = toLocal(toCell.getBoundingClientRect(), origin);
      const obstacles = obstaclesIn(container, origin, [fromCell, toCell]);
      const sx = (from.left + from.right) / 2;
      const tx = (to.left + to.right) / 2;

      // One row: an arc over it, in the band above the cells.
      if (Math.abs(from.top - to.top) < 12) {
        const y = Math.min(bandAbove(from, tx, obstacles), bandAbove(to, sx, obstacles));
        next.push({
          key: flow.key,
          kind: flow.kind,
          d: rounded([
            [sx, from.top],
            [sx, y],
            [tx, y],
            [tx, to.top - 1]
          ])
        });
        continue;
      }

      // Between rows: up out of the source, across to the gutter, along it,
      // then in over the target. The gutter sits left of every obstacle the
      // vertical run passes, so nothing is crossed on the way down or up.
      const gutterLeftOf = (y1: number, y2: number) => {
        let left = Math.min(from.left, to.left, 0);
        for (const box of obstacles) if (overlapsY(box, y1, y2)) left = Math.min(left, box.left);
        return left - GUTTER;
      };
      const provisional = gutterLeftOf(from.top, to.top);
      const ys = bandAbove(from, provisional, obstacles);
      const yt = bandAbove(to, provisional, obstacles);
      const gx = gutterLeftOf(ys, yt);
      const simple: Point[] = [
        [sx, from.top],
        [sx, ys],
        [gx, ys],
        [gx, yt],
        [tx, yt],
        [tx, to.top - 1]
      ];
      // A band squeezed to nothing between two rows of labels is no band at
      // all; search for a way through instead.
      const roomy = from.top - ys >= 3 && to.top - yt >= 3 && clear(simple.slice(1, -1), obstacles);
      // The search treats the two end cells as walls too, so it cannot take a
      // short cut through either; it starts and ends just outside them.
      const found = roomy
        ? null
        : search([sx, from.top - PAD - 1], [tx, to.top - PAD - 1], [...obstacles, from, to]);

      next.push({
        key: flow.key,
        kind: flow.kind,
        d: rounded(found ? [[sx, from.top], ...found, [tx, to.top - 1]] : simple)
      });
    }
    return next;
  }

  return (
    <svg
      aria-hidden
      data-flow-layer
      // Behind everything positioned: a connector that does pass near a cell
      // goes under it rather than over it.
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    >
      <ArrowMarkers />
      <AnimatePresence initial={false}>
        {paths.map((path) => (
          <motion.path
            key={path.key}
            d={path.d}
            fill="none"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={path.kind === "evicts" ? "url(#nf-arrow-soft)" : "url(#nf-arrow-strong)"}
            strokeDasharray={path.kind === "evicts" ? "5 3" : undefined}
            className={path.kind === "evicts" ? "stroke-[var(--compare)]" : "stroke-[var(--graphics-node)]"}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.9 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.36, ease: [0.4, 0, 0.2, 1] }}
          />
        ))}
      </AnimatePresence>
    </svg>
  );
}
