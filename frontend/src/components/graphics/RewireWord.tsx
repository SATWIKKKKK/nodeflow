import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "../../lib/cn";
import { Edge, Node, Scene, ACCENT, HOP_EASE, HOP_MS, INACTIVE } from "./primitives";
import { useFrames, useInView, usePrefersReducedMotion } from "./useFrames";

/**
 * The one animated word in the hero headline. It types itself in on first load,
 * then rests under a hairline wire that rewires itself on a loop — the headline
 * demonstrating its own claim at the smallest possible scale.
 *
 * Accessibility: the h1 above carries the full sentence as its aria-label and
 * everything here is aria-hidden, so screen readers and crawlers read one
 * ordinary heading. Letters reveal with opacity rather than being inserted, so
 * the word occupies its final width from the first frame and nothing shifts.
 */

const LETTER_MS = 90;
/** Reveal, two blinks, fade — see the nf-caret keyframes in index.css. */
const CARET_MS = 1550;

/**
 * The underline's loop, about six seconds: hold the forward edge, retract it,
 * draw the back-arc in accent, let the accent settle to the muted stroke, hold,
 * then clear for the next pass.
 */
const PHASES = {
  forward: 0,
  retract: 1,
  drawBack: 2,
  backAccent: 3,
  backSettled: 4,
  clear: 5
} as const;
const PHASE_MS = [1800, 200, 300, 300, 3200, 200] as const;

/** The tittle sits on the i, then spends a moment over the last e. */
const TITTLE_MS = [8000, 1100] as const;

const WIRE_H = 16;
const WIRE_Y = 4;
const NODE_R = 2.5;
const HAIRLINE = 1;

/** Dotless i, used only when the display font actually has the glyph. */
const DOTLESS = "ı";

/** The face the headline actually renders in. */
const HEADLINE_FONT = 'italic 400 40px "Instrument Serif"';

/**
 * Whether the headline font can draw U+0131. Measured rather than assumed: if
 * the glyph is missing the browser falls back, and the fallback measures the
 * same as a font name that does not exist. The face has to be loaded first —
 * canvas does not pull a webfont in on its own, and an unloaded face measures
 * exactly like a missing one.
 */
async function fontHasDotlessI() {
  try {
    const faces = await document.fonts?.load(HEADLINE_FONT, DOTLESS);
    if (!faces?.length) return false;

    const context = document.createElement("canvas").getContext("2d");
    if (!context) return false;
    context.font = HEADLINE_FONT;
    const present = context.measureText(DOTLESS).width;
    context.font = 'italic 400 40px "__nf_absent_family__"';
    const fallback = context.measureText(DOTLESS).width;

    // If the glyph were missing, both measurements would come from the same
    // fallback face and be identical to the last decimal. Any difference at all
    // means the headline font drew it itself.
    return present > 0 && Math.abs(present - fallback) > 0.05;
  } catch {
    return false;
  }
}

export function RewireWord({
  word = "rewire",
  /**
   * Bumped by the hero band every time it rewires an edge. The word brightens
   * for ~600ms in response, so the two stay in step without a second timer.
   */
  pulse = 0,
  /** Swaps the i's tittle for a node that visits the last e and comes back. */
  iDot = false,
  className
}: {
  word?: string;
  pulse?: number;
  iDot?: boolean;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [hostRef, inView] = useInView<HTMLElement>({ amount: 0.4 });
  const wordRef = useRef<HTMLSpanElement>(null);
  const letterRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const letters = [...word];
  const iIndex = letters.findIndex((letter) => letter.toLowerCase() === "i");
  const lastEIndex = letters.map((letter) => letter.toLowerCase()).lastIndexOf("e");

  const [width, setWidth] = useState(0);
  const [centres, setCentres] = useState<number[]>([]);
  const [dotless, setDotless] = useState(false);

  const showTittle = iDot && dotless && iIndex >= 0 && lastEIndex >= 0;

  useEffect(() => {
    if (!iDot) return;
    let live = true;
    fontHasDotlessI().then((supported) => {
      if (live) setDotless(supported);
    });
    return () => {
      live = false;
    };
  }, [iDot]);

  /** The wire spans the word, so it has to be measured, not guessed. */
  useLayoutEffect(() => {
    const element = wordRef.current;
    if (!element) return;

    const measure = () => {
      setWidth(element.offsetWidth);
      setCentres(
        letterRefs.current.map((letter) => (letter ? letter.offsetLeft + letter.offsetWidth / 2 : 0))
      );
    };

    measure();
    document.fonts?.ready.then(measure).catch(() => {});

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [word, dotless]);

  /** One 600ms brightening per rewire in the band. No movement, no re-render. */
  useEffect(() => {
    if (!pulse || reduced) return;
    wordRef.current?.animate?.(
      [{ filter: "brightness(1.35)" }, { filter: "brightness(1)" }],
      { duration: 600, easing: "ease-out" }
    );
  }, [pulse, reduced]);

  const { index: phase } = useFrames(PHASE_MS.length, {
    durations: PHASE_MS,
    active: inView && !reduced
  });

  const { index: tittleStop } = useFrames(TITTLE_MS.length, {
    durations: TITTLE_MS,
    active: showTittle && inView && !reduced
  });

  // Reduced motion gets the settled picture: the word, one straight underline.
  const stage = reduced ? PHASES.forward : phase;
  const forwardOut = stage !== PHASES.forward;
  const backOut = stage < PHASES.drawBack || stage === PHASES.clear;
  const backTone = stage === PHASES.drawBack || stage === PHASES.backAccent ? "accent" : "inactive";

  /**
   * A marker is not clipped by stroke-dasharray, so a fully retracted edge would
   * leave its chevron floating on its own. The edge is hidden outright once the
   * retraction has finished, and shown again the instant it starts to draw.
   */
  const drawTiming = (out: boolean, ms: number): CSSProperties => ({
    strokeDasharray: 1,
    strokeDashoffset: out ? 1 : 0,
    opacity: out ? 0 : 1,
    transition: reduced
      ? "none"
      : `stroke-dashoffset ${ms}ms linear, stroke 600ms linear, opacity 1ms linear ${
          out ? ms : 0
        }ms`
  });

  const tittleX = showTittle
    ? (tittleStop === 1 ? centres[lastEIndex] : centres[iIndex]) ?? 0
    : 0;

  return (
    <em
      ref={hostRef}
      aria-hidden
      className={cn("hero-accent relative inline-block italic", className)}
    >
      <span ref={wordRef} className="relative inline-block whitespace-nowrap">
        {letters.map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            ref={(element) => {
              letterRefs.current[index] = element;
            }}
            style={
              reduced
                ? undefined
                : {
                    opacity: 0,
                    animation: `nf-letter-step ${LETTER_MS}ms steps(1, jump-end) ${
                      index * LETTER_MS
                    }ms forwards`
                  }
            }
          >
            {showTittle && index === iIndex ? DOTLESS : letter}
          </span>
        ))}

        {/* The caret types the word in, then blinks twice and goes. */}
        {!reduced && (
          <span
            className="absolute top-[0.16em] block w-0.5 bg-current"
            style={{
              left: "100%",
              height: "0.68em",
              opacity: 0,
              animation: `nf-caret ${CARET_MS}ms linear forwards`
            }}
          />
        )}

        {/* The i's tittle, off visiting the last e. */}
        {showTittle && centres.length > 0 && (
          <span
            className="absolute block rounded-full bg-current"
            style={{
              top: "0.02em",
              left: 0,
              height: "0.11em",
              width: "0.11em",
              // The letter box centres on the glyph, but an italic stem leans
              // right of it, so the dot is nudged over to sit on top of it.
              transform: `translateX(${tittleX}px) translateX(-50%) translateX(0.06em)`,
              transition: reduced ? "none" : `transform ${HOP_MS}ms ${HOP_EASE}`
            }}
          />
        )}
      </span>

      {/*
        The underline: a wire with a node at each end. Deliberately hairline and
        low contrast — it reads as an underline that happens to be a pointer,
        not as a diagram competing with the headline.
      */}
      {width > 0 && (
        <span
          className="pointer-events-none absolute left-0 block w-full"
          style={{ top: "100%", marginTop: "-0.06em" }}
        >
          <Scene width={width} height={WIRE_H} label="" markerSize={4}>
            <Edge
              d={`M ${NODE_R * 2 + 3} ${WIRE_Y} H ${width - NODE_R * 2 - 4}`}
              tone="inactive"
              width={HAIRLINE}
              pathLength={1}
              style={drawTiming(forwardOut, forwardOut ? 200 : 300)}
            />
            <Edge
              d={`M ${width - NODE_R * 2 - 4} ${WIRE_Y} Q ${width / 2} ${WIRE_Y + 15} ${
                NODE_R * 2 + 3
              } ${WIRE_Y}`}
              tone={backTone}
              width={HAIRLINE}
              pathLength={1}
              style={drawTiming(backOut, backOut ? 200 : 300)}
            />
            <Node x={NODE_R + 1} y={WIRE_Y} r={NODE_R} tone="inactive" strokeWidth={HAIRLINE} />
            <Node
              x={width - NODE_R - 1}
              y={WIRE_Y}
              r={NODE_R}
              tone="inactive"
              strokeWidth={HAIRLINE}
            />
          </Scene>
        </span>
      )}
    </em>
  );
}

/** Exported for the hero, which needs the same colours as the word. */
export const rewireTones = { accent: ACCENT, inactive: INACTIVE };
