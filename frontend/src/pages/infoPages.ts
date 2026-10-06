/**
 * Company and legal pages. Every statement here is checked against the code:
 * how accounts are stored (backend/src/auth/store.ts), what Submit persists
 * (backend/src/execution/service.ts) and the sandbox flags
 * (backend/src/execution/dockerRunner.ts). Keep them in step when those change.
 */

export interface InfoLink {
  kind: "email" | "phone";
  label: string;
  /** What is shown, e.g. the address or the number. */
  value: string;
  href: string;
}

export interface InfoSection {
  title: string;
  body?: string;
  points?: string[];
  links?: InfoLink[];
}

export const CONTACT_EMAIL = "satwikchandra65@gmail.com";
export const CONTACT_PHONE = "+91-9064226986";

export interface InfoPageContent {
  path: string;
  title: string;
  lead: string;
  sections: InfoSection[];
  draft?: boolean;
}

export const INFO_PAGES: InfoPageContent[] = [
  {
    path: "/about",
    title: "About Noesis",
    lead: "Noesis is a place to practise data structures and algorithms. You write the code, and Noesis shows you what that exact code did, one line at a time.",
    sections: [
      {
        title: "Why it exists",
        body: "Most visualizers play an animation someone scripted in advance. When your own solution breaks, that animation cannot show you where. Noesis runs your code for real, records every object at every line, and replays it, so the picture on screen is your program, bug included."
      },
      {
        title: "Who it is for",
        body: "Students working through data structures and algorithms, who want to understand why a solution works or breaks rather than just clear problems quickly."
      },
      {
        title: "Where it stands",
        points: [
          "Python, C++ and Java code is traced and visualized.",
          "Every problem on the DSA sheet is available, each checked against a working solution.",
          "The trace draws arrays, linked lists, stacks, queues, trees, graphs, grids and maps."
        ]
      }
    ]
  },
  {
    path: "/roadmap",
    title: "Roadmap",
    lead: "What is available today, and what is planned. Planned items do not have dates yet.",
    sections: [
      {
        title: "Live today",
        points: [
          "Python, C++ and Java, traced line by line.",
          "Step-by-step playback for arrays, lists, stacks, queues, trees, graphs, grids and maps.",
          "The full DSA sheet, from basic maths to tries.",
          "Run, Test and Submit, with a live preview while you type.",
          "Custom input for your own test cases, checked against the reference solution.",
          "Classrooms with join codes, assignments and a shared progress board.",
          "Accounts and a progress dashboard built from your submissions."
        ]
      },
      {
        title: "Planned",
        points: [
          "Paid plans for larger courses.",
          "Private problem sets for teams.",
          "Sign-in with Google."
        ]
      }
    ]
  },
  {
    path: "/contact",
    title: "Contact",
    lead: "Questions about Noesis, classroom access, or something that is not working? Email or call, and you will hear back from the person who builds it.",
    sections: [
      {
        title: "Reach Satwik Chandra",
        body: "Email is best for anything with code or a screenshot attached; it is answered first.",
        links: [
          { kind: "email", label: "Email", value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
          { kind: "phone", label: "Phone", value: CONTACT_PHONE, href: "tel:+919064226986" }
        ]
      },
      {
        title: "When something breaks",
        points: [
          "Say which problem, which language, and whether it was Run, Test or Submit.",
          "Paste the code, or the message from the output panel.",
          "A screenshot of the trace helps when the drawing looks wrong."
        ]
      }
    ]
  },
  {
    path: "/privacy",
    title: "Privacy",
    lead: "What Noesis stores about you, and why. It is kept in Noesis's own database and is never sold or shared.",
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
          "Run, Test and live preview do not save a record of your code.",
          "Code you leave unfinished is saved as a draft so you can continue later.",
          "Submit saves a record of the attempt: your code, the result, how long it took and when you submitted."
        ]
      },
      {
        title: "Password resets",
        body: "If you ask to reset your password, we email you a one-time link that expires after an hour. Your email address is used for nothing else."
      }
    ]
  },
  {
    path: "/terms",
    title: "Terms of use",
    lead: "The terms covering your use of Noesis.",
    draft: true,
    sections: [
      {
        title: "Being written",
        body: "Formal terms have not been published yet. They will appear here before any paid plan launches."
      }
    ]
  },
  {
    path: "/security",
    title: "Security",
    lead: "How Noesis keeps your code, and everyone else's, safely apart.",
    sections: [
      {
        title: "Running your code",
        points: [
          "Every run happens in its own isolated environment, discarded when the run ends.",
          "Code cannot reach the internet while it runs.",
          "Each run has strict limits on processor time and memory.",
          "One person's code can never read another's."
        ]
      },
      {
        title: "Runaway code",
        points: [
          "Each language has a wall-clock time limit.",
          "A run stops after 4,000 steps in Python or 1,500 in C++ and Java, and reports a likely infinite loop.",
          "Your password is stored only as a salted hash, never as the password itself."
        ]
      }
    ]
  }
];
