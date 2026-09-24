import fs from "node:fs";
import path from "node:path";
import {
  STRUCTURE_TYPES,
  type StructureType,
  type AuthUser,
  type JudgeVerdict,
  type ProgressProblemSummary,
  type ProgressSummary,
  type SubmissionSummary
} from "@nodeflow/shared";
import { problems } from "../problems/seeds.js";
import { ensureSchema, sql } from "../store/db.js";
import { dataDir } from "../paths.js";

export interface StoredSubmission {
  submissionId: string;
  userId?: string;
  problemId: string;
  code?: string;
  verdict: JudgeVerdict;
  runtimeMs: number;
  timestamp: string;
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
}

const fromRow = (row: SubmissionRow): StoredSubmission => ({
  submissionId: row.id,
  userId: row.user_id,
  problemId: row.problem_id,
  verdict: row.verdict,
  runtimeMs: row.runtime_ms,
  timestamp: new Date(row.created_at).toISOString()
});

/** Submissions for the given users (all users when omitted), oldest first. Code is not loaded. */
export const readSubmissions = async (userIds?: string[]): Promise<StoredSubmission[]> => {
  if (sql) {
    await ensureSchema();
    const rows = (
      userIds
        ? await sql`select id, user_id, problem_id, verdict, runtime_ms, created_at from noesis_submissions
            where user_id = any(${userIds}) order by created_at`
        : await sql`select id, user_id, problem_id, verdict, runtime_ms, created_at from noesis_submissions order by created_at`
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

export const progressForUser = async (user: AuthUser | null): Promise<ProgressSummary> => {
  const userId = user?.id ?? "local";
  const submissions = (await readSubmissions([userId]))
    .map((submission) => ({ ...submission, userId: submission.userId ?? "local" }))
    .filter((submission) => submission.userId === userId)
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));

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

  return {
    userId,
    userEmail: user?.email,
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
