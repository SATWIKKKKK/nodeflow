import { NavLink } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { button, container } from "../components/ui";
import { DiffScene, ReplayScene, RunScene, TraceScene } from "../components/graphics";
import recorded from "../landing/reverseListTrace.json";

const pipeline = [
  {
    scene: RunScene,
    title: "Execute",
    body: "Your code runs in an isolated environment with no internet access and fixed limits on time and memory."
  },
  {
    scene: TraceScene,
    title: "Record",
    body: "At every line, Noesis records the line number, your variables and every object your code has created."
  },
  {
    scene: DiffScene,
    title: "Diff",
    body: "Each step is compared with the one before it: what was created, what changed, and what was removed."
  },
  {
    scene: ReplayScene,
    title: "Draw",
    body: "Every object keeps its place on screen and only what changed is highlighted, so a moved pointer shows as a moved arrow."
  }
];

const limits = [
  { value: "4,000", label: "steps per run", note: "in Python (1,500 in C++ and Java), then the run stops and reports a likely infinite loop" },
  { value: "1,500", label: "steps per live preview", note: "in Python (500 in C++ and Java), since it reruns while you type" },
  { value: "64", label: "items per list", note: "longer lists are shortened in the drawing and marked as such" }
];

// A real step from the recorded reverse_list trace: the moment node 1 is cut loose.
const STEP = 5;
const sampleStep = JSON.stringify(recorded.trace[STEP], null, 2);
const sampleDiff = JSON.stringify(recorded.diffs[STEP], null, 2);

export default function TracingPage() {
  return (
    <>
      <section className="py-16 sm:py-20">
        <div className={container}>
          <SectionHeading
            as="h1"
            title="How tracing works"
            lead="Your code runs for real. Noesis records what it does at every line, then draws each step so you can see exactly what changed."
          />

          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pipeline.map((stage) => {
              const Scene = stage.scene;
              return (
                <li key={stage.title} className="surface-card">
                  <div className="neu-screen mb-6 overflow-hidden rounded-lg border border-blueprint-line">
                    <Scene />
                  </div>
                  <h2 className="text-headline-sm text-primary">{stage.title}</h2>
                  <p className="mt-3 text-body-md text-blueprint-muted">{stage.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="neu-ruled border-y border-blueprint-line bg-background/70 py-16 sm:py-20">
        <div className={`${container} grid gap-6 lg:grid-cols-[0.9fr_1.1fr]`}>
          <div>
            <SectionHeading
              title="One recorded step"
              lead="This is step six of the reverse_list example on the home page, right after current.next = previous ran: node 1's next pointer changed from node 2 to None."
            />
            <p className="text-body-md text-blueprint-muted">
              Every object gets a fixed id such as <code className="font-mono text-primary">obj_1</code>, so the
              same node stays the same node at every step. That is how the drawing can move one arrow instead of
              redrawing the whole list.
            </p>
            <NavLink to="/#replay" className={`${button.outlineSm} mt-8`}>
              Watch the full replay <ArrowRight size={14} aria-hidden />
            </NavLink>
          </div>

          <div className="grid gap-4">
            <div className="overflow-hidden rounded-xl border-[1.25px] border-blueprint-line bg-surface-inset">
              <p className="border-b border-blueprint-line px-4 py-2.5 text-technical-mono text-blueprint-muted">
                trace[{STEP}] · line {recorded.trace[STEP].line}
              </p>
              <pre className="max-h-[340px] overflow-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed text-primary">
                {sampleStep}
              </pre>
            </div>
            <div className="overflow-hidden rounded-xl border-[1.25px] border-blueprint-line bg-surface-inset">
              <p className="border-b border-blueprint-line px-4 py-2.5 text-technical-mono text-blueprint-muted">
                diffs[{STEP}]
              </p>
              <pre className="overflow-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed text-primary">
                {sampleDiff}
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className={container}>
          <SectionHeading
            title="Limits"
            lead="These keep a runaway loop from freezing your run."
          />
          <div className="grid gap-4 sm:grid-cols-3">
            {limits.map((limit) => (
              <article key={limit.label} className="surface-card-compact">
                <p className="text-technical-mono text-blueprint-muted">{limit.label}</p>
                <p className="mt-3 text-metric text-primary">{limit.value}</p>
                <p className="mt-2 text-body-md text-blueprint-muted">{limit.note}</p>
              </article>
            ))}
          </div>

          <div className="surface-inset mt-10 max-w-3xl">
            <p className="text-ui-label text-primary">How each language is traced</p>
            <p className="mt-2 text-body-md text-blueprint-muted">
              Each step is recorded from your program as it actually runs, never guessed from your source code.
              Python, C++ and Java are each recorded with their own debugging tools, and all three produce the same
              kind of steps, so the drawing works the same whichever language you write in.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
