import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * The three-part heading every section uses (DESIGN.md §2): uppercase eyebrow,
 * serif title, muted lead. `as` lets page intros render a real h1.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  as: Tag = "h2",
  className,
  children
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("mb-10 max-w-3xl", className)}>
      <p className="text-ui-label text-blueprint-muted">{eyebrow}</p>
      <Tag className={cn("mt-2 text-balance text-primary", Tag === "h1" ? "text-display-xl" : "text-headline-lg")}>
        {title}
      </Tag>
      {lead && <p className="mt-4 text-pretty text-body-lg text-blueprint-muted">{lead}</p>}
      {children}
    </div>
  );
}
