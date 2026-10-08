import fs from "node:fs";
import path from "node:path";
import {
  BADGES_ENABLED,
  STRUCTURE_TYPES,
  type StructureType,
  type AuthUser,
  type Difficulty,
  type JudgeVerdict,
  type ProgressProblemSummary,
  type ProgressSummary,
  type SubmissionSummary
} from "@nodeflow/shared";
import { problems } from "../problems/seeds.js";
import { ensureSchema, sql } from "../store/db.js";
import { dataDir } from "../paths.js";
import { computeBadges } from "./badges.js";
import { coinEventsFor } from "./coins.js";

export interface StoredSubmission {
  submissionId: string;
  userId?: string;
  problemId: string;
  code?: string;
  verdict: JudgeVerdict;
  runtimeMs: number;
  timestamp: string;
  language?: string;
}

const submissionsPath = path.join(dataDir, "submissions.json");

const readSubmissionFile = (): StoredSubmission[] => {
  if (!fs.existsSync(submissionsPath)) return [];

  try {
    const parsed = JSON.parse(fs.readFileSync(submissionsPath, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredSubmission[]) : [];
  } catch {
    return [];
  }
};

interface SubmissionRow {
  id: string;
  user_id: string;
  problem_id: string;
  verdict: JudgeVerdict;
  runtime_ms: number;
  created_at: string | Date;
  language?: string;
}

const fromRow = (row: SubmissionRow): StoredSubmission => ({
  submissionId: row.id,
  userId: row.user_id,
  problemId: row.problem_id,
  verdict: row.verdict,
  runtimeMs: row.runtime_ms,
  timestamp: new Date(row.created_at).toISOString(),
  language: row.language
});

/**
 * The code of a learner's most recent submission of a problem in a language,
 * for "bring back my last submission" in the editor.
 */
export const latestSubmission = async (userId: string, problemId: string, language: string) => {
  if (sql) {
    await ensureSchema();
    const rows = (await sql`select code, verdict, created_at from noesis_submissions
      where user_id = ${userId} and problem_id = ${problemId} and language = ${language}
      order by created_at desc limit 1`) as Array<{ code: string; verdict: JudgeVerdict; created_at: string | Date }>;
    const row = rows[0];
    return row ? { code: row.code, verdict: row.verdict, submittedAt: new Date(row.created_at).toISOString() } : null;
  }
  const mine = readSubmissionFile()
    .filter(
      (entry) =>
        (entry.userId ?? "local") === userId &&
        entry.problemId === problemId &&
        ((entry as StoredSubmission & { language?: string }).language ?? "python") === language &&
        entry.code
    )
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const last = mine[0];
  return last ? { code: last.code!, verdict: last.verdict, submittedAt: last.timestamp } : null;
};

/** Submissions for the given users (all users when omitted), oldest first. Code is not loaded. */
export const readSubmissions = async (userIds?: string[]): Promise<StoredSubmission[]> => {
  if (sql) {
    await ensureSchema();
    const rows = (
      userIds
        ? await sql`select id, user_id, problem_id, language, verdict, runtime_ms, created_at from noesis_submissions
            where user_id = any(${userIds}) order by created_at`
        : await sql`select id, user_id, problem_id, language, verdict, runtime_ms, created_at from noesis_submissions order by created_at`
    ) as SubmissionRow[];
    return rows.map(fromRow);
  }
  const all = readSubmissionFile();
  if (!userIds) return all;
  const wanted = new Set(userIds);
  return all.filter((submission) => wanted.has(submission.userId ?? "local"));
};

export const recordSubmission = async (record: StoredSubmission & { language: string; code: string }) => {
  if (sql) {
    await ensureSchema();
    await sql`insert into noesis_submissions (id, user_id, problem_id, language, code, verdict, runtime_ms, created_at)
      values (${record.submissionId}, ${record.userId ?? "local"}, ${record.problemId}, ${record.language},
              ${record.code}, ${record.verdict}, ${record.runtimeMs}, ${record.timestamp})
      on conflict (id) do nothing`;
    return;
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const existing = readSubmissionFile();
  existing.push(record);
  fs.writeFileSync(submissionsPath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
};

/**
 * "YYYY-MM-DD" for a moment, in the learner's time zone, so the calendar's
 * days start at their midnight. An unknown zone falls back to UTC.
 */
export const dayKeyer = (timeZone?: string) => {
  const options = { year: "numeric", month: "2-digit", day: "2-digit" } as const;
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: timeZone || "UTC" });
  } catch {
    format = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "UTC" });
  }
  return (moment: string | Date) => format.format(typeof moment === "string" ? new Date(moment) : moment);
};

/** The badge picture for a learner, from their full history. */
export const badgesFor = async (userId: string, submissions: StoredSubmission[], timeZone?: string) => {
  const dayOf = dayKeyer(timeZone);
  const coinEvents = await coinEventsFor(userId).catch(() => []);
  return computeBadges({
    // Replayed oldest first; the JSON store keeps insertion order, not time order.
    submissions: [...submissions].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)),
    problems,
    // Badge coins do not count towards Collector, or badges would feed themselves.
    coinEvents: coinEvents.filter((event) => event.source !== "badge"),
    dayOf,
    today: dayOf(new Date())
  });
};

export const progressForUser = async (user: AuthUser | null, timeZone?: string): Promise<ProgressSummary> => {
  // Without an account there is no history. Submissions from before sign-in
  // existed were all filed under "local"; they belong to no one, and must never
  // turn up on a visitor's (or a new learner's) dashboard.
  const userId = user?.id ?? "guest";
  const submissions = user
    ? (await readSubmissions([user.id]))
        .filter((submission) => submission.userId === user.id)
        .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
    : [];

  const problemById = new Map(problems.map((problem) => [problem.id, problem]));
  const problemSummaries: ProgressProblemSummary[] = problems.map((problem) => {
    const attempts = submissions.filter((submission) => submission.problemId === problem.id);
    const acceptedAttempts = attempts.filter((submission) => submission.verdict === "Accepted");
    const last = attempts.at(-1);
    const bestRuntimeMs = acceptedAttempts.length
      ? Math.min(...acceptedAttempts.map((submission) => submission.runtimeMs))
      : undefined;

    return {
      id: problem.id,
      title: problem.title,
      topic: problem.topic,
      difficulty: problem.difficulty,
      structureType: problem.structureType,
      attempts: attempts.length,
      accepted: acceptedAttempts.length > 0,
      lastVerdict: last?.verdict,
      lastSubmittedAt: last?.timestamp,
      bestRuntimeMs
    };
  });

  const recentSubmissions: SubmissionSummary[] = submissions
    .slice(-8)
    .reverse()
    .map((submission) => {
      const problem = problemById.get(submission.problemId);
      return {
        submissionId: submission.submissionId,
        userId,
        problemId: submission.problemId,
        problemTitle: problem?.title ?? submission.problemId,
        structureType: problem?.structureType ?? "array",
        verdict: submission.verdict,
        runtimeMs: submission.runtimeMs,
        timestamp: submission.timestamp
      };
    });

  const solvedIds = new Set(problemSummaries.filter((problem) => problem.accepted).map((problem) => problem.id));
  const byDifficulty = Object.fromEntries(
    (["Easy", "Medium", "Hard"] as Difficulty[]).map((difficulty) => [
      difficulty,
      {
        total: problems.filter((problem) => problem.difficulty === difficulty).length,
        solved: problems.filter((problem) => problem.difficulty === difficulty && solvedIds.has(problem.id)).length
      }
    ])
  ) as Record<Difficulty, { solved: number; total: number }>;
  const dayOf = dayKeyer(timeZone);
  const calendar: Record<string, number> = {};
  for (const submission of submissions) {
    const day = dayOf(submission.timestamp);
    calendar[day] = (calendar[day] ?? 0) + 1;
  }

  return {
    userId,
    userEmail: user?.email,
    byDifficulty,
    submissionCount: submissions.length,
    acceptedCount: submissions.filter((submission) => submission.verdict === "Accepted").length,
    calendar,
    badges: BADGES_ENABLED && user ? await badgesFor(userId, submissions, timeZone) : undefined,
    totalProblems: problems.length,
    totalArrays: problems.filter((problem) => problem.structureType === "array").length,
    totalLinkedLists: problems.filter((problem) => problem.structureType === "linked_list").length,
    totalStacks: problems.filter((problem) => problem.structureType === "stack").length,
    totalQueues: problems.filter((problem) => problem.structureType === "queue").length,
    attempted: problemSummaries.filter((problem) => problem.attempts > 0).length,
    accepted: problemSummaries.filter((problem) => problem.accepted).length,
    acceptedArrays: problemSummaries.filter(
      (problem) => problem.structureType === "array" && problem.accepted
    ).length,
    acceptedLinkedLists: problemSummaries.filter(
      (problem) => problem.structureType === "linked_list" && problem.accepted
    ).length,
    acceptedStacks: problemSummaries.filter(
      (problem) => problem.structureType === "stack" && problem.accepted
    ).length,
    acceptedQueues: problemSummaries.filter(
      (problem) => problem.structureType === "queue" && problem.accepted
    ).length,
    byStructure: Object.fromEntries(
      STRUCTURE_TYPES.map((type): [StructureType, { accepted: number; total: number }] => [
        type,
        {
          total: problemSummaries.filter((problem) => problem.structureType === type).length,
          accepted: problemSummaries.filter((problem) => problem.structureType === type && problem.accepted).length
        }
      ]).filter(([, counts]) => counts.total > 0)
    ),
    recentSubmissions,
    problems: problemSummaries
  };
};
