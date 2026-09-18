import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "../paths.js";

/**
 * Exercises accounts, submissions and classrooms against whatever store is
 * configured (Postgres when DATABASE_URL/DB_URL is set, else JSON files).
 *
 *   npm run verify:store --workspace backend
 */
for (const file of [path.join(repoRoot, ".env.local")]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

const { usingDatabase } = await import("./db.js");
const { completePasswordReset, signIn, signUp, startPasswordReset, userForToken } = await import("../auth/store.js");
const { createClassroom, getClassroom, joinClassroom, listClassrooms, setAssignments, deleteClassroom } = await import(
  "../classrooms/store.js"
);
const { recordSubmission, progressForUser } = await import("../progress/summary.js");

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const stamp = Date.now();
const teacherEmail = `store-teacher-${stamp}@noesis.local`;
const studentEmail = `store-student-${stamp}@noesis.local`;

const teacher = await signUp(teacherEmail, "password123");
const student = await signUp(studentEmail, "password123");
assert((await userForToken(teacher.token))?.id === teacher.user.id, "session lookup failed");
assert((await signIn(studentEmail, "password123")).user.id === student.user.id, "sign in failed");

const room = await createClassroom(teacher.user, "Store check");
const joined = await joinClassroom(student.user, room.joinCode!);
assert(joined.id === room.id, "join by code failed");
assert((await listClassrooms(student.user)).some((entry) => entry.id === room.id), "student cannot see the room");

await setAssignments(teacher.user, room.id, ["reverse-linked-list"]);
await recordSubmission({
  submissionId: `store-check-${stamp}`,
  userId: student.user.id,
  problemId: "reverse-linked-list",
  language: "python",
  code: "def reverse_list(head):\n    return head\n",
  verdict: "Accepted",
  runtimeMs: 12,
  timestamp: new Date().toISOString()
});

const board = await getClassroom(teacher.user, room.id);
const studentRow = board.members.find((member) => member.id === student.user.id);
assert(studentRow?.assignmentsSolved === 1, "progress board missed the accepted submission");
assert(board.assignments[0]?.solvedBy === 1, "assignment solvedBy missed the submission");
assert((await progressForUser(student.user)).accepted === 1, "dashboard progress missed the submission");

const reset = await startPasswordReset(studentEmail);
const afterReset = await completePasswordReset(reset!.token, "new-password-1");
assert(afterReset.user.id === student.user.id, "reset signed in as the wrong user");
assert((await signIn(studentEmail, "new-password-1")).user.id === student.user.id, "new password rejected");

await deleteClassroom(teacher.user, room.id);
console.log(JSON.stringify({ ok: true, store: usingDatabase() ? "postgres" : "json files", classroom: room.id }, null, 2));
