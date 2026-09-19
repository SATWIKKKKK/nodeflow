import { NavLink } from "react-router-dom";
import { ArrowRight, Check, Clock3, ListChecks } from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { RunScene, SubmitScene, TestScene, WriteScene } from "../components/graphics";
import { button, container } from "../components/ui";
import { cn } from "../lib/cn";

const loop = [
  {
    scene: WriteScene,
    title: "Pick a problem",
    body: "Filter the bank by topic and difficulty. The workspace opens with a starter function and the problem's own input ready to go."
  },
  {
    scene: RunScene,
    title: "Run it",
    body: "See the return value, anything you printed, and a replay of every line. Nothing is judged yet, so this is where you experiment."
  },
  {
    scene: TestScene,
    title: "Test it",
    body: "Run the visible cases. When one fails, compare the expected output with yours, then step through a run to see where your pointers go."
  },
  {
    scene: SubmitScene,
    title: "Submit it",
    body: "Judge against every case, hidden ones included. The verdict goes on your record and into your dashboard."
  }
];

const anatomy = [
  { label: "Trace", note: "Your data structures drawn as they are at the current step, with pointers and changed cells marked. A 3D view is one toggle away." },
  { label: "Playback", note: "Reset, step back, play, step forward, speed and a scrubber across the whole trace." },
  { label: "Problem", note: "Statement, examples and constraints, with topic and difficulty." },
  { label: "Editor", note: "The line being replayed is highlighted. Click any line to jump to the step where it ran." },
  { label: "Output", note: "Return value, printed output, verdicts and per-case results, with your errors kept apart from ours." }
];

const phases = [
  {
    name: "Phase 1",
    status: "Shipped",
    title: "Arrays and linked lists",
    points: [
      "Python tracing and playback",
      "Arrays and singly linked lists",
      "Run, Test, Submit and live preview",
      "Accounts and a progress dashboard"
    ]
  },
  {
    name: "Phase 2",
    status: "Current",
    title: "The whole sheet",
    points: [
      "Every problem on the DSA sheet, verified in the sandbox",
      "Traces for Python, C++ and Java",
      "Custom input and classrooms with shared progress"
    ]
  },
  {
    name: "Later",
    status: "Planned",
    title: "Beyond the sheet",
    points: ["Paid plans for larger courses", "Private problem banks for teams", "Sign-in with Google"]
  }
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="py-16 sm:py-20">
        <div className={container}>
          <SectionHeading
            as="h1"
            eyebrow="How it works"
            title={
              <>
                From a problem to the <em className="hero-accent italic">pattern</em> behind it.
              </>
            }
            lead="Noesis is built around one loop: write a solution, watch it run, and fix what the replay shows you."
          />
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {loop.map((step) => {
              const Scene = step.scene;
              return (
                <li key={step.title} className="border-l border-blueprint-line pl-5">
                  <div className="mb-6 max-w-55 overflow-hidden rounded-lg border border-blueprint-line">
                    <Scene />
                  </div>
                  <h2 className="text-headline-sm text-primary">{step.title}</h2>
                  <p className="mt-3 text-body-md text-blueprint-muted">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="border-y border-blueprint-line bg-background/70 py-16 sm:py-20">
        <div className={`${container} grid gap-6 lg:grid-cols-[0.9fr_1.1fr]`}>
          <div>
            <SectionHeading
              eyebrow="The workspace"
              title="Everything on one screen."
              lead="The scene and the code stay side by side, so every step reads as “this line did that”."
            />
            <ul className="grid gap-4">
              {anatomy.map((part) => (
                <li key={part.label} className="grid gap-1 border-l border-blueprint-line pl-5">
                  <span className="text-ui-label text-primary">{part.label}</span>
                  <span className="text-body-md text-blueprint-muted">{part.note}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Schematic of the workspace layout, drawn as a blueprint. */}
          <div className="surface-card self-start">
            <p className="text-technical-mono text-blueprint-muted">Workspace layout · desktop</p>
            <div className="mt-5 grid aspect-4/3 grid-cols-[1.05fr_1fr] gap-3 rounded-xl bg-surface-inset p-3">
              <div className="grid grid-rows-[1fr_auto] gap-3">
                <div className="relative flex items-center justify-center rounded-lg border border-dashed border-blueprint-line bg-card">
                  <svg viewBox="0 0 200 60" className="w-3/4 text-primary" aria-hidden>
                    {[20, 70, 120, 170].map((x, i) => (
                      <g key={x}>
                        <circle cx={x} cy={30} r={11} fill="none" stroke="currentColor" strokeWidth={2} />
                        {i < 3 && <path d={`M ${x + 14} 30 H ${x + 34}`} stroke="currentColor" strokeWidth={2} />}
                      </g>
                    ))}
                  </svg>
                  <span className="absolute left-3 top-2 text-technical-mono text-blueprint-muted">Scene</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-blueprint-line bg-card px-3 py-2.5">
                  <span className="h-5 w-5 rounded-full border border-blueprint-line" />
                  <span className="h-5 w-5 rounded-full bg-[var(--fill-blue)]" />
                  <span className="h-5 w-5 rounded-full border border-blueprint-line" />
                  <span className="ml-2 h-px flex-1 bg-blueprint-line" />
                  <span className="text-technical-mono text-blueprint-muted">Playback</span>
                </div>
              </div>
              <div className="grid grid-rows-[auto_1fr_auto] gap-3">
                <div className="rounded-lg border border-dashed border-blueprint-line bg-card p-3">
                  <span className="text-technical-mono text-blueprint-muted">Problem</span>
                  <span className="mt-2 block h-1.5 w-3/4 rounded-full bg-blueprint-line" />
                  <span className="mt-1.5 block h-1.5 w-1/2 rounded-full bg-blueprint-line" />
                </div>
                <div className="rounded-lg border border-dashed border-blueprint-line bg-card p-3">
                  <span className="text-technical-mono text-blueprint-muted">Editor</span>
                  {[80, 64, 72, 40, 56].map((width, index) => (
                    <span
                      key={index}
                      className={cn(
                        "mt-2 block h-1.5 rounded-full",
                        index === 2 ? "bg-[var(--fill-blue)]" : "bg-blueprint-line"
                      )}
                      style={{ width: `${width}%` }}
                    />
                  ))}
                </div>
                <div className="rounded-lg border border-dashed border-blueprint-line bg-card px-3 py-2.5">
                  <span className="text-technical-mono text-blueprint-muted">Output</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className={container}>
          <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              className="mb-0"
              eyebrow="Roadmap"
              title="Built one phase at a time."
              lead="A structure appears in Noesis only once the tracer and the scene handle it properly. No phase after the first has a date yet."
            />
            <NavLink to="/roadmap" className={cn(button.outline, "self-start lg:self-auto")}>
              Full roadmap <ArrowRight size={14} aria-hidden />
            </NavLink>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {phases.map((phase) => {
              const current = phase.status === "Current";
              const live = phase.status !== "Planned";
              return (
                <article
                  key={phase.name}
                  className={cn("surface-card", current && "border-primary! shadow-[0_20px_48px_rgba(0,0,0,0.14)]!")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-technical-mono text-blueprint-muted">{phase.name}</p>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
                        current ? "badge-current" : "border-blueprint-line text-blueprint-muted"
                      )}
                    >
                      {phase.status}
                    </span>
                  </div>
                  <h3 className="mt-4 text-headline-sm text-primary">{phase.title}</h3>
                  <div className="my-6 h-px bg-blueprint-line" />
                  <ul className="grid gap-3">
                    {phase.points.map((point) => (
                      <li
                        key={point}
                        className={cn("flex gap-3 text-body-md", live ? "text-primary" : "text-blueprint-muted")}
                      >
                        {live ? (
                          <Check size={16} aria-hidden className="check-icon mt-1 shrink-0" />
                        ) : (
                          <Clock3 size={16} aria-hidden className="mt-1 shrink-0" />
                        )}
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>

          <div className="mt-12 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <NavLink to="/problems" className={button.primary}>
              Open a problem <ArrowRight size={14} aria-hidden />
            </NavLink>
            <NavLink to="/tracing" className={button.outlineSm}>
              <ListChecks size={15} aria-hidden /> How tracing works
            </NavLink>
          </div>
        </div>
      </section>
    </>
  );
}
