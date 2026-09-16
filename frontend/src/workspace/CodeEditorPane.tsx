import { useCallback, useEffect, useMemo, useRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutterLineClass,
  lineNumbers,
  type DecorationSet
} from "@codemirror/view";
import { RangeSet, StateEffect, StateField } from "@codemirror/state";
import type { Language } from "@nodeflow/shared";
import { useThemePreference } from "../lib/theme";
import { editorThemes } from "./editorTheme";

/**
 * The line currently being visualised. Held in editor state (not React state)
 * so decorating it never forces a document re-render.
 */
const setPlaybackLine = StateEffect.define<number | null>();

const playbackLine = StateField.define<number | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setPlaybackLine)) return effect.value;
    }
    return value;
  }
});

const lineHighlight = Decoration.line({ class: "cm-playback-line" });

const playbackDecorations = EditorView.decorations.compute([playbackLine, "doc"], (state) => {
  const line = state.field(playbackLine);
  if (!line || line < 1 || line > state.doc.lines) return Decoration.none;
  return Decoration.set([lineHighlight.range(state.doc.line(line).from)]) as DecorationSet;
});

class PlaybackGutterMarker extends GutterMarker {
  elementClass = "cm-playback-gutter";
}

const playbackGutter = gutterLineClass.compute([playbackLine, "doc"], (state) => {
  const line = state.field(playbackLine);
  if (!line || line < 1 || line > state.doc.lines) return RangeSet.empty;
  return RangeSet.of([new PlaybackGutterMarker().range(state.doc.line(line).from)]);
});

const languageExtension = (language: Language) => {
  if (language === "cpp") return cpp();
  if (language === "java") return java();
  return python();
};

interface CodeEditorPaneProps {
  value: string;
  language: Language;
  /** 1-based source line driven by playback, or null when idle. */
  activeLine: number | null;
  onChange: (value: string) => void;
  onLineClick: (line: number) => void;
  readOnly?: boolean;
}

export default function CodeEditorPane({
  value,
  language,
  activeLine,
  onChange,
  onLineClick,
  readOnly = false
}: CodeEditorPaneProps) {
  const editor = useRef<ReactCodeMirrorRef>(null);
  const { resolved } = useThemePreference();
  const lastLine = useRef<number | null>(null);

  const clickHandler = useMemo(
    () =>
      EditorView.domEventHandlers({
        click(event, view) {
          const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (position === null) return false;
          onLineClick(view.state.doc.lineAt(position).number);
          return false;
        }
      }),
    [onLineClick]
  );

  const extensions = useMemo(
    () => [
      lineNumbers(),
      languageExtension(language),
      playbackLine,
      playbackDecorations,
      playbackGutter,
      clickHandler,
      EditorView.lineWrapping
    ],
    [language, clickHandler]
  );

  // Push the active line into editor state and ease it into view.
  useEffect(() => {
    const view = editor.current?.view;
    if (!view) return;

    const effects: StateEffect<unknown>[] = [setPlaybackLine.of(activeLine)];

    if (activeLine && activeLine !== lastLine.current && activeLine <= view.state.doc.lines) {
      // scroll-behavior: smooth on the scroller turns this into an eased scroll
      // rather than a jump. Centring keeps context on both sides of the line.
      effects.push(
        EditorView.scrollIntoView(view.state.doc.line(activeLine).from, { y: "center" })
      );
    }

    view.dispatch({ effects });
    lastLine.current = activeLine;
  }, [activeLine]);

  const handleChange = useCallback((next: string) => onChange(next), [onChange]);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <CodeMirror
        ref={editor}
        value={value}
        height="100%"
        // Passed as `theme`, not as an extension: the default light theme is
        // applied after extensions and would otherwise win on background colour.
        theme={editorThemes[resolved]}
        extensions={extensions}
        onChange={handleChange}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          searchKeymap: false
        }}
      />
    </div>
  );
}
