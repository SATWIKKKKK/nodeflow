# PROJECT: 3D/Visual Live-Execution DSA Learning Platform

## What this is
A web platform where a user writes real code to solve DSA problems (starting with arrays and linked lists), and as they write/run it, a 2.5D/3D visualization on the left side of the screen animates the underlying data structure changing step-by-step — nodes being created, pointers joining, nodes deleted, etc. — synced to actual code execution, not a pre-scripted animation.

This is a real product being built in phases, not a hackathon demo. Build Phase 1 fully and correctly before touching later phases. Do not skip the tracer/execution layer to fake the visualization with hardcoded animations — the whole point is that it reflects the user's actual code.

## Ingestion workflow for Striver's DSA sheet (434 questions) — the concrete pipeline
The sheet is a source of METADATA only (title, topic/category, difficulty, external link) — it is not a source of ready-to-use problem statements or test cases. Do not scrape/copy the linked LeetCode/GfG problem text verbatim (copyright risk, see sourcing section above). Follow this exact flow:

1. **Extract sheet metadata** into structured JSON: `[{ title, topic, difficulty, sourceLink }]` for all 434 entries (reuse pdfplumber-based extraction if working from a PDF export of the sheet).
2. **Filter to only the topics the visualizer currently supports** (`structureType: "array" | "linked_list"` for Phase 1) — this narrows 434 down to a much smaller working set (roughly 40-60). Do not attempt to ingest tree/graph/DP/stack/queue questions yet; they have no `structureType` support until later phases and should sit in the dataset tagged but unpublished/hidden from the UI until their phase unlocks.
3. **For each filtered question, generate a draft problem package** using the AI pipeline (title + topic + difficulty as input) producing: an original (not copied) problem statement in the platform's own words, starter code stub, and 3-5 test cases (input → expected output). This is a draft only.

   ### How the AI-generated problem statement step actually works (do not bulk-scrape)
   LeetCode/GfG problem text is copyrighted and belongs to those platforms — scraping it verbatim at scale is a ToS violation and a real legal risk once the platform has actual users, not a shortcut worth taking even though the sheet only has ~40-60 titles for Phase 1. Instead, generate original statements per title:

   - **Input to the generation call**: just the problem title (plus topic/difficulty if known) — e.g. `"Find Middle of Linked List"`, topic `linked_list`, difficulty `Easy`.
   - **What the LLM call produces**: an original problem description in the platform's own voice, a constraints section, 2+ example input/output pairs, a starter code stub, and a small set of test cases — all as one structured JSON object per problem, e.g. `{ description, constraints, examples, starterCode, testCases }`.
   - **Why this is legitimate**: classic DSA problems (reverse a linked list, find the middle node, two-sum, etc.) are well-known algorithmic *patterns*, not owned text — describing "find the middle node of a singly linked list" in your own words is not the same as copying LeetCode's specific phrasing, examples, or constraints block verbatim.
   - **This is a draft, not a publishable artifact** — LLM-generated test cases can be subtly wrong (off-by-one expected outputs, ambiguous edge cases), so nothing from this step goes live without the human review pass below.
   - **Recommended rollout**: hand-review the first 15-20 generated drafts before running the rest of the batch, to catch systemic issues with the prompt template (inconsistent tone, missing edge cases, malformed JSON) early rather than after generating all 40-60.
   - **Implementation shape**: a script that loops over the filtered `{title, topic, difficulty}` list, makes one AI API call per problem, and writes all drafts to a single JSON file for the review step to consume — one call per problem, not one call for the whole batch, so a single bad output doesn't block the rest and drafts can be regenerated individually if review rejects them.

4. **Human review pass is mandatory before publishing** — manually verify each AI-drafted problem statement makes sense and test cases are actually correct (e.g. by running a known-correct reference solution against them) before it's marked as published/live in the problem bank. Do not auto-publish AI-generated problem content unchecked.
5. **Run the reviewed batch through the `/backend/src/problems/ingest/` script** to load into the DB with correct `structureType` tagging.
6. As later phases unlock more structure types (trees, graphs, stacks/queues, DP), repeat steps 3-5 for the next topic batch from the same already-extracted 434-question metadata set — the metadata extraction (step 1) is a one-time job, the draft/review/ingest cycle (steps 3-5) repeats per phase/topic.

## Run / Test / Submit — detailed functional spec

There are three distinct user actions in the workspace. Do not conflate them — they have different backend paths and different UI feedback.

### "Run" (ad-hoc execution against user-provided or default input)
- User writes code, clicks Run. Code executes once against either (a) the default/sample input shown for the problem, or (b) custom input the user typed into an input panel.
- Backend: submit code + input to the sandboxed execution service → tracer produces the full step-by-step trace (as specced earlier) → return both the final stdout/return value AND the full trace array.
- Frontend: shows actual output/return value in an output panel, AND populates the 3D visualization + playback controls with the trace so the user can step through what just happened.
- Run does NOT check correctness against the problem's official test cases — it's exploratory, for the user to see their code work (or fail) on a specific input.
- Run should have a strict timeout (e.g. 5-10s) and clearly show "Time Limit Exceeded" rather than hanging, especially important since infinite loops are common with linked-list/array bugs (e.g. a broken `while` on a cycle).

### "Test" (run against the problem's visible/sample test cases only)
- Executes the code against 2-3 sample test cases that are shown to the user on the problem page (not the full hidden set).
- For each sample case: pass/fail, actual output vs expected output, and — importantly — the full trace is available per test case so the user can visualize *why* it failed (e.g. step through and see the linked list state diverge from what they expected at a specific line).
- This is the primary debugging loop — expect this to be clicked far more than Submit. Keep it fast; don't run it inside the exact same heavy path as Submit if Submit does extra bookkeeping (see below).

### "Submit" (full evaluation against all test cases + persistence)
- Executes against the FULL test case set for the problem (sample + hidden).
- Judging logic mirrors standard OJ (online judge) behavior: Accepted (all pass), Wrong Answer (output mismatch — show which case failed, but for hidden cases do not reveal the hidden input/expected output itself, only "failed on hidden case #4" to prevent trivial reverse-engineering), Time Limit Exceeded, Runtime Error (show the actual stack trace/error), Compile Error (Python syntax errors, shown clearly with line number).
- On Accepted: persist a `submissions` record (user_id, problem_id, code, verdict, runtime, timestamp) — this is what streaks/progress/mastery tracking (if built later) will read from. Do not persist code for every Run/Test click, only for Submit, to avoid bloating the DB with debugging noise.
- Rate-limit Submit per problem per user modestly (e.g. no more than 1 submission per few seconds) to prevent spam/abuse of the sandbox.
- After a Submit verdict, the full trace for the FIRST failing test case (if any) should still be visualizable — don't just show "Wrong Answer," let the user step through and see where their structure diverged, since visualization-driven debugging is this platform's whole differentiator over a plain OJ.

## Live line-by-line visualization while typing (not just on Run)

This is a distinct mode from the Run-based trace playback above, and is harder — build it AFTER Run/Test/Submit and step-based playback work correctly, since it depends on the same tracer but adds a live/incremental layer on top.

- As the user types, on a debounce (e.g. 400-600ms after the user stops typing — do not retrace on every keystroke, that's wasteful and will feel laggy), silently attempt to trace the current code state against the problem's default/sample input.
- If the code is currently syntactically invalid or incomplete (very likely mid-typing — e.g. user is halfway through a line), the trace attempt will fail. This is expected and normal, not an error state to surface loudly: on failure, simply keep showing the last successfully-traced visualization state rather than clearing the 3D scene or showing an error. The visualization should feel like it's "keeping up" with valid code, not flickering/erroring on every incomplete keystroke.
- Only re-run the live trace up to the point the user has typed (don't require a complete, runnable solution — trace as far as the interpreter can get, e.g. if they've only written the function signature and first two lines, show whatever partial state those two lines produce, using a default/sample input as the drive value).
- This live mode should be visually distinguished from the "stepped through a full Run" mode (e.g. a subtle "live preview" label) so the user understands it's a rolling preview, not a completed execution trace.
- This live/incremental mode is a genuinely non-trivial engineering problem (repeated re-tracing of partial code under a tight debounce, sandbox call overhead per keystroke-batch) — do not underestimate the cost of calling into the Docker-sandboxed execution service this frequently. Strongly consider a lighter-weight in-process trace path (still isolated/limited, but not a full fresh Docker container spin-up per debounce tick) specifically for this live mode, reserving the heavier full-Docker-isolation path for Run/Test/Submit where correctness/security matters most. Flag this architectural split explicitly rather than reusing the exact same sandbox call path for both.

## Visualization toggle + fullscreen mode
- Add a persistent control (e.g. an icon button in the workspace toolbar) that lets the user disable the 3D visualization panel entirely — when disabled, the code editor expands to fill the freed space. This should be a simple UI state toggle, not a page reload, and should persist per-user (remember their preference, e.g. in local user settings/localStorage) across sessions.
- Add a separate "fullscreen" control for the code editor specifically (distinct from disabling visualization) — expands the editor to the full viewport, hiding problem description/other panels, for users who want to focus purely on writing code. Use the browser Fullscreen API or a full-viewport CSS overlay, with a clearly visible exit control (don't rely solely on Esc key, some users won't know that).
- These two controls should be independent and combinable: user can (a) keep visualization + normal editor, (b) hide visualization + normal editor, (c) hide visualization + fullscreen editor. Ensure the layout logic handles all these states cleanly rather than only the default 50/50 split.

## Additional edge cases and considerations to design for (beyond what's been explicitly requested)
- **Infinite loops / runaway code**: enforce hard execution step limits inside the tracer itself (not just wall-clock timeout) — a user's buggy linked-list cycle can loop billions of times within a few seconds and either hang the sandbox or produce a trace array too large for the frontend to handle. Cap total trace steps (e.g. 5,000-10,000) and surface "execution limit reached, possible infinite loop" if hit.
- **Very large/deep structures**: if a user's test input produces a huge structure (e.g. array of 100,000 elements), do not attempt to 3D-visualize every element — define a reasonable visualization cap (e.g. show first/last N elements with a "... N more" indicator) so the 3D scene doesn't choke trying to render tens of thousands of meshes.
- **Multiple simultaneous data structures**: some problems involve more than one structure at once (e.g. two linked lists being merged). The trace/diff format and 3D scene need to support multiple named structures on screen simultaneously, not just a single primary one — design the scene layout for this from the start rather than retrofitting later.
- **Sandbox resource exhaustion under load**: many concurrent users running/submitting code means many concurrent Docker containers — set concurrency limits and a queue with reasonable feedback ("your code is queued for execution") rather than letting the execution service fall over under load.
- **Partial/invalid code during live mode edge case**: if the user pastes a large block of code at once (not gradual typing), the debounce should still apply cleanly — don't special-case paste vs type differently, treat both as "content changed, wait for the debounce, then attempt trace."
- **Distinguishing user error output from platform error output**: when a user's code raises an exception, that must be displayed clearly as "Your code errored: <exception>" — visually distinct from a platform-level failure (sandbox crashed, service timeout), so users don't confuse their own bug with a broken platform.
- **Accessibility fallback**: some users may be on low-end devices/browsers without solid WebGL support — the 3D visualization panel should detect this and gracefully fall back to a disabled state with a message, rather than crashing the page; Run/Test/Submit functionality must work independently of whether the 3D panel renders successfully.

## Design system
The visual design is defined in `DESIGN.md` at the repo root (tokens, type, surfaces, controls, layout and motion). Every page follows it, and `frontend/src/index.css` is the single token file. The earlier illustration-based references (statues, landmarks, cream and terracotta palette) are retired and no longer apply.

## Full project structure (end-to-end, not just the visualizer core)
This is a full product, not just a prototype page. Set up the repo with clear separation from the start:

```
/frontend
  /src
    /app or /pages        → landing, pricing, auth, dashboard, problem workspace routes
    /components
      /landing            → hero, feature grid, footer (per design system)
      /pricing             → pricing tier cards
      /auth                → login, signup, forgot-password forms
      /workspace           → code editor pane, 3D scene pane, playback controls
      /shared              → buttons, inputs, cards — all pulling from design tokens
    /lib                   → API client, trace-diff parsing helpers
    /three                 → React Three Fiber scene, mesh mapping logic
    /styles                → design tokens (colors, type, spacing)
/backend
  /src
    /auth                  → signup/login/session handling, password hashing, JWT or session tokens
    /execution              → sandboxed code execution + sys.settrace tracer service (Docker-isolated)
    /diff                   → state-diff computation between trace steps
    /problems                → problem bank CRUD, test-case runner/judge
    /billing                → pricing tier logic, payment provider integration (reuse Razorpay approach from RepoID if applicable)
    /db                     → schema/migrations (users, problems, test_cases, submissions, subscriptions)
  /docker
    /sandbox                 → Dockerfile for the isolated user-code execution container
/shared or /packages/types  → shared TypeScript types for trace steps, diffs, problem schema, used by both frontend and backend if applicable
```

Landing, pricing, and auth pages are real product surfaces here, not throwaway pages — build them against the provided design system with the same rigor as the core workspace, since this is meant to ship as a full product, not just a demo of the visualization feature.

## Sourcing the problem bank (all LeetCode-style questions)
Do not scrape or copy LeetCode's actual problem statements/text verbatim — that content belongs to LeetCode and reproducing it wholesale is a copyright/ToS problem for a product you intend to ship or monetize. Instead:
- Use an open, permissively-licensed problem dataset as the base — e.g. community-maintained open-source "LeetCode-style" problem sets on GitHub that are explicitly licensed for reuse (search for ones with an MIT/CC license before using anything), or well-known open algorithmic problem collections (e.g. from open courseware, Project Euler-style banks for math-heavy ones, or your own hand-authored set expanded over time), or — as detailed in the ingestion workflow above — AI-generated original statements per title from the Striver sheet metadata, followed by mandatory human review.
- Normalize whatever source you use into the platform's own schema (`{ id, title, description, difficulty, starterCode, testCases, structureType }`) — rewrite/paraphrase problem descriptions in your own words rather than importing them verbatim, both for legal safety and so difficulty/description tone stays consistent across the bank.
- Build an ingestion script (`/backend/src/problems/ingest/`) that takes a raw source (CSV/JSON/scraped-with-permission dataset) and maps it into the schema — this should be a repeatable pipeline, not a one-time manual copy-paste, since the bank will grow over time.
- Tag each problem by `structureType` (array/linked_list only for Phase 1) so the platform can filter to only what the visualizer currently supports — do not import tree/graph/DP problems yet, they'll sit unused until Phase 2 supports that structure type.
- Test cases must be verifiable programmatically (input → exact expected output) — skip or manually rewrite any problem where correctness isn't a clean input/output check (e.g. "design a class" problems need custom harnesses, deprioritize these for later).

## Phase 1 scope (build this first, nothing more)
- Language supported: Python only.
- Data structures supported: Arrays and Singly Linked Lists only. No trees, graphs, stacks, queues, or recursion visualization yet.
- Interaction model: user writes code in an editor, clicks "Run". Execution is traced step-by-step. User can step through the trace (Next / Prev / Play) rather than free-typing triggering live retrace on every keystroke. Do NOT build real-time-while-typing in Phase 1 — that's Phase 4.
- Output: a synchronized pair — (1) the code editor highlighting the current line, (2) a 3D scene showing the current state of the data structure, animated as a transition from the previous state.

## Architecture

### 1. Code execution & tracing (backend)
- Use a sandboxed, isolated execution environment for arbitrary user Python code — Docker container per execution, strict CPU/memory/time limits, no network access from inside the sandbox. Security is not optional; treat all user code as hostile.
- Inside the sandbox, instrument execution using Python's `sys.settrace` (or reuse/adapt the open-source Python Tutor tracing engine, OPT — Online Python Tutor — as a reference implementation) to capture, at every line execution:
  - current line number
  - full variable state (locals + relevant globals)
  - heap-allocated object states (list contents, linked list node objects with their `.val`/`.next` or equivalent attributes, identified by object id so we can detect node creation, mutation, and deletion)
- Produce a JSON array of "trace steps", where each step is a diff-friendly snapshot:
```json
{
  "steps": [
    {
      "line": 4,
      "event": "line",
      "variables": { "head": "obj_1", "n": 3 },
      "heap": {
        "obj_1": { "type": "ListNode", "val": 1, "next": "obj_2" },
        "obj_2": { "type": "ListNode", "val": 2, "next": null }
      }
    }
  ]
}
```
- The backend's only job for Phase 1: take submitted code + input, return this trace array (or an error if the code fails/times out). Keep this as a clean, isolated service — it should not know anything about 3D rendering.

### 2. State-diff layer
- Between consecutive trace steps, compute a diff: which heap objects were created, which were mutated (which fields changed), which were deleted/became unreachable, which variable bindings changed.
- This diff object is what the frontend animation layer consumes — it should never have to infer changes itself from raw state, the diff must be explicit: `{ created: [...], mutated: [...], deleted: [...], variablesChanged: {...} }`.

### 3. 3D visualization (frontend)
- Stack: React + React Three Fiber (Three.js). Keep it 2.5D for Phase 1 — flat-plane node/box representations, camera can orbit but geometry stays simple (boxes/spheres + connecting line/arrow meshes for pointers). Do not attempt complex custom 3D meshes in Phase 1.
- Each heap object (array cell / linked list node) maps to a persistent 3D mesh keyed by its object id from the trace. Reuse the same mesh across steps (don't destroy/recreate) so animations are smooth — animate position/opacity/color transitions when a diff says "created" (fade/scale in), "mutated" (highlight + value update), "deleted" (fade/scale out), "pointer changed" (animate the connecting line to the new target).
- Sync with code editor: use Monaco Editor (or CodeMirror) for the code pane, highlight the current line matching the active trace step index.
- Playback controls: Step Forward, Step Back, Play (auto-advance with adjustable speed), Reset.

### 4. Problem bank (build after 1–3 work end-to-end for at least one hand-written example)
- Simple schema: `{ id, title, description, difficulty, starterCode, testCases: [{input, expectedOutput}], structureType: "array" | "linked_list" }`
- Start with ~5 hand-authored problems (e.g., reverse a linked list, find middle of linked list, two-sum on array, remove duplicates from sorted array, merge two sorted linked lists) — enough to prove the visualization works across varied operations (creation, deletion, pointer rewiring, iteration).
- Test-case verification: run the trace, capture final return value, compare to `expectedOutput`. This is separate from the visualization — don't conflate "does the visualization look right" with "is the answer correct."

## Explicit non-goals for now (do not build unless told to)
- No trees, graphs, recursion call-stack visualization, stacks, queues — Phase 2.
- No AI-generated hints, AI code review, or AI question generation — Phase 3, and only after the problem bank + judging works with static hand-authored problems.
- No real-time-while-typing retrace — Phase 4.
- No support for languages other than Python.
- No user accounts, auth, payments, or multi-tenant concerns yet — build this as a single-user local-first prototype until the core loop (code → trace → diff → 3D animation) is proven end to end.

## Definition of done for Phase 1
A user can:
1. Open one of ~5 seeded problems with starter code.
2. Write/edit a correct Python solution (array or linked list based).
3. Click Run.
4. See the code execute with the current line highlighted, stepping through via controls.
5. See the 3D scene accurately animate node creation, pointer changes, and deletion in sync with each step, matching what their specific code actually does (verified by trying at least 2 different valid solutions to the same problem and confirming both visualize correctly, not just one hardcoded path).
6. See a pass/fail result against the problem's test cases after full execution.

Build in this order: sandboxed execution + tracer first (test it standalone with console-logged trace JSON before touching any frontend) → state-diff layer → editor + line highlighting → 3D scene + mesh mapping → playback controls → problem bank + test verification. Do not start the 3D layer until the tracer reliably produces correct trace JSON for at least 3 different hand-written linked-list scripts.
