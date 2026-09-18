import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The frame stepper behind every illustration. It holds each frame for a fixed
 * beat rather than tweening between them, which is what makes the scenes read
 * like a debugger stepping instead of an animation playing.
 *
 * It also decides when *not* to run: offscreen scenes are paused, and a visitor
 * who asked for reduced motion gets the final frame and no timers at all.
 */

export interface FrameOptions {
  /** Beat between frames. */
  intervalMs?: number;
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
    holdStartMs = 1200,
    holdEndMs = 1200,
    loop = true,
    active = true
  } = options;

  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const previousIndex = useRef(0);

  const replay = useCallback(() => {
    previousIndex.current = 0;
    setIndex(0);
  }, []);

  useEffect(() => {
    if (reduced || !active || count < 2) return;

    const atEnd = index >= count - 1;
    if (atEnd && !loop) return;

    const wait = index === 0 ? holdStartMs : atEnd ? holdEndMs : intervalMs;
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
 * The feature cards play once when scrolled to and again on hover or focus —
 * six scenes looping at once is noise, so they rest on their final frame.
 */
export function useReplayOnHover(count: number, options: FrameOptions = {}) {
  const [ref, inView] = useInView<HTMLDivElement>({ amount: 0.35, once: true });
  const frames = useFrames(count, { ...options, loop: false, active: inView });
  const { replay } = frames;

  const handlers = {
    onMouseEnter: replay,
    onFocus: replay
  };

  return { ref, frames, handlers, inView };
}
