import { createContext, useContext, useId, type CSSProperties, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { geometry } from "./geometry";

/**
 * The drawing vocabulary every marketing illustration is built from: a circle
 * node, an edge with an open chevron, a null terminator and a pointer pill.
 * Same hand as the logo and the real-trace panel — 2.5px round strokes,
 * unfilled nodes, mono numerals, one filled thing per scene.
 *
 * Colour never appears literally here. Everything reads the --graphics-* vars
 * in index.css, so light, dark and the inverted CTA panel all work unchanged.
 */

export type Tone = "ink" | "accent" | "inactive" | "node";

export const PAPER = "var(--graphics-paper)";
export const INK = "var(--graphics-ink)";
export const ACCENT = "var(--graphics-accent)";
export const INACTIVE = "var(--graphics-inactive)";
/** The default weight for a drawn circle. */
export const NODE = "var(--graphics-node)";
/** A solid blue surface, and the colour of anything sitting on it. */
export const FILL = "var(--fill-blue)";
export const ON_FILL = "var(--fill-blue-text)";
/** Verdict green. Not a tone: only a passing result ever wears it. */
export const SUCCESS = "var(--graphics-success)";

export const toneColor: Record<Tone, string> = {
  ink: INK,
  accent: ACCENT,
  inactive: INACTIVE,
  node: NODE
};

const TONES: Tone[] = ["ink", "accent", "inactive", "node"];

/** Marker ids must be unique per mounted scene, so children read the scene's id. */
const SceneContext = createContext("nf");

/**
 * The accent is only ever worn by the thing that just changed, and it settles
 * back to ink afterwards. One shared duration keeps that consistent.
 */
export const SETTLE_MS = 600;
export const settle = (changed: boolean): CSSProperties => ({
  transition: `stroke ${changed ? 120 : SETTLE_MS}ms linear, fill ${changed ? 120 : SETTLE_MS}ms linear`
});

/** Stepwise like a debugger: things arrive, they do not drift. */
export const HOP_MS = 520;
export const HOP_EASE = "cubic-bezier(.2,.8,.2,1)";
export const hopTo = (x: number, y: number): CSSProperties => ({
  transform: `translate(${x}px, ${y}px)`,
  transition: `transform ${HOP_MS}ms ${HOP_EASE}`
});

export function Scene({
  width,
  height,
  label,
  grid = false,
  paper = false,
  markerSize = 9,
  children,
  className,
  style
}: {
  width: number;
  height: number;
  label: string;
  /** The faint 60px plotting grid. */
  grid?: boolean;
  /** Fills the viewBox with paper; off when the scene sits on a card already. */
  paper?: boolean;
  /**
   * Chevron size in viewBox units. Arrowheads do not scale with the drawing, so
   * a small scene has to ask for a small head or it swamps its own nodes.
   */
  markerSize?: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const raw = useId();
  const uid = `g${raw.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <SceneContext.Provider value={uid}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        className={cn("h-auto w-full", className)}
        style={style}
      >
        <defs>
          {TONES.map((tone) => (
            <marker
              key={tone}
              id={`${uid}-chevron-${tone}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth={markerSize}
              markerHeight={markerSize}
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path
                d="M 2 1.6 L 8 5 L 2 8.4"
                fill="none"
                stroke={toneColor[tone]}
                strokeWidth={16 / markerSize}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>
          ))}
          <pattern id={`${uid}-grid`} width={60} height={60} patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="var(--graphics-grid)" strokeWidth={1} />
          </pattern>
        </defs>

        {paper && <rect width={width} height={height} fill={PAPER} />}
        {grid && <rect width={width} height={height} fill={`url(#${uid}-grid)`} />}
        {children}
      </svg>
    </SceneContext.Provider>
  );
}

export function Node({
  x,
  y,
  r = geometry.radius,
  value,
  tone = "node",
  filled = false,
  changed = false,
  fontSize,
  strokeWidth = geometry.stroke,
  className,
  style
}: {
  x: number;
  y: number;
  r?: number;
  value?: string | number;
  tone?: Tone;
  /** The one "current" node: filled ink, paper numeral. */
  filled?: boolean;
  changed?: boolean;
  fontSize?: number;
  /** Thinner than the house weight where the drawing is a hairline. */
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const color = toneColor[tone];
  const size = fontSize ?? Math.round(r * 0.74);

  return (
    <g className={className} style={style}>
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={filled ? color : PAPER}
        stroke={color}
        strokeWidth={strokeWidth}
        style={settle(changed)}
      />
      {value !== undefined && (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size}
          fill={filled ? PAPER : color}
          className="font-mono"
          style={settle(changed)}
        >
          {value}
        </text>
      )}
    </g>
  );
}

export function Edge({
  kind = "straight",
  x1,
  x2,
  y,
  d,
  r = geometry.radius,
  gap = geometry.gap,
  depth,
  tone = "ink",
  width = geometry.edge,
  arrow = true,
  dash,
  pathLength,
  className,
  style
}: {
  kind?: "straight" | "curved";
  /** Row form: give x1/x2/y. Free form: give d. */
  x1?: number;
  x2?: number;
  y?: number;
  d?: string;
  r?: number;
  gap?: number;
  depth?: number;
  tone?: Tone;
  width?: number;
  arrow?: boolean;
  dash?: string;
  /**
   * Normalises the path's length, so a draw-on can be animated with
   * stroke-dashoffset from 1 to 0 without measuring the geometry first.
   */
  pathLength?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const uid = useContext(SceneContext);
  const path =
    d ??
    (kind === "curved"
      ? geometry.curvedEdge(x1 ?? 0, x2 ?? 0, y ?? 0, r, depth)
      : geometry.straightEdge(x1 ?? 0, x2 ?? 0, y ?? 0, r, gap));

  return (
    <path
      d={path}
      fill="none"
      stroke={toneColor[tone]}
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={dash}
      pathLength={pathLength}
      markerEnd={arrow ? `url(#${uid}-chevron-${tone})` : undefined}
      className={className}
      style={style}
    />
  );
}

/** A pointer that goes nowhere: a stub ending in a bar. */
export function Null({
  x,
  y,
  r = geometry.radius,
  gap = geometry.gap,
  length = 26,
  tone = "inactive",
  width = geometry.edge,
  className,
  style
}: {
  x: number;
  y: number;
  r?: number;
  gap?: number;
  length?: number;
  tone?: Tone;
  width?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <path
      d={geometry.nullStub(x, y, r, gap, length)}
      fill="none"
      stroke={toneColor[tone]}
      strokeWidth={width}
      strokeLinecap="round"
      className={className}
      style={style}
    />
  );
}

export function PointerPill({
  x,
  y,
  label,
  active = false,
  stem = 0,
  fontSize = 11,
  animate = true,
  className
}: {
  x: number;
  y: number;
  label: string;
  /** Exactly one pill per scene is active: filled ink, paper text. */
  active?: boolean;
  /** Length of the stem dropped towards the node below. 0 draws none. */
  stem?: number;
  fontSize?: number;
  animate?: boolean;
  className?: string;
}) {
  const height = fontSize + 9;
  const width = label.length * fontSize * 0.66 + 16;
  // No cross-fade: a pointer either is the active one or it is not. Fading ink
  // into paper passes through a grey where the fill and the text meet, which
  // reads as an unreadable third state. The pill snaps, the position eases.
  const swap: CSSProperties = {};

  return (
    <g
      className={className}
      style={animate ? hopTo(x, y) : { transform: `translate(${x}px, ${y}px)` }}
    >
      {stem > 0 && (
        <line
          x1={0}
          y1={height}
          x2={0}
          y2={height + stem}
          stroke={active ? FILL : INACTIVE}
          strokeWidth={1.5}
          strokeLinecap="round"
          style={swap}
        />
      )}
      <rect
        x={-width / 2}
        y={0}
        width={width}
        height={height}
        rx={height / 2}
        fill={active ? FILL : PAPER}
        stroke={active ? FILL : INACTIVE}
        strokeWidth={1.4}
        style={swap}
      />
      <text
        x={0}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fill={active ? ON_FILL : INK}
        className="font-mono"
        style={swap}
      >
        {label}
      </text>
    </g>
  );
}

/** Small uppercase mono caption, for tickers and labels inside a scene. */
export function Caption({
  x,
  y,
  children,
  anchor = "start",
  tone = "inactive",
  fontSize = 10
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
  tone?: Tone;
  fontSize?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="central"
      fontSize={fontSize}
      fill={toneColor[tone]}
      className="font-mono"
      style={{ letterSpacing: "0.09em" }}
    >
      {children}
    </text>
  );
}
