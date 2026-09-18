import { Scene, INK } from "./primitives";
import { useFrames } from "./useFrames";

/**
 * Faint drawings in the hero's side margins, only on wide screens. They sit at
 * 8% opacity behind everything and are decorative, so they are aria-hidden and
 * never come near the headline's column.
 */

const TREE_NODES: Array<[number, number]> = [
  [60, 16],
  [30, 56],
  [90, 56],
  [12, 96],
  [48, 96],
  [74, 96],
  [108, 96]
];
const TREE_EDGES: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [1, 3],
  [1, 4],
  [2, 5],
  [2, 6]
];
/** Depth-first: root, down the left, then the right. */
const DFS = [0, 1, 3, 4, 2, 5, 6];

const GRAPH_NODES: Array<[number, number]> = [
  [60, 20],
  [20, 52],
  [100, 48],
  [44, 92],
  [96, 96],
  [64, 58]
];
const GRAPH_EDGES: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [1, 5],
  [2, 5],
  [1, 3],
  [5, 3],
  [2, 4],
  [3, 4]
];
/** Breadth-first from the top node. */
const BFS = [0, 1, 2, 5, 3, 4];

function Vignette({
  nodes,
  edges,
  order,
  label
}: {
  nodes: Array<[number, number]>;
  edges: Array<[number, number]>;
  order: number[];
  label: string;
}) {
  const { index } = useFrames(order.length, { intervalMs: 1100, holdStartMs: 1600, holdEndMs: 1800 });
  const [cx, cy] = nodes[order[index]];

  return (
    <Scene width={120} height={116} label={label}>
      {edges.map(([a, b]) => (
        <path
          key={`${a}-${b}`}
          d={`M ${nodes[a][0]} ${nodes[a][1]} L ${nodes[b][0]} ${nodes[b][1]}`}
          stroke={INK}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={7} fill="none" stroke={INK} strokeWidth={1.8} />
      ))}
      <circle
        cx={cx}
        cy={cy}
        r={7}
        fill={INK}
        style={{ transition: "cx 400ms cubic-bezier(.2,.8,.2,1), cy 400ms cubic-bezier(.2,.8,.2,1)" }}
      />
    </Scene>
  );
}

export function MarginVignettes() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden xl:block">
      <div className="absolute left-6 top-1/2 w-[150px] -translate-y-1/2 opacity-[0.08] 2xl:left-14">
        <Vignette nodes={TREE_NODES} edges={TREE_EDGES} order={DFS} label="A tree walked depth-first" />
      </div>
      <div className="absolute right-6 top-1/2 w-[150px] -translate-y-1/2 opacity-[0.08] 2xl:right-14">
        <Vignette nodes={GRAPH_NODES} edges={GRAPH_EDGES} order={BFS} label="A graph walked breadth-first" />
      </div>
    </div>
  );
}
