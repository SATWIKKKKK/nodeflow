# Noesis

Noesis is a local-first Python DSA workspace where user code is executed, traced, diffed, judged,
and visualized step by step.

## Useful Commands

- `npm run dev` - run the backend and frontend together.
- `npm run build` - type-check and build shared, backend, and frontend packages.
- `npm run smoke` - verify the core tracer/judge/sandbox loop.
- `npm run verify:auth` - verify local sign-up/sign-in/session/submission identity.
- `npm run verify:progress` - verify persisted submissions roll up into dashboard progress.
- `npm run verify:problems` - run every live reference solution through the judge.
- `npm run verify:queue` - force serialized sandbox runs and verify queue timing.
- `npm run verify:reviewed` - validate the reviewed Phase 1 JSON package.
- `npm run ingest:metadata` - extract Phase 1 `array` and `linked_list` metadata from `DSA.json`.
- `npm run ingest:drafts` - create review-only draft shells from unique Phase 1 metadata titles.

## Execution Modes

- `Run` executes once against default/custom input and replaces the manual trace.
- `Test` executes visible cases and keeps each visible result replayable with expected vs actual output.
- `Submit` executes the full case set, persists the verdict locally, and keeps hidden details sealed.
- `Live preview` debounces editor changes, traces the default input with a tighter execution budget, and
  keeps the last valid scene visible when the code is incomplete or temporarily invalid.

Sandbox executions run through a bounded queue so concurrent users do not spawn unbounded Docker
containers. Responses include optional `queuedMs` timing for UI feedback and diagnostics.

## Local Auth

The current auth layer is a local JSON-backed account/session system. It supports sign-up, sign-in,
sign-out, session lookup, reset-request recording, and authenticated submission persistence. Google
auth can replace the credential exchange later while keeping the same session-aware frontend flow.

## Progress Dashboard

`/dashboard` reads persisted Submit records for the current session and summarizes attempted
problems, accepted problems, Phase 1 completion, recent submissions, and array/list coverage. It is
kept as a one-viewport product screen, with longer recent/problem lists scrolling inside their
panels instead of stretching the page.

## Problem Bank Flow

`DSA.json` is treated as metadata only. The current file contains 384 entries, including 93 Phase 1
array/linked-list candidates. `npm run ingest:drafts` writes 91 unique review-only draft shells to
`backend/data/phase1-drafts.json`; duplicates in the source metadata are collapsed by title.

Live problems must be original Noesis problem packages, schema-validated, marked `reviewed`, and
verified before they are served in the workspace. Reviewed Phase 1 records live in
`backend/data/reviewed-phase1.json` and are loaded through the schema in
`backend/src/problems/reviewedPhase1.ts`. The live bank currently has 53 problems: 33 arrays and 20
singly linked-list problems, with 48 reviewed packages plus the 5 original seed problems. All live
reference solutions are verified by `npm run verify:problems`. Draft shells are labeled as
`needs_human_review` or `deferred_until_supported` so matrix, doubly linked-list, random-pointer,
cycle, stack/queue, heap, string-pattern, and aliasing-dependent prompts do not look publishable
before the tracer supports them.
