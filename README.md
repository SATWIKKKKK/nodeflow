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
- `npm run verify:starters --workspace backend` - compile every generated C++/Java starter and check it is judged.
- `npm run verify:queue` - force serialized sandbox runs and verify queue timing.
- `npm run build:vercel` - build the Vercel prebuilt output in `.vercel/output` (see Deployment).
- `npm run verify:reviewed` - validate the reviewed Phase 1 JSON package.
- `npm run ingest:metadata` - extract Phase 1 `array` and `linked_list` metadata from `DSA.json`.
- `npm run ingest:drafts` - create review-only draft shells from unique Phase 1 metadata titles.

## Execution Modes

- `Run` executes once against the default input (or the learner's custom input) and replays the trace.
  With custom input, the reference solution runs on the same input so the output can be checked.
- `Test` executes visible cases and keeps each visible result replayable with expected vs actual output.
- `Submit` executes the full case set, persists the verdict locally, and keeps hidden details sealed.
- `Live preview` traces the code as it is typed (default or custom input). One preview runs at a time and
  only the newest code waits behind it; a preview stops at its step budget, so an unfinished loop shows up
  in about a second. The last valid scene stays visible while the code is incomplete. Drafts, custom input
  and the last trace are kept in the browser, so a reload paints the scene immediately.

Sandbox executions run through a bounded queue so concurrent users do not spawn unbounded Docker
containers. Responses include optional `queuedMs` timing for UI feedback and diagnostics.

## Local Auth

The current auth layer is a local JSON-backed account/session system. It supports sign-up, sign-in,
sign-out, session lookup, reset-request recording, and authenticated submission persistence. Google
auth can replace the credential exchange later while keeping the same session-aware frontend flow.

## Classrooms

`/classrooms` lets a signed-in owner open a classroom, share its six-character join code, assign
problems, and watch a shared progress board built from Submit records (`backend/data/classrooms.json`).
Members see names (the part of the email before `@`); only the owner sees full emails and the join code.

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

## Configuration

The backend reads these environment variables (locally from `.env.local`, which
`vercel env pull` writes; on Vercel from the project settings):

| Variable | Meaning |
| --- | --- |
| `NOESIS_SANDBOX` | `docker` (default, local), `vercel` (Vercel Sandbox microVM), or `off` (no execution) |
| `NOESIS_SANDBOX_IMAGE` | Registry image for Vercel Sandbox, e.g. `noesis-runner:<tag>` |
| `DATABASE_URL` (or `DB_URL`, `POSTGRES_URL`) | Postgres for accounts, submissions and classrooms; without it, JSON files under `backend/data`. Neon's Vercel integration sets `DB_URL`. |
| `RESEND_API_KEY` | Sends password-reset emails; without it the reset link is only logged |
| `NOESIS_EMAIL_FROM` | Sender for those emails (default `Noesis <onboarding@resend.dev>`) |
| `NOESIS_APP_URL` | Base URL used in email links (defaults to the Vercel production URL, else localhost) |
| `NOESIS_ACCOUNTS` | `off` disables sign-up/sign-in (set automatically when there is no database) |

## Execution backends

Code always runs in a disposable Linux sandbox with no network:

- **Docker** (local default): one container per run, built from `backend/docker/*`.
- **Vercel Sandbox** (`NOESIS_SANDBOX=vercel`): one warm Firecracker microVM shared by
  all runs, booted from the image in `backend/docker/vercel/Dockerfile`, which carries all
  three harnesses. Each run gets a throwaway Linux user and directory, and every process is
  killed afterwards. Publish the image with:

      node scripts/push-sandbox-image.mjs          # builds, pushes, prints the tag
      npm run verify:sandbox --workspace backend   # runs one Run + Test per language

## Deployment

    npm run build:vercel && vercel deploy --prebuilt --prod

`scripts/build-vercel.mjs` writes `.vercel/output`: the static site plus one Node function
serving `/api`. Only public problem data is copied in, never the local account or submission
files. On Vercel the function runs with `NOESIS_SANDBOX=vercel`, so Run, Test, Submit and the
live trace work there; accounts need `DATABASE_URL`, and the UI says plainly when either is
missing.
