import { BADGES_ENABLED, GAME_REWARD, SOLVE_REWARD } from "@nodeflow/shared";
import { problems } from "../problems/seeds.js";

/**
 * What the "Ask me anything" assistant knows about Noesis, and nothing else.
 *
 * The model is told to answer only from this sheet, so every fact here must be
 * true of what ships (PRODUCT.md, "Claim only what ships"). Bank counts are read
 * from the live problem list rather than written in, so they cannot go stale.
 */

const bankFacts = () => {
  const byTopic = new Map<string, number>();
  const byDifficulty = new Map<string, number>();
  for (const problem of problems) {
    byTopic.set(problem.topic, (byTopic.get(problem.topic) ?? 0) + 1);
    byDifficulty.set(problem.difficulty, (byDifficulty.get(problem.difficulty) ?? 0) + 1);
  }
  const topics = [...byTopic.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => `${topic} (${count})`)
    .join(", ");
  const difficulties = ["Easy", "Medium", "Hard"]
    .map((level) => `${byDifficulty.get(level) ?? 0} ${level}`)
    .join(", ");
  return [
    `PROBLEM BANK: ${problems.length} live problems across ${byTopic.size} topics; ${difficulties}.`,
    `Topics with problem counts: ${topics}.`,
    "Statements are original Noesis writing. Every problem has visible example cases and hidden cases."
  ].join("\n");
};

const SHEET = `
WHAT NOESIS IS: a free practice workspace for data structures and algorithms. You write real code for a problem, Noesis runs it in a sandbox, records every variable and heap object at every line, and replays your own run as a diagram you can step through. Nothing is pre-animated: two different solutions produce two different replays. The point is to see the exact line where a solution went wrong.

LANGUAGES: Python, C++, Java, JavaScript, TypeScript and C. All six run in the sandbox, are judged against the same cases and produce the same step-by-step trace. C uses LeetCode's conventions (an array comes with its length; a returned array sets *returnSize).

STRUCTURES THE TRACE DRAWS: arrays, strings, grids/matrices, linked lists (singly, doubly, cyclic, with random or child pointers), stacks, queues, hash maps, trees and BSTs, heaps, graphs, tries, and the recursion call stack. Recursion is supported: each call is shown on the call stack. Very large structures are truncated in the drawing rather than rendered in full.

THE WORKSPACE: a problem statement, a code editor (can go fullscreen; code can be reset to the starter), a 2D trace view with a 3D view one toggle away, and an output panel.
- Run: executes once on the case selected in the Testcase tab and replays the trace. It does not judge; the expected answer (from the reference solution) is shown beside yours.
- Test: runs every case in the Testcase tab (the problem's visible cases, edited or not, plus any you added) and shows expected versus actual output for each.
- Submit: judges like LeetCode: the visible cases, the hand-written hidden ones, then a stress suite of about a hundred generated cases per problem, then your own cases. It stops at the first failure and shows how many of the total passed. A failing hand-written hidden case stays sealed; a failing stress case is shown in full and can be added to your cases with one click.
- Verdicts: Accepted, Wrong Answer, Time Limit Exceeded, Runtime Error, Compile Error. An error in your code is reported separately from a platform problem.
- Live preview: the trace updates as you type and keeps the last good picture while the code is mid-edit.
- Playback: step forward and back, play at 0.5x, 1x, 2x or 4x, reset, scrub the timeline, zoom the drawing. Clicking a node jumps to the line that changed it.
- Step limit: a run stops after 4,000 traced steps in Python, 3,000 in JavaScript or TypeScript, or 1,500 in C, C++ and Java, and reports a likely infinite loop, so a runaway loop never hangs.
- Test cases: in the Testcase tab, "Edit cases" (or clicking a value) edits a case's inputs in place as JSON, and + adds a case of your own (a copy of the one on screen). Up to ten cases. The live preview traces the selected case.

SAFETY: every run gets its own isolated sandbox with no network access, one CPU, a memory cap, a time limit, a read-only filesystem and no extra privileges; it is deleted when the run ends. Runs wait in a bounded queue instead of starting unlimited sandboxes.

ACCOUNTS: a free account (email and password) is needed for the problem bank, the workspace, Run, Test, Submit, progress, classrooms and pricing. The landing page, how it works, the tracing explainer, about, contact, privacy, terms and security pages are open to everyone. An account (email and password) keeps your submissions, solved problems and progress under your name. Passwords are stored only as salted scrypt hashes; session tokens only as hashes. Password reset sends a one-time link that expires in an hour. Google sign-in is planned, not available.

YOUR PROGRESS: a dashboard built from your submissions: a ring of problems solved by difficulty (Easy, Medium, Hard) with acceptance rate, submission count and share of the bank completed; a year-long submission heatmap with active days, longest streak and current streak (any earlier year can be picked); coverage by structure; and recent submissions. Also a problem map showing coverage per topic, and "Continue solving", which keeps every problem you opened but have not solved, with your code exactly as you left it.${BADGES_ENABLED ? `

BADGES: worked out from your submissions and coins. Tiered bronze, silver, gold, platinum: Solver (problems solved), Climber (Medium), Summit (Hard), a badge per topic (a quarter, half, then all of its problems), Streak (days in a row), Regular (active days), Clean Sheet (solved on the first submission), Comeback (solved after three or more failed submissions), Sharpshooter (acceptance rate over enough submissions), Polyglot (languages accepted), Collector (coins earned). One-step badges: First Accepted, and one for every month with submissions on 20 different days. Each tier pays coins once: 10, 25, 50, 100 from bronze to platinum, 50 for a month.` : ""}

COINS: Noesis coins are earned ${BADGES_ENABLED ? "three ways. Each badge tier pays once (see BADGES)." : "two ways."} The first time a problem is accepted it pays by difficulty: ${SOLVE_REWARD.Easy} for Easy, ${SOLVE_REWARD.Medium} for Medium, ${SOLVE_REWARD.Hard} for Hard (solving it again pays nothing). While a run is waiting, a small game pays ${GAME_REWARD.right} for a right pick and takes ${Math.abs(GAME_REWARD.wrong)} for a wrong one. The wallet shows where your coins came from.

CLASSROOMS: anyone signed in can open a classroom and becomes its owner. The owner gets a six-character join code, assigns problems and sees a shared progress board built from real Submit results. Students join with the code. Both teachers and students need an account.

FINDING PROBLEMS: the Problems page filters by title, topic, difficulty and (when signed in) status, and the problem map groups the bank by topic.

CONTACT: Satwik Chandra builds Noesis. Email satwikchandra65@gmail.com (best, answered first) or phone +91-9064226986. The Contact page lists both.

PRICING: everything is free today, classrooms included. Paid plans for larger courses and teams are planned; their prices and dates are not decided, and there is no payment system yet.

ROADMAP (planned, no dates): paid plans with reserved sandbox capacity, private problem banks for teams, AI hints, Google sign-in.

NOT AVAILABLE: no mobile app, no other languages beyond Python, C++, Java, JavaScript, TypeScript and C, no contests or leaderboards, no public user profiles, no AI hints yet. Noesis has no affiliation with any other DSA course or platform.
`.trim();

export const noesisKnowledge = () => `${SHEET}\n\n${bankFacts()}`;
