import { NavLink } from "react-router-dom";
import { ArrowRight, Check, Clock3 } from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { button, container } from "../components/ui";
import { cn } from "../lib/cn";

const plans = [
  {
    name: "Free",
    price: "$0",
    cadence: "no card needed",
    body: "The whole workspace, for anyone learning.",
    available: true,
    points: [
      "Python tracing and step-by-step playback",
      "Run, Test, Submit and live preview",
      "Every live problem in the bank",
      "Progress dashboard with a free account"
    ]
  },
  {
    name: "Classroom",
    price: "Not set",
    cadence: "planned",
    body: "For instructors running a course on data structures.",
    available: false,
    points: ["Shared progress across a class", "Accounts for every student", "Managed sandbox capacity"]
  },
  {
    name: "Team Lab",
    price: "Not set",
    cadence: "planned",
    body: "For groups that want their own problems.",
    available: false,
    points: ["Private problem banks", "Review workflows for new problems", "Everything in Classroom"]
  }
];

export default function PricingPage() {
  return (
    <section className="py-16 sm:py-20">
      <div className={container}>
        <SectionHeading
          as="h1"
          eyebrow="Pricing"
          title={
            <>
              Free while the core gets <em className="italic">proven</em>.
            </>
          }
          lead="Everything Noesis does today is free. Plans for classrooms and teams are on the roadmap, and their prices have not been decided."
        />

        <div className="grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={cn(
                "surface-card relative flex flex-col",
                plan.available ? "min-h-[430px] border-primary! shadow-[0_20px_48px_rgba(0,0,0,0.14)]!" : ""
              )}
            >
              <span
                className={cn(
                  "absolute right-5 top-5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
                  plan.available ? "badge-current" : "border-blueprint-line text-blueprint-muted"
                )}
              >
                {plan.available ? "Available now" : "Planned"}
              </span>

              <p className="text-ui-label text-blueprint-muted">{plan.name}</p>
              <p className="mt-4 font-serif text-[clamp(2.4rem,4vw,3.25rem)] leading-none text-primary">
                {plan.price}
              </p>
              <p className="mt-2 text-technical-mono text-blueprint-muted">{plan.cadence}</p>
              <p className="mt-5 text-body-md text-primary">{plan.body}</p>

              <div className="my-6 h-px bg-blueprint-line" />

              <ul className="grid gap-3">
                {plan.points.map((point) => (
                  <li
                    key={point}
                    className={cn("flex gap-3 text-body-md", plan.available ? "text-primary" : "text-blueprint-muted")}
                  >
                    {plan.available ? (
                      <Check size={16} aria-hidden className="check-icon mt-1 shrink-0" />
                    ) : (
                      <Clock3 size={16} aria-hidden className="mt-1 shrink-0" />
                    )}
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-6">
                {plan.available ? (
                  <NavLink to="/problems" className={cn(button.primary, "w-full py-3")}>
                    Open a problem <ArrowRight size={14} aria-hidden />
                  </NavLink>
                ) : (
                  <button type="button" disabled className={cn(button.outlineSm, "w-full py-3")}>
                    Not available yet
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="surface-inset mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-body-md text-blueprint-muted">
            Classroom and Team Lab are ideas, not products yet. Their features and prices will be listed here once
            they are decided.
          </p>
          <NavLink to="/roadmap" className={button.text}>
            See the roadmap
          </NavLink>
        </div>
      </div>
    </section>
  );
}
