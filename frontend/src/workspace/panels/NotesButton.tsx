import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NotebookPen, X } from "lucide-react";
import { button } from "../../components/ui";
import { cn } from "../../lib/cn";
import { NotesPanel } from "./NotesPanel";

/**
 * Notes, one press away in the header beside Submit: a small sheet that
 * drops down over the page, so jotting an idea never costs the editor any
 * room. Escape or a click outside puts it away; what was typed is saved.
 */
export function NotesButton({
  problemId,
  token,
  signedIn,
  className
}: {
  problemId: string;
  token: string | null;
  signedIn: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key, true);
    };
  }, [open]);

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={!problemId}
        title="Your notes on this problem"
        className={cn(button.outlineSm, "workspace-action shadow-none", open && "text-[var(--fill-blue)]")}
        style={{ minHeight: 0 }}
      >
        <NotebookPen size={14} aria-hidden />
        <span className="hidden sm:inline">Notes</span>
      </button>
      <AnimatePresence>
        {open && problemId && (
          <motion.div
            role="dialog"
            aria-label="Notes"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 460, damping: 34, mass: 0.7 }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full z-[70] pt-2"
          >
            <div className="neu-panel flex h-[340px] w-[min(400px,calc(100vw-24px))] flex-col rounded-2xl border border-blueprint-line bg-card p-3 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
              <div className="mb-2 flex items-center gap-2">
                <NotebookPen size={14} aria-hidden className="text-[var(--fill-blue)]" />
                <p className="text-[13px] font-semibold text-primary">Notes</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close notes"
                  className="no-lift ml-auto flex h-7 w-7 items-center justify-center rounded-md text-blueprint-muted hover:bg-surface-hover hover:text-primary"
                  style={{ minHeight: 0 }}
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <NotesPanel problemId={problemId} token={token} signedIn={signedIn} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
