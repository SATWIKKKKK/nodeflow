/**
 * Company and legal pages. Every statement here is checked against the code:
 * how accounts are stored (backend/src/auth/store.ts), what Submit persists
 * (backend/src/execution/service.ts) and the sandbox flags
 * (backend/src/execution/dockerRunner.ts). Keep them in step when those change.
 */

export interface InfoSection {
  title: string;
  body?: string;
  points?: string[];
}

export interface InfoPageContent {
  path: string;
  eyebrow: string;
  title: string;
  lead: string;
  sections: InfoSection[];
  draft?: boolean;
}

export const INFO_PAGES: InfoPageContent[] = [
  {
    path: "/about",
    eyebrow: "About",
    title: "Reading an algorithm is not the same as watching it run.",
    lead: "Noesis is a practice workspace for students learning data structures. You write the code; Noesis shows you what that exact code did, one line at a time.",
    sections: [
      {
        title: "Why it exists",
        body: "Most visualizers play an animation someone scripted in advance. When your own solution breaks, that animation cannot show you where. Noesis runs your code for real, records every object at every line, and replays it, so the picture on screen is your program, bug included."
      },
      {
        title: "Who it is for",
        body: "Students meeting arrays and linked lists for the first time, who want to understand why a solution works or breaks rather than just clear problems quickly."
      },
      {
        title: "Where it stands",
        points: [
          "Python code is traced and visualized.",
          "C++ and Java run and are judged, without a visual trace yet.",
          "Arrays and singly linked lists make up most of the live problem bank."
        ]
      }
    ]
  },
  {
    path: "/roadmap",
    eyebrow: "Roadmap",
    title: "What ships now, and what comes next.",
    lead: "Noesis is being built in phases. Nothing below the first list has a committed date.",
    sections: [
      {
        title: "Live today",
        points: [
          "Python execution in an isolated sandbox, traced line by line.",
          "Array and singly linked list visualization with step-by-step playback.",
          "Run, Test and Submit, with a live preview while you type.",
          "Local accounts and a progress dashboard built from your submissions."
        ]
      },
      {
        title: "Planned",
        points: [
          "Trees, graphs, stacks, queues and recursion in the visualizer.",
          "Visual traces for C++ and Java.",
          "The full bank of 388 questions, each written and reviewed before it goes live.",
          "Hosted classrooms and shared progress."
        ]
      }
    ]
  },
  {
    path: "/contact",
    eyebrow: "Contact",
    title: "Get in touch.",
    lead: "Questions about the tracer, the problem bank or classroom access.",
    draft: true,
    sections: [
      {
        title: "Contact details are on the way",
        body: "A public contact channel has not been published yet. This page will list it as soon as it exists."
      }
    ]
  },
  {
    path: "/privacy",
    eyebrow: "Privacy",
    title: "What Noesis keeps.",
    lead: "Noesis runs local-first: everything below is stored on the machine that runs the Noesis server.",
    draft: true,
    sections: [
      {
        title: "Your account",
        points: [
          "Your email address.",
          "Your password, stored only as a salted scrypt hash.",
          "Session tokens, stored only as SHA-256 hashes."
        ]
      },
      {
        title: "Your code",
        points: [
          "Run, Test and live preview do not save your code.",
          "Submit saves a record of the attempt: your code, the verdict, the runtime and the time you submitted."
        ]
      },
      {
        title: "Password resets",
        body: "Reset requests are recorded locally. No email is sent yet."
      }
    ]
  },
  {
    path: "/terms",
    eyebrow: "Terms",
    title: "Terms of use.",
    lead: "The terms covering the Noesis workspace and problem bank.",
    draft: true,
    sections: [
      {
        title: "Being written",
        body: "Formal terms have not been published yet. They will appear here before any hosted or paid plan launches."
      }
    ]
  },
  {
    path: "/security",
    eyebrow: "Security",
    title: "Your code runs in a locked box.",
    lead: "Every run is treated as untrusted. Here is what the sandbox allows, and what it does not.",
    sections: [
      {
        title: "The sandbox",
        points: [
          "Each run gets a fresh Docker container that is removed when the run ends.",
          "No network access from inside the container.",
          "One CPU, a memory cap and a limit of 64 processes.",
          "A read-only filesystem, all Linux capabilities dropped, and no privilege escalation."
        ]
      },
      {
        title: "Runaway code",
        points: [
          "Each language has a wall-clock time limit.",
          "The tracer stops after 7,000 steps and reports a likely infinite loop.",
          "Runs wait in a bounded queue instead of starting unlimited containers."
        ]
      }
    ]
  }
];
