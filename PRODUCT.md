# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Students learning data structures and algorithms, typically CS students meeting arrays and linked
lists for the first time in coursework. They open the product to understand *why* an algorithm
works or breaks, not to clear problems at volume. Building intuition matters more to them than
throughput.

Instructors and teams appear only as future pricing tiers ("Classroom", "Team Lab"). They are not a
confirmed audience yet.

## Product Purpose

Noesis is a practice workspace where the learner writes real code for a DSA problem and watches
that code execute: each line is traced, the heap is diffed between steps, and a 3D view of the data
structure changes in sync with the highlighted line. The learner can step forward and back, replay a
failed test case, and see exactly where their structure diverged from what they expected.

Success means a learner can take a problem they got wrong, replay their own run, and point at the
line where it went wrong.

## Positioning

Most DSA visualizers play canned or hand-scripted animations. Noesis animates only what the
learner's own code actually did: the sandbox runs it, a tracer records every heap object at every
line, and the scene is driven purely by explicit diffs between those steps. Two different correct
solutions to the same problem produce two different visualizations. Debugging through the
visualization is the differentiator over a plain online judge.

## Operating Context

- Core loop inside the workspace: pick a problem → write code → **Run** / **Test** / **Submit** →
  step through the trace with playback controls (next, previous, play with speed, reset).
- **Run** executes once against the problem's default input and replaces the trace; it does not judge.
  (Custom input is specified in `SKIILS.md` but not built in the workspace yet.)
- **Test** runs the visible sample cases and lists each result with expected vs actual output.
  This is the main debugging loop and is used far more than Submit.
- **Submit** runs the full case set (visible + hidden), persists the verdict, and never reveals hidden
  inputs or expected outputs (only "failed on hidden case #N").
- **Live preview** retraces the default input on a debounce while typing, and keeps the last valid
  scene visible while code is mid-edit.
- The workspace shows a 2D trace by default (the same diagram style as the landing-page replay:
  arrays, lists, stacks, queues, trees, graphs, grids, maps, call stack). The older 3D scene is one
  toggle away. A fullscreen editor is specified in `SKIILS.md` but not built yet. The problem
  statement panel can be collapsed.
- Supporting surfaces: problem list with difficulty/status filters, problem map, progress dashboard
  built from Submit records, sign-in/sign-up/reset, pricing, and "how it works"/tracing explainers.

## Capabilities and Constraints

- **Name:** Noesis. The website uses it everywhere. Internal package names (`nodeflow-frontend`,
  `@nodeflow/shared`) still say "nodeflow".
- **Languages:** Python, C++ and Java are all traced and visualized (Python via `sys.settrace`,
  C++ under gdb, Java through JDI) and all judged against the same cases.
- **Structures:** arrays, strings, matrices/grids, singly/doubly/random/multilevel/cyclic linked
  lists, stacks, queues, hash maps, trees and BSTs, heaps, graphs, tries (as the objects the code
  builds), design classes, and the recursion call stack.
- **Problem bank:** 372 live problems as of 2026-09-17, covering all 369 problem rows of `DSA.json`
  (its other 15 rows are section headings) plus 3 extra seeds. Every reference solution passes all
  its cases in the Python sandbox; hidden-case outputs are generated from those references, and the
  hand-written examples are checked against them. C++ and Java harnesses were spot-checked with
  hand-written solutions across every value kind. Statements are original Noesis writing, never
  copied from LeetCode, GfG or other sites. Authoring lives in `backend/problem-src/` (Python DSL,
  `build.py`), output in `backend/data/problems/`.
- **Bank size:** the owner's earlier target was 388 questions; the sheet in `DSA.json` actually
  holds 369 problems, and all of them are live. The site reads counts from the API.
- **Verdicts:** Accepted, Wrong Answer, Time Limit Exceeded, Runtime Error, Compile Error. The learner's
  own exceptions must read as "your code errored", clearly distinct from platform failures (sandbox
  crash, service timeout).
- **Execution limits:** Docker-isolated sandbox with CPU/memory/time limits and no network; a cap on
  trace steps that surfaces "possible infinite loop"; a bounded execution queue that reports queue time;
  large structures are truncated in the scene rather than rendered in full.
- **Accounts:** local JSON-backed email/password accounts and sessions. Password-reset requests are
  only recorded locally; no email is sent yet. Google sign-in may replace this later.
- **Pricing:** only a free tier exists. The paid tiers and their prices are undecided; payment
  integration does not exist yet.
- **Roadmap:** Phase 1 (arrays, lists, Python) shipped; Phase 2 (the whole sheet, all structures,
  C++/Java traces) is current; custom input, AI hints and review, and hosted classrooms come later.
  None of these has dates.
- **Terminology:** trace, step, heap, diff, scene, structure type, Run / Test / Submit, live preview,
  phase.

## Brand Commitments

- Name: **Noesis**.
- No affiliation with TUF+, takeUforward or Striver. Their names must not appear in the product,
  navigation or copy.
- Voice: specific and proof-first. Copy should describe code that actually runs and actually
  animates ("see your pointer break"), never generic dev-tool or SaaS filler. Every page gets a
  headline written for its own job; a headline that could sit on another product's page gets
  rewritten.
- The visual design follows `DESIGN.md` (the monochrome "blueprint" system: serif headlines,
  Geist UI text, pill buttons, faint grid, light and dark themes). The whole site was rebuilt on it
  on 2026-09-16.
- The earlier visual brief is **retired**: the statue and landmark illustrations, the cream and
  terracotta palette, and every image asset were removed from the site. Do not reintroduce them.

## Evidence on Hand

- Working product: the tracer, judge, sandbox queue, auth, progress dashboard and 55 verified problems,
  with verification scripts (`npm run smoke`, `verify:problems`, `verify:progress`, `verify:auth`,
  `verify:queue`, `verify:ui`).
- A real recorded trace of `reverse_list` on `[1, 2, 3, 4]`
  (`frontend/src/landing/reverseListTrace.json`), produced by the Noesis tracer and used as the
  landing page demo.
- The site ships no illustrations or photographs.
- There are no users, testimonials, usage metrics, press, partnerships, customer logos or benchmarks.
  Future work must not invent any of them.

## Product Principles

1. **Show the real run.** Every animation comes from a trace of the learner's actual code; nothing is
   staged, scripted or faked.
2. **Intuition before volume.** Help the learner see *why* something failed, not just the verdict.
   A failed case should always be replayable.
3. **Claim only what ships.** Counts, structures, languages and partners must match what is live.
   Planned work is labelled as planned.
4. **The code stays in charge.** The editor is the centre of the workspace. The visualization is
   optional, and Run/Test/Submit must work without it.
5. **Your bug, not ours.** A learner's error and a platform failure must never look alike.

## Accessibility & Inclusion

- Learners may be on low-end devices without reliable WebGL. The 3D view must detect this and fall
  back to a disabled state with a message, and Run/Test/Submit must work regardless.
- No formal conformance standard has been set yet.
