import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * The heading every section uses: a serif title and an optional muted lead.
 * No label above the title; the title names the section on its own. `as`
 * lets page intros render a real h1.
 */
export function SectionHeading({
  title,
  lead,
  as: Tag = "h2",
  className,
  children
}: {
  title: ReactNode;
  lead?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("mb-10 max-w-3xl", className)}>
      <Tag className={cn("text-balance text-primary", Tag === "h1" ? "text-display-xl" : "text-headline-lg")}>
        {title}
      </Tag>
      {lead && <p className="mt-4 text-pretty text-body-lg text-blueprint-muted">{lead}</p>}
      {children}
    </div>
  );
}
