import { useMemo, type ReactNode } from "react";
import { Caption, Scene, ACCENT, INACTIVE, INK, PAPER } from "./primitives";
import { geometry } from "./geometry";
import { useFrames, useInView } from "./useFrames";

/**
 * 96px glyphs for the scope cards. They sit in the card's top-right corner and
 * never run under the number, so the figure stays legible.
 *
 * The counts are passed in from the live problem bank, so the dots and nodes
 * you see are the problems that exist, not a decorative approximation.
 */

const S = 96;

function Glyph({
  count,
  intervalMs = 90,
  label,
  children
}: {
  count: number;
  intervalMs?: number;
  label: string;
  children: (index: number) => ReactNode;
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ amount: 0.5 });
  const { index } = useFrames(count, { intervalMs, active: inView, holdStartMs: 600, holdEndMs: 2600 });

  return (
    <div ref={ref} className="h-24 w-24 shrink-0">
      <Scene width={S} height={S} label={label}>
        {children(index)}
      </Scene>
    </div>
  );
}

/* ---------- One dot per problem ---------- */

export function ProblemDots({ total }: { total: number }) {
  const grid = useMemo(() => {
    const count = Math.max(total, 1);
    const cols = Math.max(1, Math.round(Math.sqrt(count * 1.5)));
    const rows = Math.ceil(count / cols);
    const step = Math.min(S / cols, S / rows);
    const offsetX = (S - (cols - 1) * step) / 2;
    const offsetY = (S - (rows - 1) * step) / 2;

    return Array.from({ length: count }, (_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return { x: offsetX + col * step, y: offsetY + row * step, wave: col + row, r: step * 0.28 };
    });
  }, [total]);

  const crest = Math.max(...grid.map((dot) => dot.wave)) + 1;

  return (
    <Glyph count={crest + 4} label={`${total} problems, one dot each`}>
      {(index) =>
        grid.map((dot, i) => (
          <circle
            key={i}
            cx={dot.x}
            cy={dot.y}
            r={dot.r}
            fill={dot.wave <= index ? INK : INACTIVE}
            style={{ transition: "fill 420ms linear" }}
          />
        ))
      }
    </Glyph>
  );
}

/* ---------- One node per tree-or-graph problem ---------- */

/** A deterministic scatter: the same picture on every render and every visit. */
function scatter(count: number) {
  let seed = 20250918;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const nodes: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i += 1) {
    nodes.push({ x: 6 + random() * (S - 12), y: 6 + random() * (S - 12) });
  }

  // Each node links to its nearest earlier node, which reads as a real graph
  // rather than a random spray of lines.
  const edges: Array<[number, number]> = [];
  for (let i = 1; i < nodes.length; i += 1) {
    let best = 0;
    let bestDistance = Infinity;
    for (let j = 0; j < i; j += 1) {
      const distance = (nodes[i].x - nodes[j].x) ** 2 + (nodes[i].y - nodes[j].y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = j;
      }
    }
    edges.push([i, best]);
  }

  return { nodes, edges };
}

export function StructureGraph({ total }: { total: number }) {
  const { nodes, edges } = useMemo(() => scatter(Math.max(total, 1)), [total]);

  return (
    <div className="h-24 w-24 shrink-0">
      <Scene width={S} height={S} label={`${total} problems drawn as node-and-edge diagrams`}>
        {edges.map(([a, b], i) => (
          <path
            key={i}
            d={`M ${nodes[a].x} ${nodes[a].y} L ${nodes[b].x} ${nodes[b].y}`}
            stroke={INACTIVE}
            strokeWidth={0.8}
          />
        ))}
        {nodes.map((node, i) => (
          <circle key={i} cx={node.x} cy={node.y} r={2.1} fill={PAPER} stroke={INK} strokeWidth={1} />
        ))}
      </Scene>
    </div>
  );
}

/* ---------- Three languages ---------- */

const LANGUAGES = ["Py", "C++", "Java"];

export function LanguagePills() {
  return (
    <Glyph count={LANGUAGES.length + 1} intervalMs={520} label="Python, C++ and Java">
      {(index) =>
        LANGUAGES.map((name, row) => {
          const on = row === index - 1;
          return (
            <g key={name}>
              <path
                d={geometry.roundedRect(10, 12 + row * 26, 76, 20, 10)}
                fill={on ? INK : PAPER}
                stroke={on ? INK : INACTIVE}
                strokeWidth={1.4}
                style={{ transition: "fill 400ms linear, stroke 400ms linear" }}
              />
              <text
                x={48}
                y={22 + row * 26}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fill={on ? PAPER : INACTIVE}
                className="font-mono"
                style={{ transition: "fill 400ms linear" }}
              >
                {name}
              </text>
            </g>
          );
        })
      }
    </Glyph>
  );
}

/* ---------- The step limit ---------- */

/** A loop that runs, meets the bar, and stops — caught, not hanging. */
export function StepLimitGlyph() {
  const orbit = 26;
  const centre = { x: 44, y: 44 };
  const positions = Array.from({ length: 12 }, (_, i) => {
    const angle = -Math.PI / 2 + (i / 12) * Math.PI * 2;
    return { x: centre.x + Math.cos(angle) * orbit, y: centre.y + Math.sin(angle) * orbit };
  });

  return (
    <Glyph count={positions.length + 3} intervalMs={150} label="A runaway loop stopping at the step limit">
      {(index) => {
        const stopped = index >= positions.length;
        const at = positions[Math.min(index, positions.length - 1)];

        return (
          <>
            <circle
              cx={centre.x}
              cy={centre.y}
              r={orbit}
              fill="none"
              stroke={stopped ? INACTIVE : INK}
              strokeWidth={1.6}
              strokeDasharray="4 5"
              style={{ transition: "stroke 600ms linear" }}
            />
            <circle
              cx={at.x}
              cy={at.y}
              r={4.5}
              fill={stopped ? INACTIVE : INK}
              style={{
                transition: "cx 140ms linear, cy 140ms linear, fill 600ms linear"
              }}
            />
            <path
              d={geometry.stopBar(80, centre.y, 14)}
              stroke={stopped ? ACCENT : INACTIVE}
              strokeWidth={2.6}
              strokeLinecap="round"
              style={{ transition: "stroke 300ms linear" }}
            />
            <Caption x={S / 2} y={86} anchor="middle" tone={stopped ? "ink" : "inactive"}>
              {stopped ? "STOPPED" : "LOOPING"}
            </Caption>
          </>
        );
      }}
    </Glyph>
  );
}
