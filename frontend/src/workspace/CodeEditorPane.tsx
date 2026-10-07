import { useCallback, useEffect, useMemo, useRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
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
  // C reads well with the C++ grammar: it is close to a subset of it.
  if (language === "cpp" || language === "c") return cpp();
  if (language === "java") return java();
  if (language === "javascript") return javascript();
  if (language === "typescript") return javascript({ typescript: true });
  return python();
};

interface CodeEditorPaneProps {
  value: string;
  language: Language;
  /** 1-based source line driven by playback, or null when idle. */
  activeLine: number | null;
  onChange: (value: string) => void;
  onLineClick: (line: number) => void;
  /** Where the cursor is, for the status bar: 1-based line and column. */
  onCursor?: (line: number, column: number) => void;
  readOnly?: boolean;
}

export default function CodeEditorPane({
  value,
  language,
  activeLine,
  onChange,
  onLineClick,
  onCursor,
  readOnly = false
}: CodeEditorPaneProps) {
  const cursorRef = useRef(onCursor);
  cursorRef.current = onCursor;
  const cursorListener = useMemo(
    () =>
      EditorView.updateListener.of((update) => {
        if (!update.selectionSet && !update.docChanged) return;
        const head = update.state.selection.main.head;
        const line = update.state.doc.lineAt(head);
        cursorRef.current?.(line.number, head - line.from + 1);
      }),
    []
  );
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
      cursorListener,
      EditorView.lineWrapping
    ],
    [language, clickHandler, cursorListener]
  );

  // Push the active line into editor state and ease it into view.
  useEffect(() => {
    const view = editor.current?.view;
    if (!view) return;

    const effects: StateEffect<unknown>[] = [setPlaybackLine.of(activeLine)];
    view.dispatch({ effects });

    // Scroll the editor's own box, never the page. CodeMirror's scrollIntoView
    // moves every scrollable ancestor too, so on a phone, where the page
    // itself scrolls, each replayed step dragged the reader back down to the
    // code from wherever they were looking. Now the editor follows the line
    // inside itself, and only when that line has left its box; where the
    // editor grows to fit its code there is nothing to scroll and nothing moves.
    if (activeLine && activeLine !== lastLine.current && activeLine <= view.state.doc.lines) {
      const scroller = view.scrollDOM;
      const block = view.lineBlockAt(view.state.doc.line(activeLine).from);
      const offset = view.documentTop - scroller.getBoundingClientRect().top + scroller.scrollTop;
      const top = block.top + offset;
      const bottom = block.bottom + offset;
      const margin = block.height * 2;
      if (top < scroller.scrollTop + margin || bottom > scroller.scrollTop + scroller.clientHeight - margin) {
        // scroll-behavior: smooth on the scroller eases this.
        scroller.scrollTop = Math.max(0, top - scroller.clientHeight / 2 + block.height / 2);
      }
    }
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
