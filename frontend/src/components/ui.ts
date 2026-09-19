/**
 * Control recipes from DESIGN.md §6. Every button, chip and field in the app
 * composes one of these, so the pill-and-uppercase language stays uniform.
 */

const base = "inline-flex items-center justify-center gap-2 rounded-full whitespace-nowrap";
const disabled = "disabled:cursor-not-allowed disabled:opacity-45";

export const button = {
  primary: `${base} lift fill-blue px-5 py-2.5 text-ui-label shadow-[0_8px_24px_rgba(29,78,216,0.22)] ${disabled}`,
  hero: `${base} lift landing-primary-action px-8 py-3.5 text-ui-label shadow-[0_14px_34px_rgba(17,17,17,0.22)]`,
  outline: `${base} lift border border-blueprint-line bg-card px-6 py-3 text-ui-label text-primary hover:bg-surface-hover ${disabled}`,
  outlineSm: `${base} lift border border-blueprint-line bg-card px-5 py-2.5 text-ui-label text-primary hover:bg-surface-hover ${disabled}`,
  ghost: `${base} px-3 py-2 text-ui-label text-primary hover:bg-surface-hover`,
  text: "text-ui-label text-primary transition-colors hover:text-blueprint-muted",
  icon: `flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blueprint-line bg-card text-blueprint-muted hover:text-primary ${disabled}`,
  close: "rounded-full border border-blueprint-line p-2 text-blueprint-muted hover:border-primary hover:text-primary",
  danger: `${base} bg-red-700 px-5 py-2.5 text-ui-label text-white hover:bg-red-800`,
  block: "mt-6 w-full justify-center"
};

export const chip = {
  base: "inline-flex items-center gap-1.5 rounded-full border border-blueprint-line bg-card px-3 py-1.5 text-ui-label text-primary",
  active: "fill-blue border-transparent",
  small: "inline-flex items-center rounded-full border border-blueprint-line px-2.5 py-1 text-xs font-semibold leading-none"
};

export const field = {
  label: "mb-2 block text-ui-label text-blueprint-muted",
  underline:
    "w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none transition-colors placeholder:text-blueprint-muted/70 focus:border-primary focus-visible:outline-none",
  select:
    "select-pill h-10 rounded-full border border-blueprint-line bg-card pl-4 pr-9 text-ui-label text-primary outline-none hover:bg-surface-hover"
};

export const container = "mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-12";

/** Icon tiles and step bubbles (DESIGN.md §7). */
export const iconTile =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blueprint-line bg-card text-primary";
export const stepIcon =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blueprint-line bg-card text-primary";

export const difficultyTone: Record<string, string> = {
  Easy: "text-blueprint-muted",
  Medium: "text-primary",
  Hard: "text-primary font-semibold"
};
