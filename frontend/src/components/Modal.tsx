import { useEffect, useId, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { button } from "./ui";

/** Centred modal (DESIGN.md §5): 28px radius, blurred backdrop, Esc to close. */
export function Modal({
  open,
  onClose,
  eyebrow,
  title,
  children,
  actions,
  size = "md"
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  size?: "md" | "lg";
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              "relative w-full rounded-[28px] border border-blueprint-line bg-card p-6 shadow-[0_28px_80px_rgba(0,0,0,0.18)] sm:p-7",
              size === "md" ? "max-w-md" : "max-w-lg"
            )}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={cn(button.close, "absolute right-5 top-5")}
              style={{ minHeight: 0, width: "auto" }}
            >
              <X size={16} aria-hidden />
            </button>
            {eyebrow && <p className="pr-10 text-ui-label text-blueprint-muted">{eyebrow}</p>}
            <h2 id={titleId} className="mt-2 pr-10 text-headline-md not-italic text-primary">
              {title}
            </h2>
            {children && <div className="mt-3 text-body-md text-blueprint-muted">{children}</div>}
            {actions && <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">{actions}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
