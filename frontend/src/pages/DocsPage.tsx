import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { GAME_REWARD, SOLVE_REWARD } from "@nodeflow/shared";
import { DiffScene, ReplayScene, RunScene, TraceScene } from "../components/graphics";
import { container } from "../components/ui";
import { cn } from "../lib/cn";

/**
 * The docs: how to use Noesis, as numbered chapters.
 *
 * Every statement here describes what ships (backend/src/ask/knowledge.ts,
 * which the assistant answers from, holds the same facts). Sections are
 * numbered so a learner can be pointed at "3.3" and land on it.
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

/** One of the site's step illustrations, set into the page as a small screen. */
const Figure = ({ scene: Scene }: { scene: ComponentType }) => (
  <div className="neu-screen mt-4 max-w-xs overflow-hidden rounded-xl border border-blueprint-line">
    <Scene />
  </div>
);

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
            Write in Python, C++, Java, JavaScript, TypeScript or C; pick one from the menu above the editor. Each language keeps
            its own draft for each problem, so switching does not lose your work. All six are traced and judged the
            same way. C follows LeetCode's conventions: an array arrives with its length, and a function that returns
            an array sets <code>*returnSize</code>.
          </P>
        )
      },
      {
        id: "run",
        title: "Run",
        body: (
          <P>
            <Strong>Run</Strong> executes your code once on the case selected in the Testcase tab and replays it in
            the trace. It shows what your function returned, anything you printed, and the expected answer beside
            yours. Use it to experiment and to watch what your code does.
          </P>
        )
      },
      {
        id: "test",
        title: "Test",
        body: (
          <P>
            <Strong>Test</Strong> runs every case in the Testcase tab, the problem's own and any you added, and
            shows, for each one, the expected answer next to yours. When a case fails, select it, Run it and step
            through the trace to find where your code went a different way.
          </P>
        )
      },
      {
        id: "submit",
        title: "Submit",
        body: (
          <P>
            <Strong>Submit</Strong> judges your code the way LeetCode does: the visible cases, the hand-written
            hidden ones, then a stress suite of about a hundred generated cases (small, large, sorted, repeated and
            empty inputs), then any cases of your own. It stops at the first failure and shows how many passed. A
            hand-written hidden case stays sealed if it fails; a failing stress case is shown in full, so you can add
            it to your cases and trace it. An accepted submission marks the problem as solved.
          </P>
        )
      },
      {
        id: "custom",
        title: "Your own test cases",
        body: (
          <P>
            The <Strong>Testcase</Strong> tab holds the cases Run, Test and Submit use. Press{" "}
            <Strong>Edit cases</Strong> (or click any value) to change an input in place, each one written as JSON,
            and <Strong>+</Strong> to add a case of your own, which starts as a copy of the one on screen. The
            expected answer for any input comes from the reference solution. Up to ten cases fit, and Submit judges
            yours after its own.
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
    title: "How tracing works",
    topics: [
      {
        id: "trace-run",
        title: "Your code runs for real",
        body: (
          <>
            <Figure scene={RunScene} />
            <P>
              Every run happens in its own isolated environment with no internet access and fixed limits on time and
              memory. Nothing is simulated: the trace comes from your program as it actually ran.
            </P>
          </>
        )
      },
      {
        id: "trace-record",
        title: "Every line is recorded",
        body: (
          <>
            <Figure scene={TraceScene} />
            <P>
              At every line, Noesis records which line ran, the value of each variable, and every object your code has
              created, such as list nodes, tree nodes, arrays and maps. Each object gets a fixed id, so the same node
              stays the same node at every step.
            </P>
          </>
        )
      },
      {
        id: "trace-diff",
        title: "Only what changed is marked",
        body: (
          <>
            <Figure scene={DiffScene} />
            <P>
              Each step is compared with the one before it: what was created, what changed and what was removed. That
              is what the highlight in the drawing shows, so you see the effect of the line that just ran, nothing
              more.
            </P>
          </>
        )
      },
      {
        id: "trace-draw",
        title: "The same drawing for every language",
        body: (
          <>
            <Figure scene={ReplayScene} />
            <P>
              Every language is recorded with its own tools, and all six produce the same kind of steps. Two different correct solutions to a problem produce two different replays, because each
              shows what that code did.
            </P>
          </>
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
              <><Strong>Compile Error</Strong>: code that does not compile, or has a syntax error.</>,
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
            A run is recorded for up to 4,000 steps in Python, 3,000 in JavaScript and TypeScript, and 1,500 in C, C++
            and Java. If your code goes past that,
            the run stops and tells you it may be stuck in an infinite loop, so a runaway loop never freezes the
            page. Lists longer than 64 items are shortened in the drawing and marked as such.
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

/** `#section-3-2` -> [2, 1]; anything else -> null. */
const parseHash = (hash: string): [number, number] | null => {
  const match = /^#section-(\d+)-(\d+)$/.exec(hash);
  if (!match) return null;
  const chapter = Number(match[1]) - 1;
  const topic = Number(match[2]) - 1;
  if (!CHAPTERS[chapter] || !CHAPTERS[chapter].topics[topic]) return null;
  return [chapter, topic];
};

/** The section in view, for the contents list. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    setActive(ids[0]);
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
        const first = ids.find((id) => seen.get(id));
        if (first) setActive(first);
      },
      { rootMargin: "-96px 0px -55% 0px" }
    );
    // The chapter slides in; observe it once it is in the document.
    const frame = window.requestAnimationFrame(() => {
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element) observer.observe(element);
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ids]);
  return active;
}

const SLIDE = {
  enter: (direction: number) => ({ x: direction * 56, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction * -56, opacity: 0 })
};

const coarsePointer = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(pointer: coarse)").matches);

/**
 * Docs: how to use Noesis, one chapter per page.
 *
 * The whole guide on one page was too long to read or find things in. Each
 * chapter now has its own page; the contents list on the left shows every
 * chapter and opens the current one's sections, and the chapter slides left
 * or right as you move through them (buttons, the arrow keys, or a swipe on a
 * touch screen). Every section keeps a numbered link, #section-3-2, that
 * opens the right chapter at the right place.
 */
export default function DocsPage() {
  const initial = typeof window !== "undefined" ? parseHash(window.location.hash) : null;
  const [chapter, setChapter] = useState(initial?.[0] ?? 0);
  const [direction, setDirection] = useState(1);
  const [target, setTarget] = useState<string | null>(initial ? anchor(initial[0], initial[1]) : null);
  const top = useRef<HTMLDivElement>(null);
  const [swipe] = useState(coarsePointer);

  const ids = useMemo(() => CHAPTERS[chapter].topics.map((_, t) => anchor(chapter, t)), [chapter]);
  const active = useActiveSection(ids);

  const go = useCallback(
    (next: number, section?: string) => {
      if (next < 0 || next >= CHAPTERS.length) return;
      if (next === chapter) {
        if (section) document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      setDirection(next > chapter ? 1 : -1);
      setChapter(next);
      setTarget(section ?? null);
      window.history.replaceState(null, "", `#${section ?? anchor(next, 0)}`);
    },
    [chapter]
  );

  // After a chapter change: bring the new chapter's start (or the section
  // asked for) into view once it has slid in.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const element = target ? document.getElementById(target) : top.current;
      if (!element) return;
      const y = element.getBoundingClientRect().top + window.scrollY - 104;
      if (target || element.getBoundingClientRect().top < 0) window.scrollTo({ top: y, behavior: "smooth" });
      setTarget(null);
    }, 280);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter]);

  // Left and right arrow keys turn the page, when not typing.
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true']");
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowRight") go(chapter + 1);
      if (event.key === "ArrowLeft") go(chapter - 1);
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [chapter, go]);

  // Back and forward in the browser follow the hash.
  useEffect(() => {
    const follow = () => {
      const found = parseHash(window.location.hash);
      if (found) go(found[0], anchor(found[0], found[1]));
    };
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [go]);

  const current = CHAPTERS[chapter];
  const previous = CHAPTERS[chapter - 1];
  const next = CHAPTERS[chapter + 1];

  return (
    <div className={`${container} py-14 sm:py-16`}>
      <header className="max-w-3xl">
        <h1 className="text-display-xl text-balance text-primary">Docs</h1>
        <p className="mt-4 text-pretty text-body-lg text-blueprint-muted">
          Everything about using Noesis, from your first problem to reading a trace, one chapter at a time.
        </p>
      </header>

      <div ref={top} className="mt-12 grid scroll-mt-28 gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="Contents" className="lg:sticky lg:top-28 lg:self-start">
          <div className="neu-panel rounded-2xl border border-blueprint-line bg-card p-3 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
            <ol className="grid gap-0.5">
              {CHAPTERS.map((entry, c) => {
                const open = c === chapter;
                return (
                  <li key={entry.title}>
                    <button
                      type="button"
                      onClick={() => go(c)}
                      aria-current={open ? "page" : undefined}
                      className={cn(
                        "menu-item no-lift flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left text-[14px]",
                        open ? "font-semibold text-[var(--fill-blue)]" : "font-medium text-primary"
                      )}
                      style={{ minHeight: 0 }}
                    >
                      <span className="w-4 shrink-0 font-mono text-blueprint-muted">{c + 1}</span>
                      {entry.title}
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.ol
                          key="topics"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          {entry.topics.map((topic, t) => {
                            const id = anchor(c, t);
                            const here = active === id;
                            return (
                              <li key={topic.id}>
                                <a
                                  href={`#${id}`}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    window.history.replaceState(null, "", `#${id}`);
                                    go(c, id);
                                  }}
                                  aria-current={here ? "location" : undefined}
                                  className={cn(
                                    "flex gap-2 rounded-lg py-1.5 pl-10 pr-2 text-[13px] transition-colors",
                                    here
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
                        </motion.ol>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ol>
          </div>
        </nav>

        <div className="min-w-0 max-w-3xl overflow-x-clip">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.article
              key={chapter}
              custom={direction}
              variants={SLIDE}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              drag={swipe ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) go(chapter + 1);
                else if (info.offset.x > 80) go(chapter - 1);
              }}
            >
              <h2 className="flex items-baseline gap-3 text-headline-lg text-primary">
                <span className="font-mono text-[0.6em] text-[var(--fill-blue)]">{chapter + 1}</span>
                {current.title}
              </h2>
              {current.topics.map((topic, t) => (
                <div key={topic.id} id={anchor(chapter, t)} className="mt-8 scroll-mt-28">
                  <h3 className="flex items-baseline gap-3 text-headline-sm text-primary">
                    <a
                      href={`#${anchor(chapter, t)}`}
                      className="font-mono text-[0.75em] text-blueprint-muted hover:text-[var(--fill-blue)]"
                    >
                      {chapter + 1}.{t + 1}
                    </a>
                    {topic.title}
                  </h3>
                  {topic.body}
                </div>
              ))}
            </motion.article>
          </AnimatePresence>

          <nav aria-label="Chapters" className="mt-14 grid gap-3 sm:grid-cols-2">
            {previous ? (
              <button
                type="button"
                onClick={() => go(chapter - 1)}
                className="neu-btn group flex flex-col items-start gap-1 rounded-2xl border border-blueprint-line bg-card px-5 py-4 text-left"
                style={{ minHeight: 0 }}
              >
                <span className="flex items-center gap-1.5 text-technical-mono text-blueprint-muted">
                  <ArrowLeft size={13} aria-hidden className="transition-transform group-hover:-translate-x-0.5" /> Previous
                </span>
                <span className="text-body-md font-medium text-primary">
                  {chapter}. {previous.title}
                </span>
              </button>
            ) : (
              <span />
            )}
            {next ? (
              <button
                type="button"
                onClick={() => go(chapter + 1)}
                className="neu-btn group flex flex-col items-end gap-1 rounded-2xl border border-blueprint-line bg-card px-5 py-4 text-right"
                style={{ minHeight: 0 }}
              >
                <span className="flex items-center gap-1.5 text-technical-mono text-blueprint-muted">
                  Next <ArrowRight size={13} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="text-body-md font-medium text-primary">
                  {chapter + 2}. {next.title}
                </span>
              </button>
            ) : (
              <NavLink
                to="/problems"
                className="neu-btn flex flex-col items-end gap-1 rounded-2xl border border-blueprint-line bg-card px-5 py-4 text-right"
              >
                <span className="text-technical-mono text-blueprint-muted">Ready?</span>
                <span className="flex items-center gap-1.5 text-body-md font-medium text-primary">
                  Open a problem <ArrowRight size={14} aria-hidden />
                </span>
              </NavLink>
            )}
          </nav>

          <div className="mt-6 flex items-center justify-center gap-2" aria-hidden>
            {CHAPTERS.map((entry, c) => (
              <span
                key={entry.title}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  c === chapter ? "w-6 bg-[var(--fill-blue)]" : "w-1.5 bg-blueprint-line"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
