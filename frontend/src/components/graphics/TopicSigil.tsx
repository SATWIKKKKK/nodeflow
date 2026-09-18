import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Scene, INACTIVE, INK, PAPER } from "./primitives";
import { geometry } from "./geometry";

/**
 * A 64x64 line glyph for every topic in the problem bank. All of them are drawn
 * from the same three marks the rest of the illustrations use — circle, edge,
 * bar — at one stroke weight, with exactly one filled node saying "this is the
 * element the topic is about".
 *
 * Topic names come from the bank itself (data/problems/*.json). Structure types
 * are aliased on, so `<TopicSigil topic="linked_list" />` works too.
 */

const R = 6;
const STROKE = 2;

/** An open circle. */
function N({ x, y, r = R, filled = false }: { x: number; y: number; r?: number; filled?: boolean }) {
  return <circle cx={x} cy={y} r={r} fill={filled ? INK : PAPER} stroke={INK} strokeWidth={STROKE} />;
}

/** A plain connector. */
function L({ x1, y1, x2, y2, tone = INK, width = STROKE }: { x1: number; y1: number; x2: number; y2: number; tone?: string; width?: number }) {
  return <path d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke={tone} strokeWidth={width} strokeLinecap="round" />;
}

/** A connector with a small chevron — full-size markers are too big at 64px. */
function A({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = (spread: number) => [
    x2 - Math.cos(angle - spread) * 4.5,
    y2 - Math.sin(angle - spread) * 4.5
  ];
  const [ax, ay] = head(0.5);
  const [bx, by] = head(-0.5);

  return (
    <path
      d={`M ${x1} ${y1} L ${x2} ${y2} M ${ax} ${ay} L ${x2} ${y2} L ${bx} ${by}`}
      fill="none"
      stroke={INK}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** A pointer that stops: stub plus bar. */
function Stop({ x, y, to }: { x: number; y: number; to: number }) {
  return (
    <path
      d={`M ${x} ${y} H ${to} M ${to} ${y - 5} V ${y + 5}`}
      fill="none"
      stroke={INACTIVE}
      strokeWidth={STROKE}
      strokeLinecap="round"
    />
  );
}

function Cell({ x, y, size = 16 }: { x: number; y: number; size?: number }) {
  return <path d={geometry.roundedRect(x, y, size, size, 2)} fill={PAPER} stroke={INK} strokeWidth={1.6} />;
}

/** Three nodes on a row, the shape most topics start from. */
const ROW = [11, 32, 53];

const sigils: Record<string, { label: string; draw: ReactNode }> = {
  Array: {
    label: "a contiguous row of elements",
    draw: (
      <>
        <L x1={5} y1={44} x2={59} y2={44} tone={INACTIVE} />
        {ROW.map((x, i) => (
          <N key={x} x={x} y={26} filled={i === 1} />
        ))}
      </>
    )
  },
  String: {
    label: "characters in a row, with one span marked",
    draw: (
      <>
        {ROW.map((x, i) => (
          <N key={x} x={x} y={26} filled={i === 0} />
        ))}
        <L x1={5} y1={44} x2={38} y2={44} />
        <L x1={38} y1={44} x2={59} y2={44} tone={INACTIVE} />
      </>
    )
  },
  Hashing: {
    label: "keys mapped into buckets",
    draw: (
      <>
        {[14, 32, 50].map((y) => (
          <L key={y} x1={6} y1={y} x2={20} y2={y} tone={INACTIVE} />
        ))}
        <A x1={22} y1={14} x2={40} y2={18} />
        <A x1={22} y1={32} x2={40} y2={20} />
        <A x1={22} y1={50} x2={40} y2={46} />
        <N x={48} y={18} filled />
        <N x={48} y={48} />
      </>
    )
  },
  Math: {
    label: "a number line",
    draw: (
      <>
        <L x1={5} y1={32} x2={59} y2={32} tone={INACTIVE} />
        {[9, 23, 51].map((x) => (
          <L key={x} x1={x} y1={27} x2={x} y2={37} tone={INACTIVE} />
        ))}
        <N x={37} y={32} filled />
      </>
    )
  },
  Recursion: {
    label: "a call descending and returning",
    draw: (
      <>
        <A x1={32} y1={18} x2={32} y2={30} />
        <A x1={32} y1={40} x2={32} y2={50} />
        <path d="M 44 12 C 58 20, 58 46, 44 54" fill="none" stroke={INACTIVE} strokeWidth={STROKE} strokeLinecap="round" />
        <N x={32} y={12} />
        <N x={32} y={35} />
        <N x={32} y={56} filled />
      </>
    )
  },
  Backtracking: {
    label: "a branch abandoned and retried",
    draw: (
      <>
        <L x1={28} y1={17} x2={18} y2={29} />
        <L x1={36} y1={17} x2={46} y2={29} />
        <A x1={46} y1={41} x2={48} y2={50} />
        <Stop x={16} y={42} to={16} />
        <N x={32} y={12} />
        <N x={14} y={34} />
        <N x={48} y={34} />
        <N x={50} y={56} filled />
      </>
    )
  },
  "Binary Search": {
    label: "a range halved around the middle",
    draw: (
      <>
        <L x1={4} y1={24} x2={4} y2={40} tone={INACTIVE} />
        <L x1={60} y1={24} x2={60} y2={40} tone={INACTIVE} />
        {ROW.map((x, i) => (
          <N key={x} x={x} y={32} filled={i === 1} />
        ))}
        <L x1={4} y1={50} x2={32} y2={50} />
      </>
    )
  },
  "Linked List": {
    label: "nodes chained to a null",
    draw: (
      <>
        <A x1={20} y1={32} x2={30} y2={32} />
        <Stop x={44} y={32} to={56} />
        <N x={14} y={32} filled />
        <N x={36} y={32} />
      </>
    )
  },
  "Doubly Linked List": {
    label: "nodes chained both ways",
    draw: (
      <>
        <A x1={24} y1={24} x2={40} y2={24} />
        <A x1={40} y1={42} x2={24} y2={42} />
        <N x={16} y={33} filled />
        <N x={48} y={33} />
      </>
    )
  },
  Stack: {
    label: "pushed and popped from the top",
    draw: (
      <>
        <A x1={32} y1={4} x2={32} y2={12} />
        <L x1={14} y1={58} x2={50} y2={58} tone={INACTIVE} />
        <N x={32} y={22} filled />
        <N x={32} y={37} />
        <N x={32} y={50} />
      </>
    )
  },
  Queue: {
    label: "in at one end, out at the other",
    draw: (
      <>
        <A x1={2} y1={32} x2={7} y2={32} />
        <A x1={57} y1={32} x2={62} y2={32} />
        {ROW.map((x, i) => (
          <N key={x} x={x} y={32} filled={i === 2} />
        ))}
      </>
    )
  },
  "Monotonic Stack": {
    label: "a stack kept in order",
    draw: (
      <>
        <N x={18} y={18} filled />
        <N x={18} y={34} />
        <N x={18} y={50} />
        <path d="M 34 20 H 44 V 34 H 54 V 50" fill="none" stroke={INACTIVE} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
      </>
    )
  },
  "Monotonic Queue": {
    label: "a queue kept in order",
    draw: (
      <>
        <path d="M 8 16 H 22 V 26 H 38 V 36" fill="none" stroke={INACTIVE} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
        {ROW.map((x, i) => (
          <N key={x} x={x} y={48} filled={i === 0} />
        ))}
      </>
    )
  },
  "Binary Tree": {
    label: "a root with two children",
    draw: (
      <>
        <L x1={27} y1={17} x2={20} y2={28} />
        <L x1={37} y1={17} x2={44} y2={28} />
        <L x1={11} y1={39} x2={7} y2={49} />
        <L x1={21} y1={39} x2={25} y2={49} />
        <N x={32} y={12} filled />
        <N x={16} y={34} />
        <N x={48} y={34} />
        <N x={6} y={54} />
        <N x={28} y={54} />
      </>
    )
  },
  "Binary Search Tree": {
    label: "a tree whose in-order walk is sorted",
    draw: (
      <>
        <L x1={27} y1={19} x2={19} y2={30} />
        <L x1={37} y1={19} x2={45} y2={30} />
        <N x={32} y={14} filled />
        <N x={14} y={36} />
        <N x={50} y={36} />
        <L x1={6} y1={56} x2={58} y2={56} tone={INACTIVE} />
        {[14, 32, 50].map((x) => (
          <L key={x} x1={x} y1={52} x2={x} y2={60} tone={INACTIVE} />
        ))}
      </>
    )
  },
  Heap: {
    label: "a tree with the smallest at the root",
    draw: (
      <>
        <path d="M 32 6 L 58 56 L 6 56 Z" fill="none" stroke={INACTIVE} strokeWidth={STROKE} strokeLinejoin="round" />
        <L x1={28} y1={27} x2={23} y2={36} />
        <L x1={36} y1={27} x2={41} y2={36} />
        <N x={32} y={22} filled />
        <N x={20} y={42} />
        <N x={44} y={42} />
      </>
    )
  },
  Graph: {
    label: "nodes joined by edges",
    draw: (
      <>
        <L x1={28} y1={16} x2={15} y2={27} />
        <L x1={36} y1={16} x2={49} y2={27} />
        <L x1={15} y1={37} x2={28} y2={48} />
        <L x1={49} y1={37} x2={36} y2={48} />
        <N x={32} y={11} />
        <N x={10} y={32} filled />
        <N x={54} y={32} />
        <N x={32} y={53} />
      </>
    )
  },
  Trie: {
    label: "a prefix tree, one path per word",
    draw: (
      <>
        <L x1={28} y1={15} x2={20} y2={26} />
        <L x1={36} y1={15} x2={44} y2={26} />
        <L x1={12} y1={36} x2={8} y2={46} />
        <L x1={20} y1={36} x2={25} y2={46} />
        <N x={32} y={10} />
        <N x={16} y={31} />
        <N x={48} y={31} />
        <N x={7} y={51} />
        <N x={27} y={51} filled />
      </>
    )
  },
  "Dynamic Programming": {
    label: "a table filled from earlier answers",
    draw: (
      <>
        {[8, 24, 40].map((x) => [8, 24, 40].map((y) => <Cell key={`${x}-${y}`} x={x} y={y} />))}
        <A x1={34} y1={48} x2={41} y2={48} />
        <A x1={48} y1={34} x2={48} y2={41} />
        <N x={48} y={48} r={5} filled />
      </>
    )
  },
  Greedy: {
    label: "the best option taken at each step",
    draw: (
      <>
        <L x1={20} y1={29} x2={42} y2={16} />
        <L x1={20} y1={32} x2={42} y2={32} tone={INACTIVE} />
        <L x1={20} y1={35} x2={42} y2={48} tone={INACTIVE} />
        <N x={14} y={32} />
        <N x={48} y={13} filled />
        <N x={48} y={32} />
        <N x={48} y={51} />
      </>
    )
  },
  "Sliding Window": {
    label: "a fixed span moving along a row",
    draw: (
      <>
        <path d={geometry.roundedRect(17, 21, 34, 22, 6)} fill="none" stroke={INACTIVE} strokeWidth={STROKE} />
        <A x1={54} y1={12} x2={62} y2={12} />
        <N x={8} y={32} r={5} />
        <N x={26} y={32} r={5} filled />
        <N x={42} y={32} r={5} />
        <N x={58} y={32} r={5} />
      </>
    )
  },
  "Two Pointers": {
    label: "two indices closing in",
    draw: (
      <>
        <A x1={6} y1={16} x2={20} y2={16} />
        <A x1={58} y1={16} x2={44} y2={16} />
        <N x={8} y={38} r={5} filled />
        <N x={25} y={38} r={5} />
        <N x={41} y={38} r={5} />
        <N x={58} y={38} r={5} />
      </>
    )
  },
  Sorting: {
    label: "elements put in order",
    draw: (
      <>
        {[
          [12, 48],
          [24, 40],
          [36, 32],
          [48, 24]
        ].map(([x, top]) => (
          <L key={x} x1={x} y1={58} x2={x} y2={top} tone={INACTIVE} />
        ))}
        <N x={48} y={14} filled />
      </>
    )
  },
  "Bit Manipulation": {
    label: "bits, one of them flipped",
    draw: (
      <>
        {[6, 16, 26, 36, 46, 56].map((x) => (
          <path key={x} d={geometry.roundedRect(x - 4, 34, 8, 8, 1.5)} fill={PAPER} stroke={INK} strokeWidth={1.6} />
        ))}
        <L x1={36} y1={26} x2={36} y2={32} tone={INACTIVE} />
        <N x={36} y={18} r={5} filled />
      </>
    )
  },
  Matrix: {
    label: "a grid of cells",
    draw: (
      <>
        {[8, 24, 40].map((x) => [8, 24, 40].map((y) => <Cell key={`${x}-${y}`} x={x} y={y} />))}
        <N x={32} y={32} r={5} filled />
      </>
    )
  },
  Design: {
    label: "parts wired into a working whole",
    draw: (
      <>
        <path d={geometry.roundedRect(20, 22, 24, 20, 4)} fill={PAPER} stroke={INK} strokeWidth={STROKE} />
        <A x1={14} y1={32} x2={18} y2={32} />
        <A x1={46} y1={32} x2={50} y2={32} />
        <N x={8} y={32} r={5} filled />
        <N x={56} y={32} r={5} />
      </>
    )
  }
};

/** Structure types and loose spellings reach the same glyph. */
const aliases: Record<string, string> = {
  array: "Array",
  string: "String",
  hashmap: "Hashing",
  hashing: "Hashing",
  number: "Math",
  math: "Math",
  recursion: "Recursion",
  backtracking: "Backtracking",
  linked_list: "Linked List",
  "linked list": "Linked List",
  doubly_linked_list: "Doubly Linked List",
  stack: "Stack",
  queue: "Queue",
  tree: "Binary Tree",
  "binary tree": "Binary Tree",
  bst: "Binary Search Tree",
  heap: "Heap",
  graph: "Graph",
  trie: "Trie",
  grid: "Matrix",
  matrix: "Matrix",
  dp: "Dynamic Programming",
  "dp table": "Dynamic Programming",
  greedy: "Greedy",
  sorting: "Sorting",
  design: "Design"
};

export const topicSigilNames = Object.keys(sigils);

export function resolveTopic(topic: string) {
  if (sigils[topic]) return topic;
  const key = topic.trim().toLowerCase();
  if (aliases[key]) return aliases[key];
  const matched = topicSigilNames.find((name) => name.toLowerCase() === key);
  return matched ?? null;
}

export function TopicSigil({
  topic,
  className,
  size = 64
}: {
  topic: string;
  className?: string;
  /** Rendered size in px; the drawing is always 64x64. */
  size?: number;
}) {
  const name = resolveTopic(topic);
  const sigil = name ? sigils[name] : null;

  if (!sigil) {
    // An unknown topic gets the generic mark rather than an empty box.
    return (
      <div className={cn("shrink-0", className)} style={{ width: size, height: size }}>
        <Scene width={64} height={64} label={topic}>
          <N x={32} y={32} filled />
        </Scene>
      </div>
    );
  }

  return (
    <div className={cn("shrink-0", className)} style={{ width: size, height: size }}>
      <Scene width={64} height={64} label={`${name}: ${sigil.label}`}>
        {sigil.draw}
      </Scene>
    </div>
  );
}
