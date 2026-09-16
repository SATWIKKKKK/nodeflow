import { useMemo, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Code2,
  History,
  Layers3,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Terminal,
  type LucideIcon
} from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { button, container, iconTile, stepIcon } from "../components/ui";
import { useProblems } from "../lib/problems";
import { cn } from "../lib/cn";
import { TraceReplay } from "./TraceReplay";

const PLANNED_BANK = 388;
const STEP_LIMIT = 7000;

const steps: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: Code2,
    title: "Write",
    body: "Pick a problem and write a Python solution. The editor opens with the function signature already in place."
  },
  {
    icon: Terminal,
    title: "Run",
    body: "Your code runs in a fresh sandbox with no network access, against the problem's own input."
  },
  {
    icon: Activity,
    title: "Trace",
    body: "The tracer records every variable and heap object at every line, then diffs each step against the one before."
  },
  {
    icon: History,
    title: "Replay",
    body: "Step forward and back, scrub the timeline, or click a node to jump to the line that last changed it."
  }
];

const features: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: Terminal,
    title: "Run",
    body: "Execute once on the problem's input and get the return value, anything you printed, and the full trace."
  },
  {
    icon: ListChecks,
    title: "Test",
    body: "Check the visible cases. When one fails, you see the expected output next to what your code returned."
  },
  {
    icon: ShieldCheck,
    title: "Submit",
    body: "Judge against every case, hidden ones included. Hidden inputs stay sealed; your verdict goes on your record."
  },
  {
    icon: RefreshCw,
    title: "Live preview",
    body: "While you type, Noesis retraces in the background and keeps the last good picture on screen when code is mid-edit."
  },
  {
    icon: Layers3,
    title: "Diffs, not guesses",
    body: "The scene only moves when a diff says something changed: a node created, a pointer rewired, a value updated."
  },
  {
    icon: AlertTriangle,
    title: "Your bug or ours",
    body: "An exception in your code and a problem with the sandbox are reported differently, so you never chase the wrong one."
  }
];

const faqs: Array<{ q: string; a: string }> = [
  {
    q: "Do I need an account?",
    a: "No. You can run, test and submit without one. Create an account when you want your submissions and progress kept under your name."
  },
  {
    q: "Which languages can I use?",
    a: "Python, C++ and Java all run and are judged. Only Python produces a visual trace today; the other two get theirs later."
  },
  {
    q: "Is it safe to run my code?",
    a: "Every run gets its own container with no network, one CPU, a memory cap, a read-only filesystem and no extra privileges. The container is deleted when the run ends."
  },
  {
    q: "What if my loop never ends?",
    a: `The run stops at the time limit or after ${STEP_LIMIT.toLocaleString("en-US")} traced steps, and the workspace tells you a loop probably never exits. Whatever was traced before that point can still be replayed.`
  },
  {
    q: "Why mostly arrays and linked lists?",
    a: "They are where the tracer and the scene were proven first. A first stack and a first queue problem are live too. Trees, graphs and recursion come next, and they will only appear once they actually work."
  },
  {
    q: "Is Noesis free?",
    a: "Yes. The only plan today is free. Plans for classrooms and teams are on the roadmap, and their prices have not been set."
  }
];

function Section({
  children,
  ruled = false,
  className,
  id
}: {
  children: ReactNode;
  ruled?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "pointer-events-auto py-16 sm:py-20",
        ruled && "border-y border-blueprint-line bg-background/70",
        className
      )}
    >
      <div className={container}>{children}</div>
    </section>
  );
}

const reveal = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const }
};

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-blueprint-line bg-card shadow-[0_10px_26px_rgba(0,0,0,0.06)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="no-lift flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
      >
        <span className="text-body-lg font-semibold text-primary">{q}</span>
        <ChevronDown
          size={18}
          aria-hidden
          className={cn("shrink-0 text-blueprint-muted transition-transform duration-300", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <p className="-mt-2 px-5 pb-5 text-body-md text-blueprint-muted">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LandingPage() {
  const { problems } = useProblems();

  const bank = useMemo(() => {
    const count = (type: string) => problems.filter((problem) => problem.structureType === type).length;
    return {
      total: problems.length,
      arrays: count("array"),
      lists: count("linked_list")
    };
  }, [problems]);

  const metrics = [
    {
      label: "live now",
      value: bank.total ? String(bank.total) : "—",
      note: bank.total
        ? `problems, led by ${bank.arrays} arrays and ${bank.lists} linked lists`
        : "Loading the live bank"
    },
    {
      label: "planned",
      value: String(PLANNED_BANK),
      note: "questions, each reviewed before it goes live"
    },
    { label: "languages", value: "3", note: "all judged; Python is traced, C++ and Java are not yet" },
    {
      label: "step limit",
      value: STEP_LIMIT.toLocaleString("en-US"),
      note: "per run, so a runaway loop is caught instead of hanging"
    }
  ];

  return (
    <>
      {/* Hero. Empty space lets clicks through to the ripple grid behind it. */}
      <section className="pointer-events-none flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center py-16 text-center sm:py-20">
        <motion.div
          className={cn(container, "pointer-events-auto flex flex-col items-center")}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-blueprint-line bg-card px-3 py-1.5 text-ui-label text-blueprint-muted">
            <Activity size={15} aria-hidden className="text-primary" />
            Traced from your real code
          </p>

          <h1 className="mt-6 max-w-3xl text-balance text-hero text-primary">
            Watch your own code <em className="italic">rewire</em> the list.
          </h1>

          <p className="mt-6 max-w-xl text-[clamp(1rem,2vw,1.2rem)] leading-8 text-blueprint-muted">
            Noesis runs your Python in a sandbox, records every object at every line, and replays it step by
            step, so you can point at the exact line where a pointer went wrong.
          </p>

          <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <NavLink to="/problems" className={cn(button.hero, "w-full sm:w-auto")}>
              Open a problem <ArrowRight size={14} aria-hidden />
            </NavLink>
            <a href="#replay" className={cn(button.outline, "w-full sm:w-auto")}>
              Watch a real trace
            </a>
          </div>

          <p className="mt-6 text-technical-mono text-blueprint-muted">No account needed to run your code</p>
        </motion.div>
      </section>

      <Section ruled id="replay" className="scroll-mt-24">
        <motion.div {...reveal}>
          <SectionHeading
            eyebrow="A real trace"
            title={
              <>
                This is what your code <em className="italic">did</em>, not what a script says it should.
              </>
            }
            lead="A recording of reverse_list running on [1, 2, 3, 4] in the Noesis tracer, on a loop. Every arrow and label is drawn from the heap the tracer captured at that line."
          />
          <TraceReplay />
        </motion.div>
      </Section>

      <Section>
        <motion.div {...reveal}>
          <SectionHeading
            eyebrow="How it works"
            title="Four steps from code to replay."
            lead="The visualization is never drawn by hand. It is rebuilt from what the interpreter recorded."
          />
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="border-l border-blueprint-line pl-5">
                  <div className="flex items-center gap-3">
                    <span className={stepIcon}>
                      <Icon size={18} aria-hidden />
                    </span>
                    <span className="text-technical-mono text-blueprint-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-5 text-headline-sm text-primary">{step.title}</h3>
                  <p className="mt-3 text-body-md text-blueprint-muted">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </motion.div>
      </Section>

      <Section ruled>
        <motion.div {...reveal}>
          <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              className="mb-0"
              eyebrow="In the workspace"
              title="Built for the moment your solution breaks."
              lead="Three ways to execute, a preview that keeps up with your typing, and errors that say whose fault they are."
            />
            <NavLink to="/tracing" className={cn(button.outline, "self-start lg:self-auto")}>
              How tracing works <ArrowRight size={14} aria-hidden />
            </NavLink>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="surface-card transition-transform duration-200 hover:-translate-y-1"
                >
                  <span className={iconTile}>
                    <Icon size={20} aria-hidden />
                  </span>
                  <h3 className="mt-5 text-headline-sm text-primary">{feature.title}</h3>
                  <p className="mt-3 text-body-md text-blueprint-muted">{feature.body}</p>
                </article>
              );
            })}
          </div>
        </motion.div>
      </Section>

      <Section>
        <motion.div {...reveal} className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionHeading
              className="mb-8"
              eyebrow="Scope"
              title="Honest about what is live."
              lead="Noesis shows only what works today. Everything else is on the roadmap and labelled that way."
            />
            <p className="text-ui-label text-primary">Live now</p>
            <ul className="mt-4 grid gap-3">
              {[
                "Python tracing with step-by-step playback",
                "Arrays and singly linked lists in the scene",
                "Run, Test, Submit and live preview",
                "Progress dashboard built from your submissions"
              ].map((item) => (
                <li key={item} className="flex gap-3 text-body-md text-primary">
                  <Check size={16} aria-hidden className="check-icon mt-1 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-ui-label text-primary">Planned</p>
            <ul className="mt-4 grid gap-3">
              {[
                "Trees, graphs, stacks, queues and recursion",
                "Visual traces for C++ and Java",
                `The full ${PLANNED_BANK}-question bank`
              ].map((item) => (
                <li key={item} className="flex gap-3 text-body-md text-blueprint-muted">
                  <Clock3 size={16} aria-hidden className="mt-1 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid content-start grid-cols-2 gap-4">
            {metrics.map((metric) => (
              <article key={metric.label} className="surface-card-compact">
                <p className="text-technical-mono text-blueprint-muted">{metric.label}</p>
                <p className="mt-3 text-metric text-primary">{metric.value}</p>
                <p className="mt-2 text-body-md text-blueprint-muted">{metric.note}</p>
              </article>
            ))}
          </div>
        </motion.div>
      </Section>

      <Section ruled>
        <motion.div {...reveal} className="grid gap-8 lg:grid-cols-[0.7fr_1fr]">
          <SectionHeading
            eyebrow="Questions"
            title="Before you start."
            lead="The short answers. The pages on tracing and security have the long ones."
          />
          <div className="grid content-start gap-3">
            {faqs.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </motion.div>
      </Section>

      <Section>
        <motion.div
          {...reveal}
          className="landing-cta-panel flex flex-col gap-8 rounded-xl p-6 shadow-[0_14px_34px_rgba(0,0,0,0.14)] sm:p-7 lg:flex-row lg:items-end lg:justify-between lg:p-12"
        >
          <div className="max-w-2xl">
            <p className="text-ui-label text-white/60">Start here</p>
            <h2 className="mt-3 text-balance text-cta">
              Open a problem. Press <em className="italic">Run</em>.
            </h2>
            <p className="mt-4 text-body-lg text-white/70">
              Begin with reversing a linked list. It is the problem from the replay above, so you already know
              what to look for.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
            <NavLink
              to="/workspace/reverse-linked-list"
              className="lift landing-cta-button inline-flex items-center justify-center gap-2 rounded-full border px-8 py-3.5 text-ui-label"
            >
              Open the workspace <ArrowRight size={14} aria-hidden />
            </NavLink>
            <NavLink
              to="/problems"
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-3 text-ui-label text-white transition-colors hover:bg-white/10"
            >
              Browse all problems
            </NavLink>
          </div>
        </motion.div>
      </Section>
    </>
  );
}
