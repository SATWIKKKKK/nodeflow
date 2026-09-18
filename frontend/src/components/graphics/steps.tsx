import type { ReactNode } from "react";
import { Caption, Edge, Node, Null, Scene, ACCENT, INACTIVE, INK, PAPER } from "./primitives";
import { geometry } from "./geometry";
import { useFrames, useInView } from "./useFrames";

/**
 * One 160x120 scene per step of "Four steps from code to replay". Each plays
 * when it scrolls into view and then loops slowly; nothing runs offscreen.
 */

const W = 160;
const H = 120;

function StepFrame({
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
  const [ref, inView] = useInView<HTMLDivElement>({ amount: 0.3 });
  const { index } = useFrames(count, { intervalMs, active: inView, holdStartMs: 1100, holdEndMs: 1400 });

  return (
    <div ref={ref} className="w-full">
      <Scene width={W} height={H} label={label} grid paper markerSize={5} className="rounded-lg">
        {children(index)}
      </Scene>
    </div>
  );
}

/* ---------- 01 Write ---------- */

const SIGNATURE = "def reverse(head):";
const TYPED = ["    prev = None", "    cur  = head"];
const CHARS_PER_FRAME = 2;
const TYPE_FRAMES = Math.ceil(TYPED.join("").length / CHARS_PER_FRAME) + 2;

export function WriteScene() {
  return (
    <StepFrame count={TYPE_FRAMES} intervalMs={150} label="Writing a solution: the signature is already there, the next line is being typed">
      {(index) => {
        const revealed = Math.min(index * CHARS_PER_FRAME, TYPED.join("").length);
        const first = TYPED[0].slice(0, revealed);
        const second = TYPED[1].slice(0, Math.max(0, revealed - TYPED[0].length));
        const lines = [SIGNATURE, first, second];
        const cursorLine = revealed > TYPED[0].length ? 2 : 1;
        const cursorText = cursorLine === 2 ? second : first;

        return (
          <>
            {lines.map((line, row) => {
              const y = 36 + row * 22;
              return (
                <g key={row}>
                  <text
                    x={28}
                    y={y}
                    dominantBaseline="central"
                    fontSize={9}
                    fill={row === 0 ? INACTIVE : INK}
                    className="font-mono"
                    style={{ whiteSpace: "pre" }}
                  >
                    {line}
                  </text>
                  <Caption x={18} y={y} anchor="end" fontSize={8}>
                    {row + 1}
                  </Caption>
                </g>
              );
            })}

            {/* The caret sits after the last character typed and blinks. */}
            <rect
              x={28 + cursorText.length * 5.42}
              y={36 + cursorLine * 22 - 7}
              width={1.6}
              height={14}
              fill={ACCENT}
            >
              <animate attributeName="opacity" values="1;1;0;0;1" dur="1s" repeatCount="indefinite" />
            </rect>
          </>
        );
      }}
    </StepFrame>
  );
}

/* ---------- 02 Run ---------- */

const BOX = { x: 22, y: 24, w: 116, h: 62, r: 10 };
const DOT_PATH: Array<[number, number]> = [
  [44, 42],
  [66, 56],
  [90, 38],
  [112, 56],
  [86, 62],
  [60, 46]
];

export function RunScene() {
  return (
    <StepFrame count={DOT_PATH.length} intervalMs={480} label="Code running inside a sandbox with no network: an attempt to leave stops at a wall">
      {(index) => {
        const [dx, dy] = DOT_PATH[index];
        const escaping = index >= 2;

        return (
          <>
            <path
              d={geometry.roundedRect(BOX.x, BOX.y, BOX.w, BOX.h, BOX.r)}
              fill={PAPER}
              stroke={INK}
              strokeWidth={1.8}
              strokeDasharray="5 4"
              strokeLinecap="round"
            />

            <circle
              cx={dx}
              cy={dy}
              r={5}
              fill={INK}
              style={{ transition: "cx 420ms cubic-bezier(.2,.8,.2,1), cy 420ms cubic-bezier(.2,.8,.2,1)" }}
            />

            {/* One arrow heads for the wall from inside, and stops on it. */}
            <g style={{ opacity: escaping ? 1 : 0, transition: "opacity 300ms linear" }}>
              <Edge d={`M ${BOX.x + BOX.w - 44} 72 H ${BOX.x + BOX.w - 4}`} tone="inactive" arrow />
              <path
                d={geometry.stopBar(BOX.x + BOX.w, 72, 9)}
                stroke={INK}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            </g>

            <Caption x={BOX.x} y={102}>
              NO NETWORK
            </Caption>
          </>
        );
      }}
    </StepFrame>
  );
}

/* ---------- 03 Trace ---------- */

const SNAPSHOTS = 5;

export function TraceScene() {
  return (
    <StepFrame count={SNAPSHOTS + 1} intervalMs={460} label="Snapshots stacking up: one recorded frame per line, each marked where it differs">
      {(index) => (
        <>
          {Array.from({ length: SNAPSHOTS }, (_, row) => {
            const landed = row < index;
            const y = 16 + row * 19;

            return (
              <g
                key={row}
                style={{
                  opacity: landed ? 1 : 0,
                  transform: `translateY(${landed ? 0 : -6}px)`,
                  transition: "opacity 260ms linear, transform 260ms cubic-bezier(.2,.8,.2,1)"
                }}
              >
                <Caption x={20} y={y + 8} anchor="end" fontSize={8}>
                  {row + 4}
                </Caption>
                <path
                  d={geometry.roundedRect(28, y, 112, 16, 5)}
                  fill={PAPER}
                  stroke={row === index - 1 ? INK : INACTIVE}
                  strokeWidth={1.3}
                  style={{ transition: "stroke 600ms linear" }}
                />
                {[0, 1, 2].map((node) => (
                  <g key={node}>
                    <circle
                      cx={52 + node * 30}
                      cy={y + 8}
                      r={5}
                      fill={PAPER}
                      stroke={row === index - 1 ? INK : INACTIVE}
                      strokeWidth={1.3}
                      style={{ transition: "stroke 600ms linear" }}
                    />
                    {node < 2 && (
                      <path
                        d={`M ${58 + node * 30} ${y + 8} H ${75 + node * 30}`}
                        stroke={row === index - 1 ? INK : INACTIVE}
                        strokeWidth={1.2}
                        strokeLinecap="round"
                        style={{ transition: "stroke 600ms linear" }}
                      />
                    )}
                  </g>
                ))}
                {/* The diff mark: what this snapshot changed. */}
                <path
                  d={`M 132 ${y + 5} V ${y + 11}`}
                  stroke={ACCENT}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </>
      )}
    </StepFrame>
  );
}

/* ---------- 04 Replay ---------- */

/** The four states a three-node list passes through while it reverses. */
const STATES: Array<Array<number | null>> = [
  [1, 2, null],
  [null, 2, null],
  [null, 0, null],
  [null, 0, 1]
];
const TICKS = 25;
const REPLAY_FRAMES = STATES.length * 2 - 1;
const listX = (index: number) => 34 + index * 36;
const TICK_X = (i: number) => 20 + (i / (TICKS - 1)) * 120;

export function ReplayScene() {
  return (
    <StepFrame count={REPLAY_FRAMES} intervalMs={430} label="Replaying a recorded trace: the scrubber moves and the list rewires and un-rewires in step">
      {(index) => {
        // Forward to the end, then back again — the same states in reverse.
        const state = index < STATES.length ? index : REPLAY_FRAMES - 1 - index;
        const nexts = STATES[state];
        const tick = Math.round((state / (STATES.length - 1)) * (TICKS - 1));

        return (
          <>
            {nexts.map((target, node) => {
              const from = listX(node);
              if (target === null) {
                // Short, so a null on an inner node does not run into its neighbour.
                return <Null key={node} x={from} y={38} r={11} gap={4} length={5} tone="inactive" />;
              }
              const to = listX(target);
              return (
                <Edge
                  key={node}
                  kind={to < from ? "curved" : "straight"}
                  x1={from}
                  x2={to}
                  y={38}
                  r={11}
                  gap={4}
                  depth={13}
                  tone="ink"
                  width={1.6}
                />
              );
            })}

            {[0, 1, 2].map((node) => (
              <Node key={node} x={listX(node)} y={38} r={11} value={node + 1} fontSize={9} />
            ))}

            {/* 25 ticks, one per recorded step, with the scrubber riding above. */}
            {Array.from({ length: TICKS }, (_, i) => (
              <path
                key={i}
                d={`M ${TICK_X(i)} 96 V 106`}
                stroke={i <= tick ? INK : INACTIVE}
                strokeWidth={1.2}
                strokeLinecap="round"
                style={{ transition: "stroke 300ms linear" }}
              />
            ))}

            <g
              style={{
                transform: `translateX(${TICK_X(tick)}px)`,
                transition: "transform 400ms cubic-bezier(.2,.8,.2,1)"
              }}
            >
              <rect x={-8} y={78} width={16} height={12} rx={6} fill={INK} />
              <path d="M 0 90 V 95" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
            </g>
          </>
        );
      }}
    </StepFrame>
  );
}

export const stepScenes = {
  Write: WriteScene,
  Run: RunScene,
  Trace: TraceScene,
  Replay: ReplayScene
};
