import { NavLink } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check, Mail, Phone } from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { button, container } from "../components/ui";
import type { InfoPageContent } from "./infoPages";

export default function InfoPage({ page }: { page: InfoPageContent }) {
  return (
    <div className={`${container} py-16 sm:py-20`}>
      <div className="grid gap-10 lg:grid-cols-[0.7fr_1fr]">
        <div>
          <SectionHeading as="h1" eyebrow={page.eyebrow} title={page.title} lead={page.lead} />
          {page.draft && (
            <p className="neu-tag inline-flex rounded-full border border-blueprint-line bg-card px-3 py-1.5 text-technical-mono text-blueprint-muted">
              Draft · full text still being written
            </p>
          )}
        </div>

        <div className="grid content-start gap-5">
          {page.sections.map((section) => (
            <article key={section.title} className="surface-card">
              <h2 className="text-headline-sm text-primary">{section.title}</h2>
              {section.body && <p className="mt-3 text-body-md text-blueprint-muted">{section.body}</p>}
              {section.links && (
                <ul className="mt-5 grid gap-3">
                  {section.links.map((link) => {
                    const Icon = link.kind === "email" ? Mail : Phone;
                    return (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          className="neu-btn group flex items-center gap-4 rounded-2xl border border-blueprint-line bg-card px-4 py-3.5 text-primary"
                        >
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
                      </li>
                    );
                  })}
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
            <NavLink to="/how-it-works" className={button.outlineSm}>
              How it works
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
}
