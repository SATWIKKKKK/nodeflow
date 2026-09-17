import { NavLink } from "react-router-dom";
import { Activity, ArrowRight, Box, GitCompareArrows, Shapes } from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { button, container, iconTile } from "../components/ui";
import recorded from "../landing/reverseListTrace.json";

const pipeline = [
  {
    icon: Box,
    title: "Execute",
    body: "Your code runs in a fresh, network-less container with CPU, memory and time limits."
  },
  {
    icon: Activity,
    title: "Record",
    body: "At every line, the tracer snapshots the line number, your variables and every object on the heap, keyed by id."
  },
  {
    icon: GitCompareArrows,
    title: "Diff",
    body: "Each snapshot is compared with the one before: which objects were created, which fields changed, which disappeared."
  },
  {
    icon: Shapes,
    title: "Draw",
    body: "The trace keeps one shape per heap id and only highlights what a diff names, so a moved pointer reads as a moved arrow."
  }
];

const limits = [
  { value: "4,000", label: "steps per run", note: "in Python (1,500 in C++ and Java), then the run stops and reports a likely infinite loop" },
  { value: "1,500", label: "steps per live preview", note: "in Python (500 in C++ and Java), since it reruns while you type" },
  { value: "64", label: "items per list", note: "longer lists are cut off in the snapshot and marked as truncated" },
  { value: "2", label: "runs at once", note: "by default; the rest wait in a queue instead of piling up" }
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
            eyebrow="Tracing"
            title={
              <>
                Your bug, <em className="italic">replayed</em> line by line.
              </>
            }
            lead="Noesis never guesses at your data structures. Your code runs for real, the tracer records the heap at every line, and the scene moves only when a diff says something changed."
          />

          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pipeline.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <li key={stage.title} className="surface-card">
                  <div className="flex items-center justify-between">
                    <span className={iconTile}>
                      <Icon size={20} aria-hidden />
                    </span>
                    <span className="text-technical-mono text-blueprint-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h2 className="mt-5 text-headline-sm text-primary">{stage.title}</h2>
                  <p className="mt-3 text-body-md text-blueprint-muted">{stage.body}</p>
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
              eyebrow="One step"
              title="What the tracer actually hands the scene."
              lead="This is step six of the reverse_list recording on the home page, just after current.next = previous ran. Node 1's next pointer went from node 2 to None."
            />
            <p className="text-body-md text-blueprint-muted">
              Object references are ids like <code className="font-mono text-primary">obj_1</code>, so the same
              node keeps the same identity across every step. That is what lets the scene move a pointer instead
              of redrawing the list.
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
            eyebrow="Limits"
            title="Bounded on purpose."
            lead="Buggy linked-list code loops forever surprisingly often. These limits keep a bad run from taking the page down with it."
          />
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
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
              The trace is built from real program state, never from reading your source. Python is recorded with
              the interpreter's own trace hook, C++ is stepped under gdb, and Java is stepped through the JVM's
              debugger interface. All three produce the same heap snapshots, so the picture works the same way
              whichever language you write in.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
