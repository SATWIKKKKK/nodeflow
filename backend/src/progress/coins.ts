import fs from "node:fs";
import path from "node:path";
import { dataDir } from "../paths.js";
import { ensureSchema, sql } from "../store/db.js";

/**
 * Coins earned in the waiting game: two for a right answer, minus one for a
 * wrong one, never below zero.
 *
 * The client scores each round the instant it is played and sends the running
 * difference in batches, so the balance on screen never waits on the network.
 * A batch is clamped to what a quick player could plausibly earn between two
 * syncs; it is a game, and the clamp only keeps a tampered request from
 * minting a fortune.
 *
 * Postgres when DATABASE_URL is set, otherwise backend/data/coins.json.
 */

export const MAX_BATCH = 80;
const storePath = path.join(dataDir, "coins.json");

const readFile = (): Record<string, number> => {
  if (!fs.existsSync(storePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, "utf8")) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
};

const writeFile = (wallets: Record<string, number>) => {
  fs.mkdirSync(dataDir, { recursive: true });
  const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(wallets, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, storePath);
};

export const coinsFor = async (userId: string): Promise<number> => {
  if (sql) {
    await ensureSchema();
    const rows = (await sql`select coins from noesis_wallets where user_id = ${userId}`) as Array<{ coins: number }>;
    return rows[0]?.coins ?? 0;
  }
  return readFile()[userId] ?? 0;
};

export const addCoins = async (userId: string, delta: number): Promise<number> => {
  const change = Math.max(-MAX_BATCH, Math.min(MAX_BATCH, Math.trunc(delta)));
  if (sql) {
    await ensureSchema();
    const rows = (await sql`insert into noesis_wallets (user_id, coins, updated_at)
      values (${userId}, greatest(0, ${change}), now())
      on conflict (user_id) do update
        set coins = greatest(0, noesis_wallets.coins + ${change}), updated_at = now()
      returning coins`) as Array<{ coins: number }>;
    return rows[0]?.coins ?? 0;
  }
  const wallets = readFile();
  wallets[userId] = Math.max(0, (wallets[userId] ?? 0) + change);
  writeFile(wallets);
  return wallets[userId];
};
