/**
 * Marketing illustrations. Everything is SVG drawn from the primitives in
 * primitives.tsx, stepped by useFrames, and coloured only through the
 * --graphics-* variables in index.css.
 */

export { Scene, Node, Edge, Null, PointerPill, Caption } from "./primitives";
export type { Tone } from "./primitives";
export { geometry } from "./geometry";
export { useFrames, useInView, useReplayOnHover, usePrefersReducedMotion } from "./useFrames";

export { ReverseListBand } from "./ReverseListBand";
export { LogoDrawIn } from "./LogoDrawIn";
export { MarginVignettes } from "./MarginVignettes";
export { CtaLogoField } from "./CtaLogoField";
export { TopicSigil, topicSigilNames, resolveTopic } from "./TopicSigil";

export { WriteScene, RunScene, TraceScene, ReplayScene, stepScenes } from "./steps";
export {
  RunGraphic,
  TestGraphic,
  SubmitGraphic,
  PreviewGraphic,
  DiffGraphic,
  FaultGraphic,
  featureGraphics
} from "./features";
export { ProblemDots, StructureGraph, LanguagePills, StepLimitGlyph } from "./metrics";
