import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "../../lib/cn";
import { Edge, Node, Scene, HOP_EASE, HOP_MS } from "./primitives";
import { useFrames, useInView, usePrefersReducedMotion } from "./useFrames";

/**
 * The one animated word in the hero headline, and a readout of the wire drawn
 * under it. The wire re-routes on a loop and the word names what the wire is
 * doing at that moment: retrace, relink, reverse, rewire.
 *
 * The word is a pure function of the wire's frame index — there is no second
 * timer — so the two can never drift apart.
 *
 * Accessibility: the h1 above carries the whole sentence as its aria-label and
 * everything here is aria-hidden, so a screen reader or a crawler still reads
 * one ordinary heading. The words are stacked in a single grid cell, so the
 * slot is always as wide as the longest of them and "code" and "the list."
 * never move.
 */

const LETTER_MS = 60;
/** Reveal, two blinks, fade — see the nf-caret keyframes in index.css. */
const CARET_MS = 1550;

/**
 * One beat per state of the wire under the word, and the word names the state
 * it is in. The wire's own moves are quick — a retract is 220ms, a redraw is
 * 340ms — but a word must not flash past, so each quick move is followed by a
 * hold and every word gets the same 1500ms on screen.
 */
interface Beat {
  /** The half-word after the static "re". */
  suffix: string;
  ms: number;
  /** Which of the two routes is drawn during this beat. */
  route: "forward" | "rerouted" | "none";
}

const TIMELINE: readonly Beat[] = [
  { suffix: "trace", ms: 1500, route: "forward" },
  { suffix: "link", ms: 220, route: "none" },
  { suffix: "link", ms: 1280, route: "none" },
  { suffix: "verse", ms: 340, route: "rerouted" },
  { suffix: "verse", ms: 1160, route: "rerouted" },
  { suffix: "wire", ms: 1300, route: "rerouted" },
  { suffix: "wire", ms: 200, route: "none" }
] as const;

const PHASE_MS = TIMELINE.map((beat) => beat.ms);

/** The tittle sits on the i, then spends a moment over the last e. */
const TITTLE_MS = [8000, 1100] as const;

const STEM = "re";
const FINAL = "wire";
/** Every word, so the slot can be sized to the widest before anything moves. */
const ALL_SUFFIXES = [...new Set(TIMELINE.map((beat) => beat.suffix))];

const WIRE_H = 16;
const WIRE_Y = 4;
const NODE_R = 2.5;
const HAIRLINE = 1;

/** Dotless i, used only when the display font actually has the glyph. */
const DOTLESS = "ı";
const HEADLINE_FONT = 'italic 400 40px "Instrument Serif"';

/**
 * Whether the headline font can draw U+0131. Measured rather than assumed: the
 * face has to be loaded first, because canvas will not pull a webfont in on its
 * own and an unloaded face measures exactly like a missing glyph.
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

    // Were the glyph missing, both measurements would come from the same
    // fallback face and match to the last decimal. Any difference means the
    // headline font drew it itself.
    return present > 0 && Math.abs(present - fallback) > 0.05;
  } catch {
    return false;
  }
}

export function RewireWord({
  /**
   * Bumped by anything that wants the word to flash — the list band does it on
   * each rewire. The word brightens for 600ms; it does not change.
   */
  pulse = 0,
  /** Swaps the i's tittle for a node that visits the last e and comes back. */
  iDot = false,
  className
}: {
  pulse?: number;
  iDot?: boolean;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [hostRef, inView] = useInView<HTMLElement>({ amount: 0.2 });
  const wordRef = useRef<HTMLSpanElement>(null);
  const letterRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const [width, setWidth] = useState(0);
  const [centres, setCentres] = useState<number[]>([]);
  const [dotless, setDotless] = useState(false);

  const { index: beatIndex } = useFrames(TIMELINE.length, {
    durations: PHASE_MS,
    active: inView && !reduced
  });

  // Reduced motion gets the settled picture: "rewire", one straight underline.
  const beat = reduced ? TIMELINE[0] : TIMELINE[beatIndex];
  const suffix = reduced ? FINAL : beat.suffix;
  const isFinal = suffix === FINAL;

  const letters = [...suffix];
  const iIndex = letters.indexOf("i");
  const lastEIndex = letters.lastIndexOf("e");
  const showTittle = iDot && dotless && isFinal && iIndex >= 0 && lastEIndex >= 0;

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

  /** The wire spans the whole slot, so it has to be measured, not guessed. */
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
  }, [suffix, dotless]);

  /** 600ms of extra brightness, on demand and when the word lands on "rewire". */
  const brighten = () => {
    wordRef.current?.animate?.([{ filter: "brightness(1.35)" }, { filter: "brightness(1)" }], {
      duration: 600,
      easing: "ease-out"
    });
  };

  useEffect(() => {
    if (!pulse || reduced) return;
    brighten();
  }, [pulse, reduced]);

  // The word brightens as it lands on "rewire", not while it sits there.
  useEffect(() => {
    if (reduced || !isFinal) return;
    brighten();
  }, [isFinal, reduced]);

  const { index: tittleStop } = useFrames(TITTLE_MS.length, {
    durations: TITTLE_MS,
    active: showTittle && inView && !reduced
  });

  const route = reduced ? "forward" : beat.route;
  const forwardOut = route !== "forward";
  const reroutedOut = route !== "rerouted";

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
      : `stroke-dashoffset ${ms}ms linear, stroke 600ms linear, opacity 1ms linear ${out ? ms : 0}ms`
  });

  const tittleX = showTittle ? (centres[tittleStop === 1 ? lastEIndex : iIndex] ?? 0) : 0;

  return (
    <em
      ref={hostRef}
      className={cn("relative inline-grid align-baseline italic", className)}
      style={{ justifyItems: "center" }}
    >
      {/* Sized to the longest word, so nothing around it can be pushed about. */}
      {ALL_SUFFIXES.map((candidate) => (
        <span key={candidate} aria-hidden className="invisible" style={{ gridArea: "1 / 1" }}>
          {STEM}
          {candidate}
        </span>
      ))}

      <span className="sr-only">rewire</span>

      <span
        ref={wordRef}
        aria-hidden
        className="hero-accent relative whitespace-nowrap"
        style={{ gridArea: "1 / 1" }}
      >
        {STEM}
        {letters.map((letter, index) => (
          <span
            // Keyed by the word, so every swap replays the reveal from the left.
            key={`${suffix}-${index}`}
            ref={(element) => {
              letterRefs.current[index] = element;
            }}
            style={
              reduced
                ? undefined
                : {
                    // `backwards` hides the letter only while its delay runs.
                    // The letter's own style stays visible, so if animations
                    // never run — an old engine, a blocked stylesheet — the
                    // word is still readable rather than invisible.
                    animation: `nf-letter-step ${LETTER_MS}ms steps(1, jump-end) ${
                      index * LETTER_MS
                    }ms backwards`
                  }
            }
          >
            {showTittle && index === iIndex ? DOTLESS : letter}
          </span>
        ))}

        {/* The caret types the first word in, then blinks twice and goes. */}
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
        The underline: a wire with a node at each end, which lets go of its first
        route and draws a new one left to right. Deliberately hairline and low
        contrast — an underline that happens to be a pointer, not a diagram
        competing with the headline.
      */}
      {width > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 block w-full"
          style={{ gridArea: "1 / 1", top: "100%", marginTop: "-0.06em" }}
        >
          <Scene width={width} height={WIRE_H} label="" markerSize={4}>
            <Edge
              d={`M ${NODE_R * 2 + 3} ${WIRE_Y} H ${width - NODE_R * 2 - 4}`}
              tone="accent"
              width={HAIRLINE}
              pathLength={1}
              style={drawTiming(forwardOut, forwardOut ? 220 : 340)}
            />
            <Edge
              d={`M ${NODE_R * 2 + 3} ${WIRE_Y} Q ${width / 2} ${WIRE_Y + 15} ${
                width - NODE_R * 2 - 4
              } ${WIRE_Y}`}
              tone="accent"
              width={HAIRLINE}
              pathLength={1}
              style={drawTiming(reroutedOut, reroutedOut ? 220 : 340)}
            />
            <Node x={NODE_R + 1} y={WIRE_Y} r={NODE_R} tone="accent" strokeWidth={HAIRLINE} />
            <Node
              x={width - NODE_R - 1}
              y={WIRE_Y}
              r={NODE_R}
              tone="accent"
              strokeWidth={HAIRLINE}
            />
          </Scene>
        </span>
      )}
    </em>
  );
}
