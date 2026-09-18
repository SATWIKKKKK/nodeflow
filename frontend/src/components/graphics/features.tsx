import type { ReactNode } from "react";
import { Caption, Edge, Node, Scene, ACCENT, INACTIVE, INK, PAPER } from "./primitives";
import { geometry } from "./geometry";
import { useReplayOnHover } from "./useFrames";

/**
 * One 280x120 scene per card in "Built for the moment your solution breaks".
 * Six looping animations at once would be noise, so each plays once when it
 * scrolls into view and rests on its final frame; hover or focus replays it.
 */

const W = 280;
const H = 120;

function FeatureFrame({
  count,
  intervalMs = 420,
  label,
  children
}: {
  count: number;
  intervalMs?: number;
  label: string;
  children: (index: number) => ReactNode;
}) {
  const { ref, frames, handlers } = useReplayOnHover(count, { intervalMs, holdStartMs: 700 });

  return (
    <div ref={ref} {...handlers} tabIndex={-1} className="w-full outline-none">
      <Scene width={W} height={H} label={label} grid paper markerSize={6} className="rounded-lg">
        {children(frames.index)}
      </Scene>
    </div>
  );
}

/** Fades a group in once the frame index reaches `at`. */
const appear = (index: number, at: number) => ({
  opacity: index >= at ? 1 : 0,
  transform: `translateY(${index >= at ? 0 : 5}px)`,
  transition: "opacity 260ms linear, transform 260ms cubic-bezier(.2,.8,.2,1)"
});

/* ---------- Run ---------- */

export function RunGraphic() {
  const ticks = 24;
  return (
    <FeatureFrame count={8} label="A run returning a value, printing a line, and recording a strip of trace steps">
      {(index) => (
        <>
          <g style={appear(index, 1)}>
            <path d={geometry.roundedRect(16, 16, 150, 24, 12)} fill={PAPER} stroke={INK} strokeWidth={1.6} />
            <text x={30} y={28} dominantBaseline="central" fontSize={11} fill={INK} className="font-mono">
              {"→ [4,3,2,1]"}
            </text>
          </g>

          <g style={appear(index, 2)}>
            <text x={16} y={58} dominantBaseline="central" fontSize={10} fill={INACTIVE} className="font-mono">
              stdout: reversed 4 nodes
            </text>
          </g>

          <Caption x={16} y={78}>
            TRACE
          </Caption>

          {Array.from({ length: ticks }, (_, i) => {
            const on = index >= 3 && i < Math.round(((index - 2) / 5) * ticks);
            return (
              <path
                key={i}
                d={`M ${16 + i * 10.6} 92 V 106`}
                stroke={on ? INK : INACTIVE}
                strokeWidth={1.8}
                strokeLinecap="round"
                style={{ transition: "stroke 200ms linear" }}
              />
            );
          })}
        </>
      )}
    </FeatureFrame>
  );
}

/* ---------- Test ---------- */

const CHECK = "M -3.5 0 L -1 2.6 L 3.6 -3";
const CROSS = "M -3.2 -3.2 L 3.2 3.2 M 3.2 -3.2 L -3.2 3.2";

export function TestGraphic() {
  return (
    <FeatureFrame count={6} label="Three test cases: two pass, the third fails and opens to show expected against what was returned">
      {(index) => {
        const open = index >= 4;
        return (
          <>
            {[0, 1].map((row) => (
              <g key={row} style={appear(index, row + 1)}>
                <path d={geometry.roundedRect(16, 14 + row * 26, 248, 20, 6)} fill={PAPER} stroke={INACTIVE} strokeWidth={1.3} />
                <g transform={`translate(32 ${24 + row * 26})`}>
                  <path d={CHECK} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </g>
                <text x={48} y={24 + row * 26} dominantBaseline="central" fontSize={10} fill={INACTIVE} className="font-mono">
                  {`case ${row + 1}`}
                </text>
              </g>
            ))}

            <g style={appear(index, 3)}>
              <path
                d={geometry.roundedRect(16, 66, 248, open ? 44 : 20, 6)}
                fill={PAPER}
                stroke={INK}
                strokeWidth={1.5}
                style={{ transition: "d 300ms cubic-bezier(.2,.8,.2,1)" }}
              />
              <g transform="translate(32 76)">
                <path d={CROSS} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
              </g>
              <text x={48} y={76} dominantBaseline="central" fontSize={10} fill={INK} className="font-mono">
                case 3
              </text>

              <g style={{ opacity: open ? 1 : 0, transition: "opacity 260ms linear 120ms" }}>
                <text x={48} y={92} dominantBaseline="central" fontSize={9} fill={INACTIVE} className="font-mono">
                  expected
                </text>
                <text x={104} y={92} dominantBaseline="central" fontSize={9} fill={INK} className="font-mono">
                  [4,3,2,1]
                </text>
                <text x={48} y={104} dominantBaseline="central" fontSize={9} fill={INACTIVE} className="font-mono">
                  got
                </text>
                <text x={104} y={104} dominantBaseline="central" fontSize={9} fill={ACCENT} className="font-mono">
                  [1,2,3,4]
                </text>
              </g>
            </g>
          </>
        );
      }}
    </FeatureFrame>
  );
}

/* ---------- Submit ---------- */

const SHIELD = "M 0 -26 L 19 -17 V 3 C 19 16 0 26 0 26 C 0 26 -19 16 -19 3 V -17 Z";

export function SubmitGraphic() {
  return (
    <FeatureFrame count={7} label="Submitting against every case: the hidden ones stay sealed and the verdict is Accepted">
      {(index) => (
        <>
          {/*
            The shield carries its own offset inside the path, because `appear`
            sets a CSS transform and that would override a transform attribute.
          */}
          <g style={appear(index, 0)}>
            <path
              d={SHIELD}
              transform="translate(44 50)"
              fill={PAPER}
              stroke={INK}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </g>

          {[0, 1, 2].map((row) => (
            <g key={row} style={appear(index, row + 1)}>
              <path d={geometry.roundedRect(92, 12 + row * 16, 172, 11, 5)} fill={PAPER} stroke={INACTIVE} strokeWidth={1.2} />
            </g>
          ))}

          {/* Hidden cases: sealed bars, no contents. */}
          {[0, 1].map((row) => (
            <g key={`sealed-${row}`} style={appear(index, 4)}>
              <path d={geometry.roundedRect(92, 60 + row * 16, 172, 11, 5)} fill={INACTIVE} />
            </g>
          ))}

          <g
            style={{
              opacity: index >= 6 ? 1 : 0,
              transform: `translate(178px, 102px) scale(${index >= 6 ? 1 : 1.3})`,
              transition: "opacity 180ms linear, transform 260ms cubic-bezier(.2,.8,.2,1)"
            }}
          >
            <path d={geometry.roundedRect(-54, -11, 108, 22, 11)} fill={PAPER} stroke={INK} strokeWidth={1.8} />
            <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={11} fill={INK} className="font-mono" style={{ letterSpacing: "0.12em" }}>
              ACCEPTED
            </text>
          </g>
        </>
      )}
    </FeatureFrame>
  );
}

/* ---------- Live preview ---------- */

const PREVIEW_LINE = "cur.next = prev";

export function PreviewGraphic() {
  return (
    <FeatureFrame count={7} intervalMs={360} label="While code is mid-edit the last good diagram stays on screen, outlined as stale, then redraws once it parses">
      {(index) => {
        const typed = PREVIEW_LINE.slice(0, Math.min(index * 3, PREVIEW_LINE.length));
        const stale = index > 0 && index < 5;
        const tone = stale ? "inactive" : "ink";

        return (
          <>
            <Caption x={16} y={20}>
              EDITOR
            </Caption>
            <text x={16} y={44} dominantBaseline="central" fontSize={11} fill={INK} className="font-mono" style={{ whiteSpace: "pre" }}>
              {typed}
            </text>
            <rect x={16 + typed.length * 6.6} y={37} width={1.6} height={14} fill={ACCENT}>
              <animate attributeName="opacity" values="1;1;0;0;1" dur="1s" repeatCount="indefinite" />
            </rect>

            <path
              d={geometry.roundedRect(148, 28, 116, 62, 8)}
              fill="none"
              stroke={stale ? INACTIVE : INK}
              strokeWidth={1.4}
              strokeDasharray={stale ? "4 4" : undefined}
              style={{ transition: "stroke 600ms linear" }}
            />

            {[0, 1, 2].map((node) => {
              const x = 172 + node * 34;
              return (
                <g key={node}>
                  {node < 2 && (
                    <Edge x1={x} x2={x + 34} y={59} r={11} gap={4} tone={node === 1 && index >= 5 ? "accent" : tone} width={1.6} />
                  )}
                  <Node x={x} y={59} r={11} value={node + 1} fontSize={9} tone={tone} />
                </g>
              );
            })}

            <Caption x={148} y={104} tone={stale ? "inactive" : "ink"}>
              {stale ? "STALE" : "IN SYNC"}
            </Caption>
          </>
        );
      }}
    </FeatureFrame>
  );
}

/* ---------- Diffs, not guesses ---------- */

const GRAPH_NODES: Array<[number, number]> = [
  [0, -24],
  [-26, 2],
  [26, 2],
  [0, 28]
];

function MiniGraph({ cx, cy, dim, changedEdge }: { cx: number; cy: number; dim: boolean; changedEdge: boolean }) {
  const tone = dim ? "inactive" : "ink";
  const at = (i: number) => [cx + GRAPH_NODES[i][0], cy + GRAPH_NODES[i][1]] as const;
  const link = (a: number, b: number) => {
    const [x1, y1] = at(a);
    const [x2, y2] = at(b);
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  };

  return (
    <g>
      {[
        [0, 1],
        [0, 2],
        [1, 3]
      ].map(([a, b]) => (
        <path
          key={`${a}${b}`}
          d={link(a, b)}
          stroke={dim ? INACTIVE : INK}
          strokeWidth={1.6}
          strokeLinecap="round"
          style={{ transition: "stroke 600ms linear" }}
        />
      ))}
      <path
        d={link(2, 3)}
        stroke={changedEdge ? ACCENT : dim ? INACTIVE : INK}
        strokeWidth={changedEdge ? 2.4 : 1.6}
        strokeLinecap="round"
        style={{ transition: "stroke 600ms linear, stroke-width 300ms linear" }}
      />
      {GRAPH_NODES.map((_, i) => {
        const [x, y] = at(i);
        return <Node key={i} x={x} y={y} r={9} tone={tone} />;
      })}
    </g>
  );
}

export function DiffGraphic() {
  return (
    <FeatureFrame count={4} intervalMs={620} label="Two recorded frames side by side, with only the single pointer that changed lit up">
      {(index) => {
        const dim = index >= 2;
        return (
          <>
            <MiniGraph cx={80} cy={50} dim={dim} changedEdge={false} />
            <MiniGraph cx={200} cy={50} dim={dim} changedEdge={index >= 2} />
            <path d="M 140 22 V 82" stroke={INACTIVE} strokeWidth={1} strokeDasharray="3 4" />
            <Caption x={W / 2} y={106} anchor="middle" tone={dim ? "ink" : "inactive"}>
              DELTA 1 POINTER
            </Caption>
          </>
        );
      }}
    </FeatureFrame>
  );
}

/* ---------- Your bug or ours ---------- */

export function FaultGraphic() {
  return (
    <FeatureFrame count={4} intervalMs={900} label="Two lanes: an error raised by your code, and a sandbox timeout, reported separately">
      {(index) => {
        const yours = index % 2 === 0;
        return (
          <>
            <path d="M 140 12 V 100" stroke={INACTIVE} strokeWidth={1} strokeDasharray="3 4" />

            {/* Left: an exception pinned to a line of your code. */}
            <g>
              {[0, 1, 2].map((row) => (
                <path
                  key={row}
                  d={`M 20 ${24 + row * 13} H ${row === 1 ? 104 : 88}`}
                  stroke={row === 1 ? INK : INACTIVE}
                  strokeWidth={row === 1 ? 2.2 : 1.6}
                  strokeLinecap="round"
                />
              ))}
              <g transform="translate(20 62)">
                <path d={geometry.roundedRect(0, 0, 90, 18, 9)} fill={PAPER} stroke={INK} strokeWidth={1.4} />
                <text x={45} y={9} textAnchor="middle" dominantBaseline="central" fontSize={9} fill={INK} className="font-mono">
                  IndexError
                </text>
              </g>
              <g
                style={{
                  opacity: yours ? 1 : 0.35,
                  transition: "opacity 400ms linear"
                }}
              >
                <path d={geometry.roundedRect(20, 90, 82, 18, 9)} fill={yours ? INK : PAPER} stroke={yours ? INK : INACTIVE} strokeWidth={1.4} style={{ transition: "fill 400ms linear, stroke 400ms linear" }} />
                <text x={61} y={99} textAnchor="middle" dominantBaseline="central" fontSize={9} fill={yours ? PAPER : INACTIVE} className="font-mono" style={{ letterSpacing: "0.08em" }}>
                  YOUR CODE
                </text>
              </g>
            </g>

            {/* Right: the sandbox ran out of time. */}
            <g>
              <path d={geometry.roundedRect(160, 28, 100, 40, 8)} fill={PAPER} stroke={INACTIVE} strokeWidth={1.4} strokeDasharray="5 4" />
              <g transform="translate(210 48)">
                <circle r={11} fill={PAPER} stroke={INK} strokeWidth={1.8} />
                <path d="M 0 -6 V 0 L 4 3" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
              </g>
              <g
                style={{
                  opacity: yours ? 0.35 : 1,
                  transition: "opacity 400ms linear"
                }}
              >
                <path d={geometry.roundedRect(178, 90, 64, 18, 9)} fill={yours ? PAPER : INK} stroke={yours ? INACTIVE : INK} strokeWidth={1.4} style={{ transition: "fill 400ms linear, stroke 400ms linear" }} />
                <text x={210} y={99} textAnchor="middle" dominantBaseline="central" fontSize={9} fill={yours ? INACTIVE : PAPER} className="font-mono" style={{ letterSpacing: "0.08em" }}>
                  SANDBOX
                </text>
              </g>
            </g>
          </>
        );
      }}
    </FeatureFrame>
  );
}

export const featureGraphics: Record<string, () => ReactNode> = {
  Run: RunGraphic,
  Test: TestGraphic,
  Submit: SubmitGraphic,
  "Live preview": PreviewGraphic,
  "Diffs, not guesses": DiffGraphic,
  "Your bug or ours": FaultGraphic
};
