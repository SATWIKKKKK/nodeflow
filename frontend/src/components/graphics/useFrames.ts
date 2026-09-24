import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The frame stepper behind every illustration. It holds each frame for a fixed
 * beat rather than tweening between them, which is what makes the scenes read
 * like a debugger stepping instead of an animation playing.
 *
 * It also decides when *not* to run: offscreen scenes are paused, and a visitor
 * who asked for reduced motion gets the final frame and no timers at all.
 */

/**
 * One dial for how fast every illustration runs. The beats below are written at
 * their natural values and stretched by this, so the whole library can be slowed
 * or quickened without touching a single scene.
 */
export const PACE = 1.4;

export interface FrameOptions {
  /** Beat between frames. */
  intervalMs?: number;
  /**
   * A beat per frame, for timelines whose phases are not evenly spaced (draw
   * 300ms, hold 1.5s, retract 200ms). Overrides intervalMs and both holds.
   */
  durations?: readonly number[];
  /** Extra time on the first frame, so a loop has a readable starting point. */
  holdStartMs?: number;
  /** Extra time on the last frame before looping or resting. */
  holdEndMs?: number;
  /** false plays once and rests on the final frame. */
  loop?: boolean;
  /** Gate from an IntersectionObserver or a hover handler. */
  active?: boolean;
}

export interface Frames {
  index: number;
  /** The frame before this one, so callers animate only what changed. */
  previousIndex: number;
  atStart: boolean;
  atEnd: boolean;
  /** Jump back to frame 0 and play again (hover replays). */
  replay: () => void;
}

export function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && (window.matchMedia?.(query).matches ?? false)
  );

  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

/**
 * Tracks whether the element is on screen. Scenes below the fold cost nothing
 * until they are scrolled to, and stop again once they leave.
 */
export function useInView<T extends Element>(options?: { amount?: number; once?: boolean }) {
  const { amount = 0.2, once = false } = options ?? {};
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  /**
   * An observer does not report until after the first paint, which shows as a
   * beat of dead air on anything already on screen. Measure once before paint
   * so above-the-fold scenes are already running when they are first seen.
   */
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof window === "undefined") return;
    const rect = element.getBoundingClientRect();
    const onScreen =
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth;
    if (onScreen) setInView(true);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold: amount }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [amount, once]);

  return [ref, inView] as const;
}

export function useFrames(count: number, options: FrameOptions = {}): Frames {
  const {
    intervalMs = 520,
    durations,
    holdStartMs = 1200,
    holdEndMs = 1200,
    loop = true,
    active = true
  } = options;

  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const previousIndex = useRef(0);

  // Read through a ref, so a caller passing an inline array does not give the
  // effect a new identity on every render and restart the beat it is waiting
  // on. A long hold would otherwise never elapse.
  const beats = useRef(durations);
  beats.current = durations;

  const replay = useCallback(() => {
    previousIndex.current = 0;
    setIndex(0);
  }, []);

  useEffect(() => {
    if (reduced || !active || count < 2) return;

    const atEnd = index >= count - 1;
    if (atEnd && !loop) return;

    const wait =
      (beats.current?.[index] ?? (index === 0 ? holdStartMs : atEnd ? holdEndMs : intervalMs)) * PACE;
    const timer = window.setTimeout(() => {
      previousIndex.current = index;
      setIndex(atEnd ? 0 : index + 1);
    }, wait);

    return () => window.clearTimeout(timer);
  }, [reduced, active, count, index, loop, intervalMs, holdStartMs, holdEndMs]);

  // Reduced motion gets the settled picture: the frame the loop ends on.
  const shown = reduced ? count - 1 : index;

  return {
    index: shown,
    previousIndex: reduced ? count - 1 : previousIndex.current,
    atStart: shown === 0,
    atEnd: shown >= count - 1,
    replay
  };
}

/**
 * Card scenes loop for as long as they are on screen. They do not wait for a
 * pointer and they do not come to rest: hover is not available on a phone, and
 * a scene that has stopped reads as a broken image.
 */
export function useLoopInView(count: number, options: FrameOptions = {}) {
  const [ref, inView] = useInView<HTMLDivElement>({ amount: 0.25 });
  const frames = useFrames(count, { ...options, loop: true, active: inView });

  return { ref, frames, inView };
}
