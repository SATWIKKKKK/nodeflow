import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

/**
 * Editor theme, coloured from the site's own accents (index.css, graphics
 * tokens) rather than a stock scheme.
 *
 * Colour is kept for the words that carry structure, so most of a line stays
 * ink and the eye still goes to names: keywords in the brand blue, types and
 * classes in teal, strings in amber, numbers and constants in violet, comments
 * muted and italic. Function names are ink at a heavier weight. Every colour
 * clears 4.5:1 against its editor surface.
 */

interface Palette {
  surface: string;
  ink: string;
  keyword: string;
  type: string;
  string: string;
  number: string;
  muted: string;
  punctuation: string;
  selection: string;
  match: string;
  invalid: string;
}

// Surfaces match the soft-UI screen paper (--card in .neu-world, index.css).
const light: Palette = {
  surface: "#f4f1f0",
  ink: "#1a1a1a",
  keyword: "#2d58bc",
  type: "#0f766e",
  string: "#a3470a",
  number: "#6d33d6",
  muted: "#857d7d",
  punctuation: "#6b6464",
  selection: "#e4dedd",
  match: "#ebe6e5",
  invalid: "#b91c1c"
};

const dark: Palette = {
  surface: "#121111",
  ink: "#f4f4f4",
  keyword: "#9ecbff",
  type: "#5eead4",
  string: "#f0b429",
  number: "#c4b5fd",
  muted: "#7a7474",
  punctuation: "#9a9a9a",
  selection: "#2a2727",
  match: "#1d1b1b",
  invalid: "#fca5a5"
};

const build = (colors: Palette, isDark: boolean): Extension => {
  const highlight = HighlightStyle.define([
    {
      tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword, tags.definitionKeyword, tags.operatorKeyword, tags.modifier, tags.self],
      color: colors.keyword,
      fontWeight: "500"
    },
    {
      tag: [tags.typeName, tags.className, tags.standard(tags.typeName), tags.definition(tags.typeName), tags.definition(tags.className), tags.namespace],
      color: colors.type
    },
    {
      tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.function(tags.definition(tags.variableName))],
      color: colors.ink,
      fontWeight: "600"
    },
    { tag: [tags.definition(tags.variableName)], color: colors.ink },
    { tag: [tags.string, tags.special(tags.string), tags.character, tags.regexp], color: colors.string },
    { tag: [tags.number, tags.integer, tags.float, tags.bool, tags.null, tags.atom, tags.constant(tags.variableName)], color: colors.number },
    { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: colors.muted, fontStyle: "italic" },
    { tag: [tags.meta, tags.processingInstruction, tags.annotation], color: colors.keyword },
    { tag: [tags.variableName, tags.propertyName, tags.attributeName], color: colors.ink },
    { tag: [tags.operator, tags.punctuation, tags.bracket, tags.separator], color: colors.punctuation },
    { tag: [tags.invalid], color: colors.invalid }
  ]);

  const theme = EditorView.theme(
    {
      "&": {
        backgroundColor: colors.surface,
        color: colors.ink,
        border: "none",
        outline: "none",
        height: "100%"
      },
      "&.cm-focused": { outline: "none" },
      ".cm-scroller": {
        // The same self-hosted JetBrains Mono as every other code surface (index.css).
        fontFamily: "var(--font-mono)",
        // Show exactly what was typed: no `!=` drawn as ≠, no `->` as an arrow.
        fontVariantLigatures: "none",
        fontSize: "13.5px",
        lineHeight: "1.7",
        // Smooth, rather than instant, when playback scrolls a line into view.
        scrollBehavior: "smooth"
      },
      ".cm-content": { padding: "14px 0 30vh 0", caretColor: colors.ink },
      ".cm-cursor, .cm-dropCursor": { borderLeftWidth: "1.5px", borderLeftColor: colors.ink },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: colors.selection
      },
      ".cm-selectionMatch": { backgroundColor: colors.match },
      ".cm-gutters": {
        backgroundColor: colors.surface,
        border: "none",
        color: colors.muted,
        paddingRight: "12px"
      },
      ".cm-lineNumbers .cm-gutterElement": {
        minWidth: "2.6ch",
        padding: "0 4px 0 16px",
        textAlign: "right",
        color: colors.muted
      },
      ".cm-activeLineGutter": { backgroundColor: "transparent" },
      ".cm-activeLine": { backgroundColor: "transparent" },
      ".cm-foldPlaceholder": { backgroundColor: colors.match, border: "none", color: colors.muted },
      ".cm-tooltip": {
        backgroundColor: colors.surface,
        border: `1px solid ${isDark ? "#3a3a3a" : "#c7c0c0"}`,
        borderRadius: "10px"
      }
    },
    { dark: isDark }
  );

  return [theme, syntaxHighlighting(highlight)];
};

export const editorThemes = {
  light: build(light, false),
  dark: build(dark, true)
};
