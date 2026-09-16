# Repoid Design System

This file documents the design system behind repoid.space: the fonts, colors, surfaces, controls, icons, layout and motion. It is written so the same look can be rebuilt in another project. The values here come from the shipped code, mainly `src/index.css`, `src/views/Landing.tsx` and the shared components in `src/components/`.

**Style in one line:** a warm, monochrome "blueprint" look. Serif headlines sit on an off-white page with a faint grid, cards have thin warm-gray borders and soft deep shadows, and every button is a pill with an uppercase label.

---

## 1. Stack

| Concern | Choice |
|---|---|
| CSS | Tailwind CSS v4 (`@tailwindcss/vite`), `tw-animate-css`, shadcn base CSS (style `base-nova`, base color `neutral`) |
| Icons | `lucide-react` |
| Motion | `framer-motion` |
| Fonts | Google Fonts (Instrument Serif, JetBrains Mono) and `@fontsource-variable/geist` |
| Dark mode | A `.dark` class on `<html>`, set by an inline script before first paint. The default theme is light. |

```bash
npm i tailwindcss @tailwindcss/vite tw-animate-css @fontsource-variable/geist lucide-react framer-motion clsx tailwind-merge
```

---

## 2. Typography

### Font families

| Role | Font | Weights |
|---|---|---|
| Display and headlines | **Instrument Serif** | 400 (regular and italic) |
| Body and UI | **Geist Variable** | variable (500 for labels, 600 for emphasis) |
| Technical / mono | **JetBrains Mono** | 400, 500 |

> Note: the Repoid CSS also loads Inter and declares it as `--font-sans`, but a later `@theme inline` block changes `--font-sans` to Geist. **Geist is the font that actually shows on the page.** In a new project, load Geist and skip Inter.

### Type scale

| Class / usage | Font | Size | Line height | Notes |
|---|---|---|---|---|
| Landing hero `h1` | serif | `clamp(2.4rem, 5.5vw, 4.5rem)` | 1.05 | `max-w-3xl`, centered |
| `.text-display-xl` | serif | `clamp(2rem, 6.8vw, 56px)` | 1.08 | letter-spacing 0 |
| CTA panel headline | serif | `clamp(2rem, 5vw, 3.75rem)` | 1.05 | |
| `.text-headline-lg` | serif | `clamp(1.75rem, 5.6vw, 40px)` | 1.18 | Section `h2`, modal titles |
| Stat / metric number | serif | `clamp(1.8rem, 3.5vw, 2.4rem)` | 1 | |
| `.text-headline-md` | serif | `clamp(1.35rem, 4.8vw, 28px)` | 1.28 | **Italic** by default; add `not-italic` for plain titles |
| `.text-body-lg` | sans | 18px | 1.6 | Lead paragraphs |
| `.text-body-md` | sans | 15px | 1.6 | Default body copy |
| `.text-ui-label` | sans | 14px | 1.15 | **weight 500, UPPERCASE**. Used for every button, nav item, eyebrow and chip |
| `.text-technical-mono` | mono | 12px | 1.4 | UPPERCASE, `0.02em` tracking |
| Dropdown / meta text | sans | 14px (`text-sm`) / 12px (`text-xs`) | | |

> Card `h3`s in Repoid use a `text-headline-sm` class that is never defined, so they show as plain 16px Geist. Section 11 includes an optional definition if you want serif card titles.

### Section heading pattern
Every section uses the same three-part heading:

```html
<p  class="text-ui-label text-blueprint-muted">Pricing</p>                 <!-- eyebrow -->
<h2 class="mt-2 text-headline-lg text-primary">Start free, then…</h2>       <!-- serif title -->
<p  class="mt-4 text-body-lg text-blueprint-muted">Supporting copy…</p>    <!-- lead -->
```
Wrap the three elements in `mb-10 max-w-3xl`.

---

## 3. Color

The palette is monochrome with a faint warm pink tint (OKLCH hue 20). Accent colors appear only where they carry meaning.

### Light mode

| Token | Value | Use |
|---|---|---|
| `--color-background` | `#fbf9f9` | Page, header, sidebar |
| `--card` | `#ffffff` | Cards, popovers, icon buttons |
| `--color-primary` | `#1a1a1a` | Text, primary buttons |
| Landing primary button | `#111111` | Hover `#303031` |
| Primary hover | `#303031` | |
| `--color-blueprint-muted` | `#4d4d4d` | Secondary text, eyebrows |
| `--color-blueprint-line` | `#c7c0c0` | **All borders and dividers** |
| Hover surface | `#f5f3f3` | Hover on ghost and outline buttons, dropdown rows |
| Inset surface | `#f3f0f0` | `.surface-inset` |
| `--secondary` / `--muted` / `--accent` | `oklch(0.95 0.004 20)` | |
| `--border` / `--input` | `oklch(0.78 0.004 20)` | |
| `--ring` | `oklch(0.55 0 0)` | Focus: 2px outline, 2px offset, 70% opacity |
| `--destructive` | `oklch(0.577 0.245 27.325)` | |
| Header divider | `inset 0 -1px 0 rgba(0,0,0,.12)` | |

### Dark mode

| Token | Value |
|---|---|
| Body, header, nav background | `#050505` |
| `--color-background` / `--color-blueprint-bg` | `#151515` |
| `--card` | `oklch(0.205 0 0)` (≈ `#171717`) |
| Panel background (replaces `#fbf9f9` / `#f5f3f3` / `#efeded`) | `#101010` |
| `bg-white` variants | `rgba(16,16,16,.96)` |
| Hover surface | `#181818` or `rgba(255,255,255,.05)` |
| Inset surface | `#202020` |
| Line | `#3a3a3a` |
| Muted text | `#b7b7b7` |
| Body text | `#f4f4f4` |
| Primary button | `#f3ecec` background, `#111111` text, hover `#e9dddd` |
| `--border` / `--input` | `oklch(1 0 0 / 10%)` / `15%` |
| Header divider | `inset 0 -1px 0 rgba(255,255,255,.08)` |

### Accent and status colors

| Purpose | Light | Dark |
|---|---|---|
| Success check icon | `#16a34a` | `#4ade80` |
| Progress / readiness bar | `#16a34a` | `#22c55e` |
| "Current" / "Latest" badge | neutral border and card | border `rgba(52,211,153,.45)`, background `rgba(16,185,129,.12)`, text `#6ee7b7` |
| Language / tech tag | background `#123d8a`, text `#fff`, border `rgba(147,197,253,.35)` | same |
| Domain pill | `blue-700`, white text | `blue-600` |
| Page progress bar | `blue-500` | `blue-500` |
| Error | text `red-600`/`red-700`, background `red-50`/`#fff5f5`, border `red-200` | background `#2a1010`, text `#fecaca`, border `red-500/50` |
| Warning | background `amber-50`, text `amber-700`/`amber-800`, border `amber-300/60` | background `#2b1d08`, text `#ffe4b5` |
| Charts | grayscale: `oklch(0.87 / 0.556 / 0.439 / 0.371 / 0.269, chroma 0)` | same |

**Rule:** green is used only on purpose. Repoid's CSS forces `emerald-*` utilities back to neutral in both themes, except on the specific classes that should stay green.

---

## 4. Radius, borders and shadows

The base radius is `--radius: 0.625rem` (10px). The Tailwind radius scale is calculated from it:

| Token | Size | Typical use |
|---|---|---|
| `rounded-sm` | 6px | rare |
| `rounded-md` | 8px | rare |
| `rounded-lg` | 10px | Sidebar nav items, small icon buttons |
| `rounded-xl` | 14px | FAQ items, dropdown rows, CTA panel |
| `rounded-2xl` | 18px | Floating navbar, dropdowns, inner panels, domain icon tiles |
| `rounded-3xl` | 22px | Auth card |
| `rounded-[28px]` | 28px | **Modals** |
| `rounded-full` | pill | **All buttons**, chips, avatars, icon buttons, search bar |

Borders are usually 1px in the line color. Card surfaces use **1.25px**.

### Shadow scale

| Name | Value |
|---|---|
| Card | `inset 0 0 0 1px rgba(0,0,0,.035), 0 14px 34px rgba(0,0,0,.08)` |
| Compact card | `inset 0 0 0 1px rgba(0,0,0,.035), 0 10px 26px rgba(0,0,0,.07)` |
| FAQ item | `0 10px 26px rgba(0,0,0,.06)` |
| Button hover (global) | `0 10px 24px rgba(0,0,0,.10)`; dark `.35` |
| Button active | `0 5px 14px rgba(0,0,0,.10)` |
| Primary button | `0 8px 24px rgba(26,26,26,.16)` |
| Hero button | `0 14px 34px rgba(17,17,17,.22)` |
| Search bar | `inset 0 0 0 1px rgba(0,0,0,.03), 0 12px 28px rgba(0,0,0,.08)` |
| Floating navbar | `0 18px 42px rgba(0,0,0,.08)`; dark `.35` |
| Dropdown / popover | `0 18px 40px rgba(0,0,0,.14)`; dark `.32` |
| Featured card | `0 20px 48px rgba(0,0,0,.14)` |
| Modal | `0 28px 80px rgba(0,0,0,.18)` |
| Auth card | `0 20px 40px -15px rgba(0,0,0,.04)` |

---

## 5. Surfaces

| Class | Border | Radius | Padding (mobile → ≥640px) | Background | Shadow |
|---|---|---|---|---|---|
| `.surface-card` | 1.25px line | 12px | 24px → 28px | card | Card |
| `.surface-card-compact` | 1.25px line | 12px | 16px 20px → 18px 20px | card | Compact card |
| `.surface-inset` | 1.25px line | 12px | 16px → 18px | `#f3f0f0` / dark `#202020` | none |
| Modal | 1px line | 28px | 24px → 28px | card | Modal, `max-w-md` (448px) or `max-w-lg` |
| Modal backdrop | none | none | `px-4` | `bg-black/45` and `backdrop-blur-sm` | none |
| Dropdown | 1px line | 18px | `py-2`, rows `px-4 py-2.5` | card | Dropdown, `min-w-[220px]` |
| Auth card | 1px line | 22px | 24px → 32px | `white/90` | Auth card, `max-w-[480px]` |
| CTA panel | 1px `#f3ecec` | 14px | 24px → 28px | `#050505`, white text | `0 14px 34px rgba(0,0,0,.14)` plus `outline: 1px solid rgba(243,236,236,.86); outline-offset: 3px` |
| Featured pricing card | `border-primary` | 12px | as `.surface-card` | card | Featured card; `min-h-[430px]`; "Most Popular" pill `absolute right-5 top-5` |

Inside cards, a horizontal divider is `my-6 h-px bg-blueprint-line`.

---

## 6. Controls

### Buttons
Every enabled button gets this treatment globally:
```css
button:not(:disabled) { transition: color, background-color, border-color, box-shadow, transform, opacity 180ms ease; }
button:not(:disabled):hover  { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(0,0,0,.10); }
button:not(:disabled):active { transform: translateY(0);    box-shadow: 0 5px 14px rgba(0,0,0,.10); }
```

| Variant | Classes |
|---|---|
| Primary | `rounded-full bg-primary px-5 py-2.5 text-ui-label text-white hover:bg-[#303031]` |
| Hero primary | `inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-ui-label` with an `ArrowRight` icon at 14px |
| Outline | `inline-flex items-center gap-2 rounded-full border border-blueprint-line bg-card px-6 py-3 text-ui-label text-primary hover:bg-[#f5f3f3] dark:hover:bg-white/5` |
| Ghost nav link | `rounded-full px-3 py-2 text-ui-label text-primary hover:bg-[#f5f3f3]` |
| Text link | `text-ui-label text-primary hover:text-blueprint-muted` |
| Full-width card button | `mt-6 w-full justify-center rounded-full px-5 py-3` |
| Icon button | `flex h-10 w-10 items-center justify-center rounded-full border border-blueprint-line bg-card text-blueprint-muted hover:text-primary` with a 16px icon |
| Close button (modal) | `rounded-full border border-blueprint-line p-2 hover:border-primary` |
| Danger | `rounded-full bg-red-700 px-5 py-2.5 text-white hover:bg-red-800` |

### Chips and pills
- **Default chip:** `rounded-full border border-blueprint-line bg-card px-3 py-1 text-ui-label` (or `py-1.5`)
- **Active filter chip:** `border-primary bg-primary text-white`
- **Small badge:** `rounded-full px-2.5 py-1 text-xs font-semibold leading-none`
- **Avatar:** `h-9 w-9 rounded-full border bg-card text-sm font-semibold`, showing 2-letter initials

### Inputs
- **Underline input (forms):** `w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md outline-none focus:border-primary`
- **Field label:** `mb-2 block text-ui-label text-blueprint-muted`
- **"Or" divider:** `flex items-center gap-4`, with `h-px flex-1 bg-blueprint-line` on each side of a `text-ui-label`
- **Pill search bar:** `h-12 rounded-full border bg-card`
  - Search icon: 16px, `absolute left-4`
  - Input: `pl-11 pr-14`
  - Submit button: `h-8 w-8 rounded-full` at `right-2`
  - Width: `max-w-[34rem]` (compact) or `42rem`
  - Results popover: `top-[calc(100%+0.55rem)] rounded-2xl p-2`

### Other components
- **FAQ accordion:** `rounded-xl border bg-card px-5 py-5 text-left`. The question uses `text-body-lg font-semibold`, the answer `mt-3 text-body-md` in muted color, and a 18px `ChevronDown` rotates 180° when open.
- **Spinner:** `h-8 w-8 animate-spin rounded-full border-2 border-blueprint-line border-t-primary`
- **Social / OAuth buttons:** `h-11 w-11 rounded-full border bg-white`
- **Scrollbar:** 6px wide, transparent track, `rounded-full` thumb in the line color

### Accessibility and mobile
- Focus style: `outline-2 outline-offset-2 outline-ring/70` on buttons, links, inputs and anything with `tabindex`.
- Inputs, textareas, selects and buttons use `font-size: 16px`, which stops iOS from zooming in.
- At ≤480px, buttons are at least **44px** tall and buttons inside forms go **full width**.
- `html`, `body` and `#root` use `overflow-x: hidden; max-width: 100vw`, and media elements use `max-width: 100%; height: auto`.

---

## 7. Icons

**Library:** `lucide-react` with the default 2px stroke.

| Size | Use |
|---|---|
| 13–14 | Arrows inside buttons, dropdown row icons, chevrons |
| 15 | Icons inside pills and chips |
| **16** | Icon buttons (most common) |
| 17–18 | Sidebar nav, status icons, FAQ chevron |
| 20 | Feature tile icons, quote marks |
| 22–28 | Large empty or hero states (rare) |

**Icon containers**
- Step icon: `h-10 w-10 rounded-full border border-blueprint-line bg-card`, 18px icon
- Feature / domain tile: `h-12 w-12 rounded-2xl border border-blueprint-line bg-card`, 20px icon
- Status bubble: `rounded-full border p-2`

**Icon set:** `ArrowRight`, `ArrowLeft`, `Check`, `CheckCircle2`, `ChevronDown`, `ChevronLeft`, `MoonStar` / `SunMedium` (theme toggle), `Menu`, `X`, `Search`, `Github`, `BrainCircuit`, `Code2`, `ServerCog`, `Database`, `BarChart3`, `ShieldCheck`, `Layers3`, `Quote`, `Home`, `Workflow`, `FileText`, `Terminal`, `Activity`, `LibraryBig`, `ListChecks`, `CreditCard`, `Bookmark` / `BookmarkCheck`, `Settings`, `LogOut`, `LoaderCircle` / `Loader2` (with `animate-spin`), `AlertCircle`, `AlertTriangle`, `Clock3`, `History`, `RefreshCw`, `Trash2`.

Icons are usually colored `text-blueprint-muted`, and they switch to `text-primary` when active or hovered.

---

## 8. Logo and imagery

- **Logo:** a line drawing on a 400×400 `viewBox`. Strokes are **16px** with `round` caps and joins, and circular nodes have `r=22`. It uses one ink color: `#111111`/`#1a1a1a` in light mode and white in dark mode. A `<Logo>` component switches the `src` based on the resolved theme.
- **Logo heights (always `w-auto`):**

  | Where | Height |
  |---|---|
  | Landing navbar | `h-8` → `sm:h-10` → `md:h-12` → `lg:h-14` (32–56px) |
  | Sidebar | `h-10` → `sm:h-12` |
  | Footer | `h-8` |

- **Favicon:** the black logo SVG
- **Raster assets:** 1024×1024 PNG
- **OG image:** `/og-image.png`, with `twitter:card = summary_large_image`
- **Image rule:** `img, svg, video, canvas { max-width: 100%; height: auto; }`

---

## 9. Background: the blueprint grid

The landing page stacks two fixed layers under the content, which sits at `relative z-10`:

```html
<div class="pointer-events-none fixed inset-0 landing-blueprint-grid opacity-30 dark:opacity-25"></div>
<div class="pointer-events-none fixed inset-0 opacity-20 dark:opacity-30">
  <BackgroundRippleEffect rows={12} cols={32} cellSize={64} className="landing-ripple-theme" />
</div>
```

| Layer | Spec |
|---|---|
| `.landing-blueprint-grid` | 40px cells; 1.25px lines at `rgba(17,24,39,.07)` (dark `rgba(255,255,255,.05)`) |
| `.blueprint-grid` (app / auth pages) | 48px cells; 1px lines at `rgba(26,26,26,.12)` (dark `rgba(255,255,255,.095)`), `opacity-30` |
| `.bg-technical-grid` | 64px cells; 1px lines at `rgba(26,26,26,.12)` |
| Ripple grid | Aceternity `background-ripple-effect`: 64px cells, `mask-radial-from-20% mask-radial-at-top`, cells `opacity-40` → `hover:opacity-80`. Clicking a cell starts a ripple with a delay of `distance × 55ms` and a duration of `200 + distance × 80ms`. Cell colors: light border `rgba(17,24,39,.08)`, fill `rgba(255,255,255,.28)`; dark border `rgba(255,255,255,.07)`, fill `rgba(15,23,42,.06)`, inner glow `rgba(56,189,248,.10)`. |

---

## 10. Layout

### Page frame
- **Container:** `mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-12` (Repoid writes the width as `max-w-360`)
- **Floating landing navbar:** `sticky top-3 z-40 mx-3 rounded-2xl border` (`sm:top-4 sm:mx-4`), card background, navbar shadow. Inner row: `min-h-14 px-4 py-2 sm:px-8 lg:px-12`. Links are hidden below `lg`.
- **Hero:** `min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center py-16 sm:py-20 text-center`. The paragraph uses `mt-6 max-w-xl text-[clamp(1rem,2vw,1.2rem)] leading-8`, and the CTA row sits at `mt-8`.
- **Sections:** `py-16 sm:py-20`. Sections alternate: every other one gets `border-y border-blueprint-line`, which gives a ruled, blueprint rhythm.
- **Footer:** `border-t py-10`, grid `lg:grid-cols-[1.1fr_2fr]`, link groups in `sm:grid-cols-2 lg:grid-cols-4`. Group titles use `text-ui-label`; links are `text-body-md` in muted color and turn primary on hover.

### Grids

| Pattern | Classes |
|---|---|
| Metrics strip | `grid grid-cols-2 gap-4 xl:grid-cols-4` |
| Feature cards | `grid gap-5 sm:grid-cols-2 lg:grid-cols-3` |
| Domain cards | `grid gap-4 md:grid-cols-2 xl:grid-cols-3` |
| Steps | `grid gap-5 sm:grid-cols-2 lg:grid-cols-4`, each item `border-l border-blueprint-line pl-5` |
| Split text / cards | `grid gap-6 lg:grid-cols-[0.9fr_1.1fr]` |
| FAQ split | `grid gap-8 lg:grid-cols-[0.7fr_1fr]` |
| Title + action | `flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between` |

### App shell
- **Structure:** `flex h-screen overflow-hidden`, with the sidebar on the left and the header and scrolling `main` on the right.
- **Header:** `sticky top-0 z-40 h-16 border-b bg-background px-4 sm:px-6 lg:px-8`. Search is centered at `lg` and above; on smaller screens it moves to its own row below the header.
- **Sidebar:** **280px** wide, **84px** collapsed (width animated), `px-4 py-8 border-r`. The logo sits at `mb-8`, and settings are grouped at the bottom with `mt-6 border-t pt-4`.
- **Nav item:** `flex items-center gap-3 rounded-lg px-4 py-3 text-ui-label`. The active item gets `border-l-2 border-primary font-semibold`; inactive items are muted.
- **Mobile drawer:** 280px wide, slides in from `x:-320`, with a `bg-black/40` overlay.

### Spacing habits
- Gaps: `gap-2`, `gap-3`, `gap-4`
- Padding: `px-3`, `px-4`, `px-5`, `px-6`, `py-2`, `py-2.5`, `py-3`, `p-4`, `p-5`, `p-6`
- Vertical rhythm: `mt-2` (eyebrow → title), `mt-3` (title → body), `mt-4` / `mt-5` (block gaps), `mt-6` (actions)
- Max widths: `max-w-3xl`, `max-w-2xl`, `max-w-xl`, `max-w-md`

### Z-index scale
| Layer | z-index |
|---|---|
| Header / navbar | 40 |
| Drawer | 50 |
| Search popover | 70 |
| Progress bar | 70 |
| Modals | 80–140 |

---

## 11. Motion

| Element | Motion |
|---|---|
| Buttons | 180ms ease; lift 1px on hover |
| Cards | `transition-transform duration-200 hover:-translate-y-1` |
| Chevrons | `transition-transform`, `rotate-180` when open |
| Sidebar | framer-motion width `280px ↔ 84px` |
| Mobile drawer | `x: -320 → 0` over 0.24s with `easeOut`; overlay fades in |
| Route progress bar | 2px `blue-500` bar at the top that steps 18% → 72% (80ms) → 100% (260ms), then hides at 520ms |
| Expanding panels | `400ms cubic-bezier(0.4, 0, 0.2, 1)` |
| Loading | `animate-spin`; `animate-pulse` for skeletons |

---

## 12. Starter CSS (copy into the new project)

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
@import "tailwindcss";
@import "tw-animate-css";
@import "@fontsource-variable/geist";

@custom-variant dark (&:is(.dark *));

@theme {
  --font-sans: "Geist Variable", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Instrument Serif", ui-serif, Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  --color-blueprint-bg: #fbf9f9;
  --color-blueprint-line: #c7c0c0;
  --color-blueprint-accent: #000000;
  --color-blueprint-muted: #4d4d4d;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
}

:root {
  --radius: 0.625rem;
  --background: #fbf9f9;
  --foreground: #1a1a1a;
  --card: #ffffff;
  --primary: #1a1a1a;
  --primary-foreground: #ffffff;
  --muted: oklch(0.95 0.004 20);
  --muted-foreground: #4d4d4d;
  --border: oklch(0.78 0.004 20);
  --ring: oklch(0.55 0 0);
  --surface-hover: #f5f3f3;
  --surface-inset: #f3f0f0;
}

.dark {
  --background: #050505;
  --foreground: #f4f4f4;
  --card: oklch(0.205 0 0);
  --primary: #f3ecec;
  --primary-foreground: #111111;
  --muted: oklch(0.269 0 0);
  --muted-foreground: #b7b7b7;
  --border: oklch(1 0 0 / 10%);
  --ring: oklch(0.556 0 0);
  --surface-hover: #181818;
  --surface-inset: #202020;
  --color-blueprint-line: #3a3a3a;
  --color-blueprint-muted: #b7b7b7;
  --color-blueprint-bg: #151515;
}

@layer base {
  *, *::before, *::after { box-sizing: border-box; border-color: var(--color-blueprint-line); }
  html { font-family: var(--font-sans); }
  html, body, #root { overflow-x: hidden; max-width: 100vw; }
  body { background: var(--background); color: var(--foreground); -webkit-font-smoothing: antialiased; }
  input, textarea, select, button { font-size: 16px; }
  img, svg, video, canvas { max-width: 100%; height: auto; }

  button:not(:disabled) {
    transition-property: color, background-color, border-color, box-shadow, transform, opacity;
    transition-duration: 180ms;
    transition-timing-function: ease;
  }
  button:not(:disabled):hover  { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(0,0,0,.10); }
  button:not(:disabled):active { transform: translateY(0);    box-shadow: 0 5px 14px rgba(0,0,0,.10); }
  .dark button:not(:disabled):hover { box-shadow: 0 10px 24px rgba(0,0,0,.35); }

  :is(button, a, input, textarea, select, [tabindex]):focus-visible {
    outline: 2px solid color-mix(in oklab, var(--ring) 70%, transparent);
    outline-offset: 2px;
  }

  @media (max-width: 480px) {
    button, input[type='button'], input[type='submit'], input[type='reset'] { min-height: 44px; }
    form button, form input[type='submit'] { width: 100%; }
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--color-blueprint-line); border-radius: 9999px; }

  .landing-blueprint-grid {
    background-image:
      linear-gradient(to right, rgba(17,24,39,.07) 1.25px, transparent 1.25px),
      linear-gradient(to bottom, rgba(17,24,39,.07) 1.25px, transparent 1.25px);
    background-size: 40px 40px;
    background-position: center top;
  }
  .dark .landing-blueprint-grid {
    background-image:
      linear-gradient(to right, rgba(255,255,255,.05) 1.25px, transparent 1.25px),
      linear-gradient(to bottom, rgba(255,255,255,.05) 1.25px, transparent 1.25px);
  }
  .blueprint-grid {
    background-image:
      linear-gradient(to right, rgba(26,26,26,.12) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(26,26,26,.12) 1px, transparent 1px);
    background-size: 48px 48px;
    background-position: center top;
  }
  .dark .blueprint-grid {
    background-image:
      linear-gradient(to right, rgba(255,255,255,.095) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,.095) 1px, transparent 1px);
  }
}

@layer utilities {
  .text-display-xl   { font-family: var(--font-serif); font-size: clamp(2rem,6.8vw,56px);    line-height: 1.08; }
  .text-headline-lg  { font-family: var(--font-serif); font-size: clamp(1.75rem,5.6vw,40px); line-height: 1.18; }
  .text-headline-md  { font-family: var(--font-serif); font-size: clamp(1.35rem,4.8vw,28px); line-height: 1.28; font-style: italic; }
  /* Optional: Repoid uses this class but never defines it (renders as 16px Geist). */
  .text-headline-sm  { font-family: var(--font-serif); font-size: 22px; line-height: 1.3; }
  .text-body-md      { font-family: var(--font-sans); font-size: 15px; line-height: 1.6; }
  .text-body-lg      { font-family: var(--font-sans); font-size: 18px; line-height: 1.6; }
  .text-technical-mono { font-family: var(--font-mono); font-size: 12px; line-height: 1.4; letter-spacing: .02em; text-transform: uppercase; }
  .text-ui-label     { font-family: var(--font-sans); font-size: 14px; line-height: 1.15; font-weight: 500; text-transform: uppercase; }

  .surface-card {
    border: 1.25px solid var(--color-blueprint-line);
    border-radius: .75rem;
    background: var(--card);
    padding: 1.5rem;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.035), 0 14px 34px rgba(0,0,0,.08);
  }
  .surface-card-compact {
    border: 1.25px solid var(--color-blueprint-line);
    border-radius: .75rem;
    background: var(--card);
    padding: 1rem 1.25rem;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.035), 0 10px 26px rgba(0,0,0,.07);
  }
  .surface-inset {
    border: 1.25px solid var(--color-blueprint-line);
    border-radius: .75rem;
    background: var(--surface-inset);
    padding: 1rem;
  }
  @media (min-width: 640px) {
    .surface-card { padding: 1.75rem; }
    .surface-card-compact { padding: 1.125rem 1.25rem; }
    .surface-inset { padding: 1.125rem; }
  }
}

header { background: var(--background); box-shadow: inset 0 -1px 0 rgba(0,0,0,.12); }
.dark header { box-shadow: inset 0 -1px 0 rgba(255,255,255,.08); }

.landing-navbar { background: var(--card); box-shadow: 0 18px 42px rgba(0,0,0,.08); }
.dark .landing-navbar { box-shadow: 0 18px 42px rgba(0,0,0,.35); }

.landing-primary-action { background: #111111; color: #ffffff; }
.landing-primary-action:hover { background: #303031; }
.dark .landing-primary-action { background: #f3ecec; color: #111111; }
.dark .landing-primary-action:hover { background: #e9dddd; }

.landing-cta-panel {
  border: 1px solid #f3ecec;
  background: #050505;
  color: #ffffff;
  outline: 1px solid rgba(243,236,236,.86);
  outline-offset: 3px;
}
.landing-cta-button { border-color: #ffffff; background: #ffffff; color: #111111; }
.landing-cta-button:hover { background: #f5f3f3; }

.check-icon { color: #16a34a; }
.dark .check-icon { color: #4ade80; }
.language-tag { background: #123d8a; color: #ffffff; border-color: rgba(147,197,253,.35); }
```

> Unlike Repoid, this starter defines dark-mode colors as CSS variables instead of `!important` overrides on hard-coded classes such as `bg-white` and `bg-[#f5f3f3]`. In the new project, use `bg-card`, `bg-background` and `hover:bg-[var(--surface-hover)]` so both themes work without overrides.

### Theme bootstrap script (put it in `<head>`)

```html
<script>
  (() => {
    const key = 'theme_preference';
    let saved = null;
    try { saved = localStorage.getItem(key); } catch {}
    const theme = ['dark', 'light', 'system'].includes(saved) ? saved : 'light';
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const dark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  })();
</script>
```

---

## 13. Reference snippets

**Metric card**
```html
<article class="surface-card-compact">
  <p class="text-technical-mono text-blueprint-muted">interview questions</p>
  <p class="mt-3 font-serif text-[clamp(1.8rem,3.5vw,2.4rem)] leading-none text-primary">640+</p>
  <p class="mt-2 text-body-md text-blueprint-muted">spread across role-specific banks</p>
</article>
```

**Feature card with icon tile**
```html
<article class="surface-card transition-transform duration-200 hover:-translate-y-1">
  <span class="flex h-12 w-12 items-center justify-center rounded-2xl border border-blueprint-line bg-card text-primary">
    <Code2 size={20} />
  </span>
  <h3 class="mt-5 text-headline-sm text-primary">Frontend</h3>
  <p class="mt-3 text-body-md text-blueprint-muted">React, state management, browser behavior…</p>
</article>
```

**Checklist**
```html
<ul class="mt-5 grid gap-3">
  <li class="flex gap-3 text-body-md text-primary">
    <Check size={16} class="check-icon mt-1 shrink-0" /><span>Filter by the active domain.</span>
  </li>
</ul>
```

**Modal**
```html
<div class="fixed inset-0 z-80 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
  <div class="w-full max-w-md rounded-[28px] border border-blueprint-line bg-card p-6 shadow-[0_28px_80px_rgba(0,0,0,0.18)] sm:p-7">
    <p class="text-ui-label text-blueprint-muted">Eyebrow</p>
    <h2 class="mt-2 text-headline-md not-italic text-primary">Title</h2>
    <p class="mt-3 text-body-md text-blueprint-muted">Body</p>
    <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
      <button class="rounded-full border border-blueprint-line px-5 py-2.5 text-ui-label text-primary">Cancel</button>
      <button class="rounded-full bg-primary px-5 py-2.5 text-ui-label text-primary-foreground">Confirm</button>
    </div>
  </div>
</div>
```

**Files to copy from Repoid:** `src/components/ui/background-ripple-effect.tsx`, `src/components/Logo.tsx`, `src/lib/theme.ts`, `src/hooks/useThemePreference.ts`, `public/assets/*.svg` (swap in your own logo).
