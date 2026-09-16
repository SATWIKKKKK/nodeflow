import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

/**
 * Editor theme in the blueprint palette (DESIGN.md §3).
 *
 * Monochrome on purpose: ink for code, one muted tone for literals, a lighter
 * one for comments. Rainbow highlighting would fight the scene for attention.
 */

interface Palette {
  surface: string;
  ink: string;
  literal: string;
  muted: string;
  punctuation: string;
  selection: string;
  match: string;
  invalid: string;
}

const light: Palette = {
  surface: "#ffffff",
  ink: "#1a1a1a",
  literal: "#4d4d4d",
  muted: "#9a9292",
  punctuation: "#6b6464",
  selection: "#ece8e8",
  match: "#f3f0f0",
  invalid: "#b91c1c"
};

const dark: Palette = {
  surface: "#171717",
  ink: "#f4f4f4",
  literal: "#b7b7b7",
  muted: "#6f6f6f",
  punctuation: "#9a9a9a",
  selection: "#2c2c2c",
  match: "#202020",
  invalid: "#fca5a5"
};

const build = (colors: Palette, isDark: boolean): Extension => {
  const highlight = HighlightStyle.define([
    { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword], color: colors.ink, fontWeight: "600" },
    { tag: [tags.definitionKeyword, tags.operatorKeyword], color: colors.ink, fontWeight: "600" },
    { tag: [tags.function(tags.variableName), tags.definition(tags.variableName)], color: colors.ink },
    {
      tag: [tags.string, tags.special(tags.string), tags.number, tags.bool, tags.null],
      color: colors.literal
    },
    { tag: [tags.comment, tags.lineComment, tags.blockComment], color: colors.muted, fontStyle: "italic" },
    { tag: [tags.variableName, tags.propertyName, tags.typeName, tags.className], color: colors.ink },
    { tag: [tags.operator, tags.punctuation, tags.bracket], color: colors.punctuation },
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
        fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
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
