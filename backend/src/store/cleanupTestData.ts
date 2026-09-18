import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "../paths.js";

/** Removes the accounts and rooms left behind by verify scripts (safe to re-run). */
for (const file of [path.join(repoRoot, ".env.local")]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

const { sql } = await import("./db.js");
if (!sql) {
  console.log("No database configured; nothing to clean.");
  process.exit(0);
}

const pattern = "(store-teacher-%|store-student-%|prod-teacher-%|prod-student-%|verify-%|progress-%|reset-%)";
const users = (await sql`select id, email from noesis_users where email similar to ${pattern}`) as Array<{ id: string; email: string }>;
const ids = users.map((user) => user.id);

if (ids.length) {
  await sql`delete from noesis_classrooms where owner_id = any(${ids})`;
  await sql`delete from noesis_submissions where user_id = any(${ids})`;
  await sql`delete from noesis_users where id = any(${ids})`;
}
const remaining = (await sql`select count(*)::int as count from noesis_users`) as Array<{ count: number }>;
console.log(JSON.stringify({ removed: users.length, usersLeft: remaining[0].count }, null, 2));
