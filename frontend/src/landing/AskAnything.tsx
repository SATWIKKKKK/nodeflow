import { useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, Loader2, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useServerStatus } from "../lib/serverStatus";
import { cn } from "../lib/cn";
import { button } from "../components/ui";

/**
 * One free-form question, answered by the assistant behind /api/ask.
 *
 * One at a time by design: while an answer is on screen the form is gone, and
 * the only way to ask again is to clear this one. There is no limit on how
 * often that can be done — clearing and asking again is the whole loop.
 */

const MAX_QUESTION = 400;

const readError = (error: unknown) => {
  if (!(error instanceof Error)) return "Something went wrong. Try again.";
  try {
    const parsed = JSON.parse(error.message) as { message?: string };
    return parsed.message ?? error.message;
  } catch {
    return error.message || "Something went wrong. Try again.";
  }
};

export function AskAnything() {
  const server = useServerStatus();
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<{ question: string; answer: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 3 || busy || asked) return;

    setError("");
    setBusy(true);
    try {
      const { answer } = await api.ask(trimmed);
      setAsked({ question: trimmed, answer });
      setQuestion("");
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setAsked(null);
    setError("");
    // Put the cursor back where the next question goes.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className="rounded-xl border border-blueprint-line bg-card p-5 shadow-[0_10px_26px_rgba(0,0,0,0.06)] sm:p-6">
      <p className="text-technical-mono text-blueprint-muted">Ask me anything</p>

      <AnimatePresence mode="wait" initial={false}>
        {asked ? (
          <motion.div
            key="answer"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          >
            <p className="mt-3 text-body-lg font-semibold text-primary">{asked.question}</p>
            <p className="mt-3 whitespace-pre-line text-body-md text-blueprint-muted">{asked.answer}</p>
            <button
              type="button"
              onClick={clear}
              className={cn(button.outlineSm, "mt-5")}
            >
              <Trash2 size={14} aria-hidden /> Ask another
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={submit}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          >
            <label htmlFor="ask-question" className="mt-3 block text-body-md text-blueprint-muted">
              Not covered above? Put it in your own words.
            </label>
            <textarea
              id="ask-question"
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value.slice(0, MAX_QUESTION))}
              onKeyDown={(event) => {
                // Enter sends; Shift+Enter is a newline.
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={3}
              placeholder="Does the tracer work for recursion?"
              disabled={busy}
              className="mt-3 w-full resize-none rounded-lg border border-blueprint-line bg-surface-inset px-4 py-3 text-body-md text-primary outline-none transition-colors placeholder:text-blueprint-muted/70 focus:border-primary disabled:opacity-60"
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-blueprint-muted">
                {question.length}/{MAX_QUESTION}
                {!server.ask && " · unavailable on this deployment"}
              </span>
              <button
                type="submit"
                disabled={busy || question.trim().length < 3 || !server.ask}
                className={cn(button.primary, "min-w-36")}
              >
                {busy ? <Loader2 size={14} aria-hidden className="animate-spin" /> : null}
                {busy ? "Thinking" : "Ask"}
                {!busy && <ArrowRight size={14} aria-hidden />}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {error && (
        <p role="alert" className="status-error mt-4 flex gap-2 rounded-xl border px-4 py-3 text-sm">
          <AlertCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
