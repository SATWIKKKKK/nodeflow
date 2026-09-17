import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AuthUser, ClassroomAssignment, ClassroomDetail, ClassroomMember, ClassroomSummary } from "@nodeflow/shared";
import { usersById } from "../auth/store.js";
import { readSubmissions } from "../progress/summary.js";
import { getProblem } from "../problems/seeds.js";
import { dataDir } from "../paths.js";

/**
 * Hosted classrooms: an owner creates a room, shares its join code, assigns
 * problems, and everyone in the room sees the same progress board. Progress is
 * derived from Submit records, never stored twice.
 */

interface StoredClassroom {
  id: string;
  name: string;
  ownerId: string;
  joinCode: string;
  createdAt: string;
  members: Array<{ userId: string; joinedAt: string }>;
  assignments: Array<{ problemId: string; addedAt: string }>;
}

export class ClassroomError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

const storePath = path.join(dataDir, "classrooms.json");

const LIMITS = { ownedRooms: 20, members: 200, assignments: 100, nameLength: 60 };
// No 0/O or 1/I/L, so codes survive being read aloud or copied from a board.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const readStore = (): StoredClassroom[] => {
  if (!fs.existsSync(storePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredClassroom[]) : [];
  } catch {
    return [];
  }
};

const writeStore = (rooms: StoredClassroom[]) => {
  fs.mkdirSync(dataDir, { recursive: true });
  const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(rooms, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, storePath);
};

// Reads and writes are synchronous, so one API process never interleaves two updates.
const update = <T>(mutate: (rooms: StoredClassroom[]) => T): T => {
  const rooms = readStore();
  const result = mutate(rooms);
  writeStore(rooms);
  return result;
};

const newJoinCode = (rooms: StoredClassroom[]) => {
  const taken = new Set(rooms.map((room) => room.joinCode));
  for (;;) {
    const code = Array.from(crypto.randomBytes(6), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
    if (!taken.has(code)) return code;
  }
};

const cleanName = (name: string) => {
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (!trimmed) throw new ClassroomError("Give the classroom a name.", 400);
  if (trimmed.length > LIMITS.nameLength) {
    throw new ClassroomError(`Keep the name under ${LIMITS.nameLength} characters.`, 400);
  }
  return trimmed;
};

const isMember = (room: StoredClassroom, userId: string) =>
  room.ownerId === userId || room.members.some((member) => member.userId === userId);

const findRoom = (rooms: StoredClassroom[], id: string, user: AuthUser) => {
  const room = rooms.find((entry) => entry.id === id);
  // Rooms you are not in look the same as rooms that do not exist.
  if (!room || !isMember(room, user.id)) throw new ClassroomError("Classroom not found.", 404);
  return room;
};

const requireOwner = (room: StoredClassroom, user: AuthUser) => {
  if (room.ownerId !== user.id) throw new ClassroomError("Only the classroom owner can do that.", 403);
};

const summary = (room: StoredClassroom, user: AuthUser): ClassroomSummary => ({
  id: room.id,
  name: room.name,
  isOwner: room.ownerId === user.id,
  memberCount: room.members.length + 1,
  assignmentCount: room.assignments.length,
  createdAt: room.createdAt
});

const detail = (room: StoredClassroom, user: AuthUser): ClassroomDetail => {
  const owner = room.ownerId === user.id;
  const roster = [{ userId: room.ownerId, joinedAt: room.createdAt }, ...room.members];
  const people = usersById(roster.map((entry) => entry.userId));
  const assignmentIds = new Set(room.assignments.map((assignment) => assignment.problemId));

  const submissionsByUser = new Map<string, ReturnType<typeof readSubmissions>>();
  for (const submission of readSubmissions()) {
    if (!submission.userId) continue;
    const list = submissionsByUser.get(submission.userId) ?? [];
    list.push(submission);
    submissionsByUser.set(submission.userId, list);
  }

  const members: ClassroomMember[] = roster.map((entry) => {
    const person = people.get(entry.userId);
    const submissions = submissionsByUser.get(entry.userId) ?? [];
    const solved = new Set(submissions.filter((item) => item.verdict === "Accepted").map((item) => item.problemId));
    const attempted = new Set(submissions.map((item) => item.problemId));
    const solvedAssignments = [...solved].filter((id) => assignmentIds.has(id));
    const last = submissions.map((item) => item.timestamp).sort().at(-1);
    return {
      id: entry.userId,
      name: person?.email.split("@")[0] ?? "former member",
      email: owner ? person?.email : undefined,
      role: entry.userId === room.ownerId ? "owner" : "member",
      joinedAt: entry.joinedAt,
      solved: solved.size,
      attempted: attempted.size,
      assignmentsSolved: solvedAssignments.length,
      lastSubmittedAt: last,
      solvedAssignments
    };
  });

  const assignments: ClassroomAssignment[] = room.assignments.flatMap((assignment) => {
    const problem = getProblem(assignment.problemId);
    if (!problem) return [];
    return [
      {
        problemId: problem.id,
        title: problem.title,
        topic: problem.topic,
        difficulty: problem.difficulty,
        addedAt: assignment.addedAt,
        solvedBy: members.filter((member) => member.role === "member" && member.solvedAssignments.includes(problem.id))
          .length
      }
    ];
  });

  return {
    id: room.id,
    name: room.name,
    isOwner: owner,
    joinCode: owner ? room.joinCode : undefined,
    createdAt: room.createdAt,
    members,
    assignments
  };
};

export const listClassrooms = (user: AuthUser): ClassroomSummary[] =>
  readStore()
    .filter((room) => isMember(room, user.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((room) => summary(room, user));

export const createClassroom = (user: AuthUser, name: string): ClassroomDetail =>
  update((rooms) => {
    if (rooms.filter((room) => room.ownerId === user.id).length >= LIMITS.ownedRooms) {
      throw new ClassroomError(`You can own at most ${LIMITS.ownedRooms} classrooms.`, 400);
    }
    const room: StoredClassroom = {
      id: `room_${crypto.randomUUID()}`,
      name: cleanName(name),
      ownerId: user.id,
      joinCode: newJoinCode(rooms),
      createdAt: new Date().toISOString(),
      members: [],
      assignments: []
    };
    rooms.push(room);
    return detail(room, user);
  });

export const joinClassroom = (user: AuthUser, code: string): ClassroomDetail =>
  update((rooms) => {
    const normalized = code.replace(/[\s-]/g, "").toUpperCase();
    const room = rooms.find((entry) => entry.joinCode === normalized);
    if (!room) throw new ClassroomError("No classroom uses that code. Check it with your teacher.", 404);
    if (!isMember(room, user.id)) {
      if (room.members.length + 1 >= LIMITS.members) throw new ClassroomError("This classroom is full.", 400);
      room.members.push({ userId: user.id, joinedAt: new Date().toISOString() });
    }
    return detail(room, user);
  });

export const getClassroom = (user: AuthUser, id: string): ClassroomDetail => detail(findRoom(readStore(), id, user), user);

export const renameClassroom = (user: AuthUser, id: string, name: string): ClassroomDetail =>
  update((rooms) => {
    const room = findRoom(rooms, id, user);
    requireOwner(room, user);
    room.name = cleanName(name);
    return detail(room, user);
  });

export const setAssignments = (user: AuthUser, id: string, problemIds: string[]): ClassroomDetail =>
  update((rooms) => {
    const room = findRoom(rooms, id, user);
    requireOwner(room, user);
    const unique = [...new Set(problemIds)];
    if (unique.length > LIMITS.assignments) {
      throw new ClassroomError(`A classroom can have at most ${LIMITS.assignments} assignments.`, 400);
    }
    const unknown = unique.find((problemId) => !getProblem(problemId));
    if (unknown) throw new ClassroomError(`Unknown problem: ${unknown}`, 400);
    const previous = new Map(room.assignments.map((assignment) => [assignment.problemId, assignment.addedAt]));
    const now = new Date().toISOString();
    room.assignments = unique.map((problemId) => ({ problemId, addedAt: previous.get(problemId) ?? now }));
    return detail(room, user);
  });

export const rotateJoinCode = (user: AuthUser, id: string): ClassroomDetail =>
  update((rooms) => {
    const room = findRoom(rooms, id, user);
    requireOwner(room, user);
    room.joinCode = newJoinCode(rooms);
    return detail(room, user);
  });

export const removeMember = (user: AuthUser, id: string, memberId: string) =>
  update((rooms) => {
    const room = findRoom(rooms, id, user);
    const leaving = memberId === user.id;
    if (!leaving) requireOwner(room, user);
    if (memberId === room.ownerId) {
      throw new ClassroomError("The owner cannot leave. Delete the classroom instead.", 400);
    }
    room.members = room.members.filter((member) => member.userId !== memberId);
    return { ok: true };
  });

export const deleteClassroom = (user: AuthUser, id: string) =>
  update((rooms) => {
    const room = findRoom(rooms, id, user);
    requireOwner(room, user);
    rooms.splice(rooms.indexOf(room), 1);
    return { ok: true };
  });
