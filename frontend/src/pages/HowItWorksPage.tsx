import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { GAME_REWARD, SOLVE_REWARD } from "@nodeflow/shared";
import { button, container } from "../components/ui";
import { cn } from "../lib/cn";

/**
 * The guide: how to use Noesis, as numbered documentation.
 *
 * Every statement here describes what ships (see backend/src/ask/knowledge.ts,
 * which the assistant answers from, for the same facts). Sections are numbered
 * so a learner can be pointed at "3.3" and land on it; each has an anchor.
 */

interface Topic {
  id: string;
  title: string;
  body: ReactNode;
}

interface Chapter {
  title: string;
  topics: Topic[];
}

const Key = ({ children }: { children: ReactNode }) => (
  <kbd className="neu-tag rounded-md border border-blueprint-line bg-card px-1.5 py-0.5 font-mono text-[12px] text-primary">
    {children}
  </kbd>
);

const P = ({ children }: { children: ReactNode }) => (
  <p className="mt-3 text-body-md leading-7 text-blueprint-muted">{children}</p>
);

const List = ({ items }: { items: ReactNode[] }) => (
  <ul className="mt-3 grid gap-2">
    {items.map((item, index) => (
      <li key={index} className="flex gap-3 text-body-md leading-7 text-blueprint-muted">
        <span aria-hidden className="mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--fill-blue)]" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const Strong = ({ children }: { children: ReactNode }) => <strong className="font-medium text-primary">{children}</strong>;

const CHAPTERS: Chapter[] = [
  {
    title: "Getting started",
    topics: [
      {
        id: "account",
        title: "Create an account",
        body: (
          <P>
            Noesis is free. Sign up with an email address and a password; that is all it asks for. Your account keeps
            your submissions, solved problems and code in progress, and you stay signed in on that device until you
            sign out.
          </P>
        )
      },
      {
        id: "find",
        title: "Find a problem",
        body: (
          <>
            <P>
              Open <Strong>Problems</Strong> to browse every problem. Narrow the list by topic and difficulty, or by
              whether you have solved it. To jump straight to one, open search from the top bar (or press{" "}
              <Key>/</Key>) and type part of its name or topic.
            </P>
            <P>
              The <Strong>Problem map</Strong> shows every topic at a glance, with how many problems you have solved
              in each.
            </P>
          </>
        )
      },
      {
        id: "workspace",
        title: "The problem page",
        body: (
          <>
            <P>Opening a problem shows everything you need on one screen:</P>
            <List
              items={[
                <><Strong>Trace</Strong> (left): your data structures as your code changes them, step by step.</>,
                <><Strong>Problem</Strong>: the statement, examples and constraints. It can be collapsed.</>,
                <><Strong>Editor</Strong>: where you write your solution. It can go fullscreen, and reset to the starting code.</>,
                <><Strong>Output</Strong>: the result of Run, Test or Submit.</>
              ]}
            />
          </>
        )
      }
    ]
  },
  {
    title: "Writing and running code",
    topics: [
      {
        id: "language",
        title: "Choose a language",
        body: (
          <P>
            Write in Python, C++ or Java; pick one from the menu above the editor. Each language keeps its own draft
            for each problem, so switching does not lose your work. All three are traced and judged the same way.
          </P>
        )
      },
      {
        id: "run",
        title: "Run",
        body: (
          <P>
            <Strong>Run</Strong> executes your code once on the problem's example input and replays it in the trace.
            It shows what your function returned and anything you printed, but it does not judge the answer. Use it
            to experiment and to watch what your code does.
          </P>
        )
      },
      {
        id: "test",
        title: "Test",
        body: (
          <P>
            <Strong>Test</Strong> runs the example cases you can see in the statement and shows, for each one, the
            expected answer next to yours. When a case fails, Run it and step through the trace to find where your
            code went a different way.
          </P>
        )
      },
      {
        id: "submit",
        title: "Submit",
        body: (
          <P>
            <Strong>Submit</Strong> checks your code against every case, including hidden ones, and records the
            result. Hidden inputs are never shown; if one fails, you are told which hidden case it was. An accepted
            submission marks the problem as solved.
          </P>
        )
      },
      {
        id: "custom",
        title: "Custom input",
        body: (
          <P>
            Under the editor, <Strong>Custom input</Strong> lets you run your code on an input of your own, written as
            JSON. Start from one of the examples and change it. When you Run with custom input, the correct answer for
            it is shown next to yours.
          </P>
        )
      },
      {
        id: "preview",
        title: "Live preview",
        body: (
          <P>
            As you type, Noesis quietly reruns your code and updates the trace. While your code is half-written and
            will not run, the last good trace stays on screen.
          </P>
        )
      }
    ]
  },
  {
    title: "Reading a trace",
    topics: [
      {
        id: "2d",
        title: "The 2D view",
        body: (
          <>
            <P>
              The 2D view draws the values your code is working with at the current step: arrays and strings as rows
              of cells, linked lists and trees as nodes and arrows, plus stacks, queues, grids, maps, graphs and the
              call stack for recursion.
            </P>
            <List
              items={[
                "Variables that point into a structure appear as small labels beside the cell or node they point at.",
                "Whatever the current line changed is highlighted.",
                "When a value moves from one structure to another, an arrow shows where it came from."
              ]}
            />
          </>
        )
      },
      {
        id: "3d",
        title: "The 3D view",
        body: (
          <P>
            For problems built from nodes that point at each other (linked lists, trees and tries) a 3D view is one
            toggle away. Drag to turn it, scroll or pinch to zoom, and use the zoom buttons to step in and out. Other
            problems are shown in 2D only, where they read best.
          </P>
        )
      },
      {
        id: "playback",
        title: "Playback controls",
        body: (
          <List
            items={[
              "Play the whole run, or pause it.",
              "Step forward or back one line at a time.",
              "Drag the timeline to any point in the run.",
              "Change the speed: 0.5×, 1×, 2× or 4×.",
              "Reset to the first step."
            ]}
          />
        )
      },
      {
        id: "sync",
        title: "Code and trace together",
        body: (
          <P>
            The line that just ran is highlighted in the editor as you step. Click any line in the editor to jump to
            the step where it ran, or click a node in the drawing to jump to the line that last changed it.
          </P>
        )
      }
    ]
  },
  {
    title: "Results and errors",
    topics: [
      {
        id: "verdicts",
        title: "Verdicts",
        body: (
          <List
            items={[
              <><Strong>Accepted</Strong>: every case passed.</>,
              <><Strong>Wrong Answer</Strong>: your code ran but returned a different answer for at least one case.</>,
              <><Strong>Runtime Error</Strong>: your code stopped with an error, such as an index out of range.</>,
              <><Strong>Compile Error</Strong>: C++ or Java code that does not compile.</>,
              <><Strong>Time Limit Exceeded</Strong>: your code took too long, usually a loop that never ends.</>
            ]}
          />
        )
      },
      {
        id: "errors",
        title: "When something goes wrong",
        body: (
          <P>
            An error in your code is shown with its message and the line it happened on. If a run fails because of a
            problem on our side, Noesis says so plainly and nothing is counted against you; try again in a moment.
          </P>
        )
      },
      {
        id: "limits",
        title: "Limits",
        body: (
          <P>
            A run is recorded for up to 4,000 steps in Python and 1,500 in C++ and Java. If your code goes past that,
            the run stops and tells you it may be stuck in an infinite loop, so a runaway loop never freezes the
            page. Very large structures are shortened in the drawing.
          </P>
        )
      }
    ]
  },
  {
    title: "Your progress",
    topics: [
      {
        id: "dashboard",
        title: "Dashboard",
        body: (
          <P>
            Your dashboard shows how many problems you have attempted and solved, how far through all the problems
            you are, your recent submissions, and your progress in each topic.
          </P>
        )
      },
      {
        id: "continue",
        title: "Continue solving",
        body: (
          <P>
            Any problem you open and leave unsolved is kept in <Strong>Continue solving</Strong>, with your code
            exactly as you left it. Solving it removes it from the list.
          </P>
        )
      },
      {
        id: "coins",
        title: "Coins",
        body: (
          <List
            items={[
              <>The first time you solve a problem you earn coins by difficulty: {SOLVE_REWARD.Easy} for Easy, {SOLVE_REWARD.Medium} for Medium and {SOLVE_REWARD.Hard} for Hard.</>,
              <>While a longer task is working, a small game pays {GAME_REWARD.right} coins for a right pick and takes {Math.abs(GAME_REWARD.wrong)} for a wrong one.</>,
              "Click your coin total to see where your coins came from."
            ]}
          />
        )
      }
    ]
  },
  {
    title: "Classrooms",
    topics: [
      {
        id: "create",
        title: "Create a classroom",
        body: (
          <P>
            Anyone signed in can create a classroom and becomes its owner. The owner gets a six-character join code,
            assigns problems, and sees a progress board of everyone in the room, built from their submissions.
          </P>
        )
      },
      {
        id: "join",
        title: "Join a classroom",
        body: (
          <P>
            Enter the join code your teacher shares under <Strong>Classrooms</Strong>. Your submissions then appear on
            the room's board, and the assigned problems are listed for you.
          </P>
        )
      }
    ]
  },
  {
    title: "Changing a problem",
    topics: [
      {
        id: "variants",
        title: "Change a word",
        body: (
          <>
            <P>
              Some words in a problem statement are underlined, such as "sorted", "two" or "singly". Click one and type
              a replacement to get the problem that follows from it: "two lists" can become "three lists", "singly
              linked" can become "doubly linked".
            </P>
            <P>
              Noesis rewrites the problem and works out every answer by running a solution, so the new problem is
              checked, not guessed. It takes up to half a minute. If the change has been made before, you are taken
              straight to that problem.
            </P>
          </>
        )
      }
    ]
  },
  {
    title: "Help",
    topics: [
      {
        id: "ask",
        title: "Ask a question",
        body: (
          <P>
            The question box at the bottom of the home page answers questions about Noesis: how a feature works,
            what is supported, and where to find things.
          </P>
        )
      },
      {
        id: "contact",
        title: "Contact",
        body: (
          <P>
            For anything else, or if something looks broken, the{" "}
            <NavLink to="/contact" className="text-[var(--fill-blue)] underline underline-offset-4">
              contact page
            </NavLink>{" "}
            has an email address and a phone number.
          </P>
        )
      }
    ]
  }
];

const anchor = (chapter: number, topic: number) => `section-${chapter + 1}-${topic + 1}`;

/** The section in view, for the contents list. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
        const first = ids.find((id) => seen.get(id));
        if (first) setActive(first);
      },
      { rootMargin: "-96px 0px -60% 0px" }
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

const ALL_IDS = CHAPTERS.flatMap((chapter, c) => chapter.topics.map((_, t) => anchor(c, t)));

export default function HowItWorksPage() {
  const active = useActiveSection(ALL_IDS);

  return (
    <div className={`${container} py-14 sm:py-16`}>
      <header className="max-w-3xl">
        <h1 className="text-display-xl text-balance text-primary">How to use Noesis</h1>
        <p className="mt-4 text-pretty text-body-lg text-blueprint-muted">
          A guide to everything in Noesis, from your first problem to reading a trace, in the order you are likely to
          need it.
        </p>
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="Contents" className="lg:sticky lg:top-28 lg:self-start">
          <div className="neu-panel rounded-2xl border border-blueprint-line bg-card p-4 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
            <p className="px-2 pb-2 text-technical-mono text-blueprint-muted">Contents</p>
            <ol className="grid gap-1">
              {CHAPTERS.map((chapter, c) => (
                <li key={chapter.title}>
                  <a
                    href={`#${anchor(c, 0)}`}
                    className="flex gap-2 rounded-lg px-2 py-1.5 text-[14px] font-medium text-primary hover:text-[var(--fill-blue)]"
                  >
                    <span className="w-5 font-mono text-blueprint-muted">{c + 1}</span>
                    {chapter.title}
                  </a>
                  <ol className="mb-1 grid">
                    {chapter.topics.map((topic, t) => {
                      const id = anchor(c, t);
                      const current = active === id;
                      return (
                        <li key={topic.id}>
                          <a
                            href={`#${id}`}
                            aria-current={current ? "location" : undefined}
                            className={cn(
                              "flex gap-2 rounded-lg py-1 pl-9 pr-2 text-[13px] transition-colors",
                              current
                                ? "bg-[var(--neu-face-pressed,var(--surface-hover))] font-medium text-[var(--fill-blue)]"
                                : "text-blueprint-muted hover:text-primary"
                            )}
                          >
                            <span className="w-7 shrink-0 font-mono">
                              {c + 1}.{t + 1}
                            </span>
                            {topic.title}
                          </a>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="min-w-0 max-w-3xl">
          {CHAPTERS.map((chapter, c) => (
            <section key={chapter.title} className={cn(c > 0 && "mt-14 border-t border-blueprint-line pt-12 neu-groove-t")}>
              <h2 className="flex items-baseline gap-3 text-headline-lg text-primary">
                <span className="font-mono text-[0.6em] text-[var(--fill-blue)]">{c + 1}</span>
                {chapter.title}
              </h2>
              {chapter.topics.map((topic, t) => (
                <div key={topic.id} id={anchor(c, t)} className="mt-8 scroll-mt-28">
                  <h3 className="flex items-baseline gap-3 text-headline-sm text-primary">
                    <a
                      href={`#${anchor(c, t)}`}
                      className="font-mono text-[0.75em] text-blueprint-muted hover:text-[var(--fill-blue)]"
                    >
                      {c + 1}.{t + 1}
                    </a>
                    {topic.title}
                  </h3>
                  {topic.body}
                </div>
              ))}
            </section>
          ))}

          <div className="mt-16 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <NavLink to="/problems" className={button.primary}>
              Open a problem <ArrowRight size={14} aria-hidden />
            </NavLink>
            <NavLink to="/tracing" className={button.outlineSm}>
              How tracing works
            </NavLink>
          </div>
        </article>
      </div>
    </div>
  );
}
