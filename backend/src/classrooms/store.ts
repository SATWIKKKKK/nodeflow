import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AuthUser, ClassroomAssignment, ClassroomDetail, ClassroomMember, ClassroomSummary } from "@nodeflow/shared";
import { usersById } from "../auth/store.js";
import { readSubmissions, type StoredSubmission } from "../progress/summary.js";
import { getProblem } from "../problems/seeds.js";
import { dataDir } from "../paths.js";
import { ensureSchema, sql } from "../store/db.js";

/**
 * Hosted classrooms: an owner creates a room, shares its join code, assigns
 * problems, and everyone in the room sees the same progress board. Progress is
 * derived from Submit records, never stored twice.
 *
 * Postgres when DATABASE_URL is set (one row per room, with a version for
 * optimistic concurrency), otherwise backend/data/classrooms.json.
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

// ---------------------------------------------------------------- storage

const readAllFromFile = (): StoredClassroom[] => {
  if (!fs.existsSync(storePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredClassroom[]) : [];
  } catch {
    return [];
  }
};

const writeAllToFile = (rooms: StoredClassroom[]) => {
  fs.mkdirSync(dataDir, { recursive: true });
  const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(rooms, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, storePath);
};

interface RoomRow {
  data: StoredClassroom;
  version: number;
}

const isMember = (room: StoredClassroom, userId: string) =>
  room.ownerId === userId || room.members.some((member) => member.userId === userId);

const loadForUser = async (user: AuthUser): Promise<StoredClassroom[]> => {
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      select data from noesis_classrooms
      where owner_id = ${user.id} or data -> 'members' @> ${JSON.stringify([{ userId: user.id }])}::jsonb
      order by created_at desc
    `) as Array<{ data: StoredClassroom }>;
    return rows.map((row) => row.data);
  }
  return readAllFromFile()
    .filter((room) => isMember(room, user.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

const loadRoom = async (id: string): Promise<RoomRow | null> => {
  if (sql) {
    await ensureSchema();
    const rows = (await sql`select data, version from noesis_classrooms where id = ${id}`) as RoomRow[];
    return rows[0] ?? null;
  }
  const room = readAllFromFile().find((entry) => entry.id === id);
  return room ? { data: room, version: 0 } : null;
};

const insertRoom = async (room: StoredClassroom) => {
  if (sql) {
    await ensureSchema();
    await sql`insert into noesis_classrooms (id, owner_id, join_code, version, data)
      values (${room.id}, ${room.ownerId}, ${room.joinCode}, 0, ${JSON.stringify(room)}::jsonb)`;
    return;
  }
  writeAllToFile([...readAllFromFile(), room]);
};

/** Saves a room; false when someone else saved first (Postgres only). */
const saveRoom = async (room: StoredClassroom, version: number): Promise<boolean> => {
  if (sql) {
    const updated = (await sql`
      update noesis_classrooms
      set data = ${JSON.stringify(room)}::jsonb, join_code = ${room.joinCode}, version = ${version + 1}
      where id = ${room.id} and version = ${version}
      returning id
    `) as Array<{ id: string }>;
    return updated.length > 0;
  }
  const rooms = readAllFromFile();
  const index = rooms.findIndex((entry) => entry.id === room.id);
  if (index < 0) return false;
  rooms[index] = room;
  writeAllToFile(rooms);
  return true;
};

const deleteRoom = async (id: string) => {
  if (sql) {
    await sql`delete from noesis_classrooms where id = ${id}`;
    return;
  }
  writeAllToFile(readAllFromFile().filter((room) => room.id !== id));
};

const codeTaken = async (code: string): Promise<boolean> => {
  if (sql) {
    const rows = (await sql`select 1 from noesis_classrooms where join_code = ${code}`) as unknown[];
    return rows.length > 0;
  }
  return readAllFromFile().some((room) => room.joinCode === code);
};

const roomByCode = async (code: string): Promise<RoomRow | null> => {
  if (sql) {
    await ensureSchema();
    const rows = (await sql`select data, version from noesis_classrooms where join_code = ${code}`) as RoomRow[];
    return rows[0] ?? null;
  }
  const room = readAllFromFile().find((entry) => entry.joinCode === code);
  return room ? { data: room, version: 0 } : null;
};

const newJoinCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = Array.from(crypto.randomBytes(6), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
    if (!(await codeTaken(code))) return code;
  }
  throw new ClassroomError("Could not allocate a join code. Please try again.", 503);
};

// ---------------------------------------------------------------- helpers

const cleanName = (name: string) => {
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (!trimmed) throw new ClassroomError("Give the classroom a name.", 400);
  if (trimmed.length > LIMITS.nameLength) {
    throw new ClassroomError(`Keep the name under ${LIMITS.nameLength} characters.`, 400);
  }
  return trimmed;
};

const requireOwner = (room: StoredClassroom, user: AuthUser) => {
  if (room.ownerId !== user.id) throw new ClassroomError("Only the classroom owner can do that.", 403);
};

const readRoom = async (id: string, user: AuthUser): Promise<RoomRow> => {
  const row = await loadRoom(id);
  // Rooms you are not in look the same as rooms that do not exist.
  if (!row || !isMember(row.data, user.id)) throw new ClassroomError("Classroom not found.", 404);
  return row;
};

/** Applies a change to a room, retrying when another request saved first. */
const mutate = async (id: string, user: AuthUser, change: (room: StoredClassroom) => void): Promise<void> => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, version } = await readRoom(id, user);
    change(data);
    if (await saveRoom(data, version)) return;
  }
  throw new ClassroomError("The classroom was being changed elsewhere. Try again.", 409);
};

const summary = (room: StoredClassroom, user: AuthUser): ClassroomSummary => ({
  id: room.id,
  name: room.name,
  isOwner: room.ownerId === user.id,
  memberCount: room.members.length + 1,
  assignmentCount: room.assignments.length,
  createdAt: room.createdAt
});

const detail = async (room: StoredClassroom, user: AuthUser): Promise<ClassroomDetail> => {
  const owner = room.ownerId === user.id;
  const roster = [{ userId: room.ownerId, joinedAt: room.createdAt }, ...room.members];
  const ids = roster.map((entry) => entry.userId);
  const [people, submissions] = await Promise.all([usersById(ids), readSubmissions(ids)]);
  const assignmentIds = new Set(room.assignments.map((assignment) => assignment.problemId));

  const byUser = new Map<string, StoredSubmission[]>();
  for (const submission of submissions) {
    const key = submission.userId ?? "local";
    byUser.set(key, [...(byUser.get(key) ?? []), submission]);
  }

  const members: ClassroomMember[] = roster.map((entry) => {
    const person = people.get(entry.userId);
    const mine = byUser.get(entry.userId) ?? [];
    const solved = new Set(mine.filter((item) => item.verdict === "Accepted").map((item) => item.problemId));
    const attempted = new Set(mine.map((item) => item.problemId));
    const solvedAssignments = [...solved].filter((id) => assignmentIds.has(id));
    const last = mine.map((item) => item.timestamp).sort().at(-1);
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

// ---------------------------------------------------------------- API

export const listClassrooms = async (user: AuthUser): Promise<ClassroomSummary[]> =>
  (await loadForUser(user)).map((room) => summary(room, user));

export const createClassroom = async (user: AuthUser, name: string): Promise<ClassroomDetail> => {
  const owned = (await loadForUser(user)).filter((room) => room.ownerId === user.id);
  if (owned.length >= LIMITS.ownedRooms) {
    throw new ClassroomError(`You can own at most ${LIMITS.ownedRooms} classrooms.`, 400);
  }
  const room: StoredClassroom = {
    id: `room_${crypto.randomUUID()}`,
    name: cleanName(name),
    ownerId: user.id,
    joinCode: await newJoinCode(),
    createdAt: new Date().toISOString(),
    members: [],
    assignments: []
  };
  await insertRoom(room);
  return detail(room, user);
};

export const getClassroom = async (user: AuthUser, id: string): Promise<ClassroomDetail> =>
  detail((await readRoom(id, user)).data, user);

export const joinClassroom = async (user: AuthUser, code: string): Promise<ClassroomDetail> => {
  const normalized = code.replace(/[\s-]/g, "").toUpperCase();
  const first = await roomByCode(normalized);
  if (!first) throw new ClassroomError("No classroom uses that code. Check it with your teacher.", 404);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = attempt === 0 ? first : await loadRoom(first.data.id);
    if (!current) throw new ClassroomError("No classroom uses that code. Check it with your teacher.", 404);
    if (isMember(current.data, user.id)) return detail(current.data, user);
    if (current.data.members.length + 1 >= LIMITS.members) throw new ClassroomError("This classroom is full.", 400);
    current.data.members.push({ userId: user.id, joinedAt: new Date().toISOString() });
    if (await saveRoom(current.data, current.version)) return detail(current.data, user);
  }
  throw new ClassroomError("The classroom was being changed elsewhere. Try again.", 409);
};

export const renameClassroom = async (user: AuthUser, id: string, name: string): Promise<ClassroomDetail> => {
  await mutate(id, user, (room) => {
    requireOwner(room, user);
    room.name = cleanName(name);
  });
  return getClassroom(user, id);
};

export const setAssignments = async (user: AuthUser, id: string, problemIds: string[]): Promise<ClassroomDetail> => {
  await mutate(id, user, (room) => {
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
  });
  return getClassroom(user, id);
};

export const rotateJoinCode = async (user: AuthUser, id: string): Promise<ClassroomDetail> => {
  const code = await newJoinCode();
  await mutate(id, user, (room) => {
    requireOwner(room, user);
    room.joinCode = code;
  });
  return getClassroom(user, id);
};

export const removeMember = async (user: AuthUser, id: string, memberId: string) => {
  await mutate(id, user, (room) => {
    if (memberId !== user.id) requireOwner(room, user);
    if (memberId === room.ownerId) {
      throw new ClassroomError("The owner cannot leave. Delete the classroom instead.", 400);
    }
    room.members = room.members.filter((member) => member.userId !== memberId);
  });
  return { ok: true };
};

export const deleteClassroom = async (user: AuthUser, id: string) => {
  const { data } = await readRoom(id, user);
  requireOwner(data, user);
  await deleteRoom(id);
  return { ok: true };
};
