import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check, Copy, Mail, Phone } from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { button, container } from "../components/ui";
import { cn } from "../lib/cn";
import type { InfoLink, InfoPageContent } from "./infoPages";

/**
 * A way to reach us. An email address also offers Gmail and a copy button:
 * a mailto link does nothing on a computer with no mail app set up, which on
 * Windows is common, so it cannot be the only way to write.
 */
function ContactLink({ link }: { link: InfoLink }) {
  const [copied, setCopied] = useState(false);
  const Icon = link.kind === "email" ? Mail : Phone;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.value);
    } catch {
      const field = document.createElement("textarea");
      field.value = link.value;
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <li className="neu-panel rounded-2xl border border-blueprint-line bg-card p-2">
      <a href={link.href} className="group flex items-center gap-4 rounded-xl px-2 py-1.5 text-primary">
        <span className="neu-well flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blueprint-line bg-card">
          <Icon size={17} aria-hidden className="text-[var(--fill-blue)]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-technical-mono text-blueprint-muted">{link.label}</span>
          <span className="block truncate text-body-md font-medium">{link.value}</span>
        </span>
        <ArrowUpRight
          size={16}
          aria-hidden
          className="shrink-0 text-blueprint-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />
      </a>
      <div className="mt-2 flex flex-wrap gap-2 px-2 pb-1">
        {link.kind === "email" && (
          <a
            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(link.value)}`}
            target="_blank"
            rel="noreferrer"
            className={cn(button.outlineSm, "px-3 py-1.5 text-[12px]")}
          >
            Open in Gmail
          </a>
        )}
        <button
          type="button"
          onClick={() => void copy()}
          className={cn(button.outlineSm, "px-3 py-1.5 text-[12px]")}
          style={{ minHeight: 0 }}
        >
          {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          {copied ? "Copied" : link.kind === "email" ? "Copy address" : "Copy number"}
        </button>
      </div>
    </li>
  );
}

export default function InfoPage({ page }: { page: InfoPageContent }) {
  return (
    <div className={`${container} py-16 sm:py-20`}>
      <div className={cn("grid gap-10", page.layout === "columns" ? "" : "lg:grid-cols-[0.7fr_1fr]")}>
        <div>
          <SectionHeading as="h1" title={page.title} lead={page.lead} />
          {page.draft && (
            <p className="neu-tag inline-flex rounded-full border border-blueprint-line bg-card px-3 py-1.5 text-technical-mono text-blueprint-muted">
              Draft · full text still being written
            </p>
          )}
        </div>

        <div
          className={cn(
            "grid content-start gap-5",
            page.layout === "columns" && "md:grid-cols-2 lg:grid-cols-3 [&>article]:h-full"
          )}
        >
          {page.sections.map((section) => (
            <article key={section.title} className="surface-card">
              <h2 className="text-headline-sm text-primary">{section.title}</h2>
              {section.body && <p className="mt-3 text-body-md text-blueprint-muted">{section.body}</p>}
              {section.links && (
                <ul className="mt-5 grid gap-3">
                  {section.links.map((link) => (
                    <ContactLink key={link.href} link={link} />
                  ))}
                </ul>
              )}
              {section.points && (
                <ul className="mt-5 grid gap-3">
                  {section.points.map((point) => (
                    <li key={point} className="flex gap-3 text-body-md text-primary">
                      <Check size={16} aria-hidden className="check-icon mt-1 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}

          <div className="mt-2 flex flex-wrap gap-3">
            <NavLink to="/problems" className={button.primary}>
              Open a problem <ArrowRight size={14} aria-hidden />
            </NavLink>
            <NavLink to="/docs" className={button.outlineSm}>
              Read the docs
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
}
