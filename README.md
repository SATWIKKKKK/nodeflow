# Noesis

Noesis is a local-first DSA workspace where Python, C++ and Java code is executed, traced, diffed,
judged, and visualized step by step.

## Useful Commands

- `npm run dev` - run the backend and frontend together.
- `npm run build` - type-check and build shared, backend, and frontend packages.
- `npm run smoke` - verify the core tracer/judge/sandbox loop.
- `npm run verify:auth` - verify local sign-up/sign-in/session/submission identity.
- `npm run verify:progress` - verify persisted submissions roll up into dashboard progress.
- `npm run verify:problems` - run every live reference solution through the judge
  (`-- --file data/problems/<batch>.json`, `-- --id <id>`, or `-- --language cpp --solutions <file>`).
- `python backend/problem-src/build.py <batch>|all` - build problem batches from the authoring DSL.
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

`DSA.json` is treated as metadata only: 384 rows, of which 369 are problems and 15 are section
headings. Every one of the 369 problems is live, for 372 live problems in total (with 3 extra seeds).

Problems are written in `backend/problem-src/bNN_*.py` with the small DSL in `dsl.py`: an original
statement, a Python reference solution, hand-written examples (input, output) and hidden-test inputs.
`build.py` runs each reference through the same tracer harness the sandbox uses, fails if a written
example disagrees with the reference, fills in the hidden expected outputs, and writes
`backend/data/problems/<batch>.json`. `backend/src/problems/reviewedPhase1.ts` loads
`backend/data/reviewed-phase1.json` plus every batch file through the schema. After building, run
`npm run verify:problems -- --file data/problems/<batch>.json` to re-check the batch inside Docker;
a bare `npm run verify:problems` checks the whole bank. C++ and Java stubs are derived from each
problem's signature, including design-class problems (`{operations, arguments}` inputs).
