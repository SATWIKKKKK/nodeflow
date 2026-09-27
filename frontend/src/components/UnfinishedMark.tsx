import { cn } from "../lib/cn";

/**
 * The mark for a problem started and left unsolved, wherever problems are
 * listed: an amber dot with a ring that keeps rippling out of it, and a small
 * "Unfinished" tag. Amber because it is neither done (blue) nor failed (red),
 * and moving because it is asking to be picked back up. The ripple stops for
 * anyone who has asked for reduced motion (index.css).
 */
export function UnfinishedMark({ label = true, className }: { label?: boolean; className?: string }) {
  return (
    <span className={cn("unfinished-mark inline-flex shrink-0 items-center gap-1.5", className)}>
      <span className="unfinished-dot" aria-hidden />
      {label ? <span className="unfinished-tag">Unfinished</span> : <span className="sr-only">Unfinished</span>}
    </span>
  );
}
