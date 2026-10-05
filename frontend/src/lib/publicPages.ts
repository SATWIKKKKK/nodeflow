/**
 * The pages anyone may read, and what each says in a search result.
 *
 * Plain data with no imports, so the Vite config can read it too: the sitemap
 * and the build-time prerender use exactly this list, and a public page added
 * here is listed, prerendered and given its own title in one place.
 */

export const DEFAULT_TITLE = "Noesis — See your DSA code run, line by line";
export const DEFAULT_DESCRIPTION =
  "Noesis runs your Python, C++ or Java in a sandbox and replays every pointer, array and tree your code touched. 372 data structures and algorithms problems, free.";

export interface PageMeta {
  title: string;
  description: string;
  /** Pages behind sign-in, and the sign-in pages themselves, stay out of search. */
  noindex?: boolean;
}

/**
 * What each public page says in a search result. Written per page, for that
 * page's job, never one blurb repeated everywhere.
 */
export const PUBLIC_META: Record<string, PageMeta> = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  "/how-it-works": {
    title: "How Noesis works — write, run, trace, replay | Noesis",
    description:
      "Pick a DSA problem, write a solution in Python, C++ or Java, and step through a replay of exactly what your code did to every list, tree and array."
  },
  "/tracing": {
    title: "How the tracer works — real execution, not animations | Noesis",
    description:
      "Noesis runs your code in an isolated sandbox, records the heap at every line, and draws only what changed. See how a DSA visualizer can show your own bug."
  },
  "/about": {
    title: "About Noesis — a DSA practice workspace that shows your code run",
    description:
      "Noesis is a free practice workspace for students learning data structures and algorithms: write the code, then watch that exact code execute step by step."
  },
  "/contact": {
    title: "Contact Noesis",
    description: "Questions about the tracer, the problem bank or classrooms? Email or call the person who builds Noesis."
  },
  "/privacy": {
    title: "Privacy — what Noesis keeps | Noesis",
    description: "What Noesis stores about your account, your code and your submissions, and what it never keeps."
  },
  "/terms": {
    title: "Terms of use | Noesis",
    description: "The terms covering the Noesis workspace and problem bank."
  },
  "/security": {
    title: "Security — how Noesis runs untrusted code | Noesis",
    description:
      "Every run is isolated: no network, one CPU, a memory cap, a time limit and a read-only filesystem. How Noesis keeps your code and everyone else's apart."
  }
};

export const PUBLIC_PATHS = Object.keys(PUBLIC_META);
