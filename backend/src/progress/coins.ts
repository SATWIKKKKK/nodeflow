import fs from "node:fs";
import path from "node:path";
import { SOLVE_REWARD, type BadgeAward, type CoinBreakdown, type CoinSource, type Difficulty } from "@nodeflow/shared";
import { dataDir } from "../paths.js";
import { ensureSchema, sql } from "../store/db.js";
import { getProblem } from "../problems/seeds.js";
import { getVariant } from "../problems/variants.js";

/**
 * Noesis coins: where they come from, and how many there are.
 *
 * Two sources. The waiting game pays two for a right pick and takes one back
 * for a wrong one; the client scores each round at once and sends the running
 * difference in batches, clamped to what a quick player could earn between
 * two syncs. And a problem pays once, by difficulty, the first time it is
 * accepted: that award is made here, by the submit route, never by the client,
 * and a problem already solved (even before coins existed) pays nothing.
 *
 * Every change is written to a ledger as well as the balance, so the coin
 * popup can say where each coin came from. Coins held before the ledger
 * existed show up as "earlier".
 *
 * Postgres when DATABASE_URL is set, otherwise backend/data/coins.json.
 */

export const MAX_BATCH = 80;

const storePath = path.join(dataDir, "coins.json");

interface CoinEvent {
  userId: string;
  source: CoinSource;
  amount: number;
  problemId?: string;
  at: string;
}

interface CoinFile {
  wallets: Record<string, number>;
  events: CoinEvent[];
}

const readFile = (): CoinFile => {
  if (!fs.existsSync(storePath)) return { wallets: {}, events: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, "utf8")) as unknown;
    if (parsed && typeof parsed === "object" && "wallets" in parsed) return parsed as CoinFile;
    // The first version kept balances only.
    return { wallets: (parsed as Record<string, number>) ?? {}, events: [] };
  } catch {
    return { wallets: {}, events: [] };
  }
};

const writeFile = (data: CoinFile) => {
  fs.mkdirSync(dataDir, { recursive: true });
  const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, storePath);
};

export const coinsFor = async (userId: string): Promise<number> => {
  if (sql) {
    await ensureSchema();
    const rows = (await sql`select coins from noesis_wallets where user_id = ${userId}`) as Array<{ coins: number }>;
    return rows[0]?.coins ?? 0;
  }
  return readFile().wallets[userId] ?? 0;
};

/** Waiting-game rounds. Records what actually changed, after the clamp at zero. */
export const addCoins = async (userId: string, delta: number): Promise<number> => {
  const change = Math.max(-MAX_BATCH, Math.min(MAX_BATCH, Math.trunc(delta)));
  if (sql) {
    await ensureSchema();
    const before = await coinsFor(userId);
    const rows = (await sql`insert into noesis_wallets (user_id, coins, updated_at)
      values (${userId}, greatest(0, ${change}), now())
      on conflict (user_id) do update
        set coins = greatest(0, noesis_wallets.coins + ${change}), updated_at = now()
      returning coins`) as Array<{ coins: number }>;
    const after = rows[0]?.coins ?? 0;
    if (after !== before) {
      await sql`insert into noesis_coin_events (user_id, source, amount) values (${userId}, 'game', ${after - before})`;
    }
    return after;
  }
  const data = readFile();
  const before = data.wallets[userId] ?? 0;
  const after = Math.max(0, before + change);
  data.wallets[userId] = after;
  if (after !== before) data.events.push({ userId, source: "game", amount: after - before, at: new Date().toISOString() });
  writeFile(data);
  return after;
};

/**
 * The once-per-problem award for a first accepted submission. Returns what was
 * paid: nothing if this problem has paid out to this learner before.
 */
export const rewardSolve = async (userId: string, problemId: string, difficulty: Difficulty): Promise<number> => {
  const amount = SOLVE_REWARD[difficulty] ?? SOLVE_REWARD.Easy;
  if (sql) {
    await ensureSchema();
    const inserted = (await sql`insert into noesis_coin_events (user_id, source, amount, problem_id)
      values (${userId}, 'solve', ${amount}, ${problemId})
      on conflict (user_id, problem_id) where source = 'solve' do nothing
      returning id`) as Array<{ id: number }>;
    if (!inserted.length) return 0;
    await sql`insert into noesis_wallets (user_id, coins, updated_at) values (${userId}, ${amount}, now())
      on conflict (user_id) do update set coins = noesis_wallets.coins + ${amount}, updated_at = now()`;
    return amount;
  }
  const data = readFile();
  if (data.events.some((event) => event.userId === userId && event.source === "solve" && event.problemId === problemId)) {
    return 0;
  }
  data.events.push({ userId, source: "solve", amount, problemId, at: new Date().toISOString() });
  data.wallets[userId] = (data.wallets[userId] ?? 0) + amount;
  writeFile(data);
  return amount;
};

/** Every coin event of a learner, oldest first: what the Collector badge counts. */
export const coinEventsFor = async (userId: string): Promise<Array<{ source: CoinSource; amount: number; at: string }>> => {
  if (sql) {
    await ensureSchema();
    const rows = (await sql`select source, amount, created_at from noesis_coin_events
      where user_id = ${userId} order by created_at`) as Array<{ source: CoinSource; amount: number; created_at: string | Date }>;
    return rows.map((row) => ({ source: row.source, amount: row.amount, at: new Date(row.created_at).toISOString() }));
  }
  return readFile()
    .events.filter((event) => event.userId === userId)
    .sort((left, right) => Date.parse(left.at) - Date.parse(right.at))
    .map((event) => ({ source: event.source, amount: event.amount, at: event.at }));
};

/**
 * Pays each badge tier once. `awards` is every tier the learner holds; those
 * already paid are skipped (the tier's key sits in problem_id, under a unique
 * index like the solve award's). Returns the tiers paid now.
 */
export const rewardBadges = async (
  userId: string,
  awards: Array<{ key: string; amount: number; award: BadgeAward }>
): Promise<BadgeAward[]> => {
  if (!awards.length) return [];
  const paid: BadgeAward[] = [];
  if (sql) {
    await ensureSchema();
    for (const { key, amount, award } of awards) {
      const inserted = (await sql`insert into noesis_coin_events (user_id, source, amount, problem_id)
        values (${userId}, 'badge', ${amount}, ${key})
        on conflict (user_id, problem_id) where source = 'badge' do nothing
        returning id`) as Array<{ id: number }>;
      if (!inserted.length) continue;
      await sql`insert into noesis_wallets (user_id, coins, updated_at) values (${userId}, ${amount}, now())
        on conflict (user_id) do update set coins = noesis_wallets.coins + ${amount}, updated_at = now()`;
      paid.push(award);
    }
    return paid;
  }
  const data = readFile();
  const have = new Set(
    data.events.filter((event) => event.userId === userId && event.source === "badge").map((event) => event.problemId)
  );
  for (const { key, amount, award } of awards) {
    if (have.has(key)) continue;
    data.events.push({ userId, source: "badge", amount, problemId: key, at: new Date().toISOString() });
    data.wallets[userId] = (data.wallets[userId] ?? 0) + amount;
    paid.push(award);
  }
  if (paid.length) writeFile(data);
  return paid;
};

/** Where a learner's coins came from, for the coin popup. */
export const breakdownFor = async (userId: string): Promise<CoinBreakdown> => {
  let events: Array<Omit<CoinEvent, "userId">>;
  if (sql) {
    await ensureSchema();
    const rows = (await sql`select source, amount, problem_id, created_at from noesis_coin_events
      where user_id = ${userId} order by created_at desc`) as Array<{
      source: CoinSource;
      amount: number;
      problem_id: string | null;
      created_at: string | Date;
    }>;
    events = rows.map((row) => ({
      source: row.source,
      amount: row.amount,
      problemId: row.problem_id ?? undefined,
      at: new Date(row.created_at).toISOString()
    }));
  } else {
    events = readFile()
      .events.filter((event) => event.userId === userId)
      .sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
  }
  const coins = await coinsFor(userId);
  const game = events.filter((event) => event.source === "game");
  const solves = events.filter((event) => event.source === "solve");
  const badges = events.filter((event) => event.source === "badge");
  const badgeTotal = badges.reduce((sum, event) => sum + event.amount, 0);
  const gameGained = game.filter((event) => event.amount > 0).reduce((sum, event) => sum + event.amount, 0);
  const gameLost = game.filter((event) => event.amount < 0).reduce((sum, event) => sum - event.amount, 0);
  const solveTotal = solves.reduce((sum, event) => sum + event.amount, 0);
  return {
    coins,
    game: { net: gameGained - gameLost, gained: gameGained, lost: gameLost },
    solve: {
      total: solveTotal,
      count: solves.length,
      recent: solves.slice(0, 6).map((event) => {
        const problem = event.problemId ? getProblem(event.problemId) ?? getVariant(event.problemId) : undefined;
        return {
          problemId: event.problemId ?? "",
          title: problem?.title ?? event.problemId ?? "A problem",
          difficulty: problem?.difficulty,
          amount: event.amount,
          at: event.at
        };
      })
    },
    badge: { total: badgeTotal, count: badges.length },
    earlier: Math.max(0, coins - (gameGained - gameLost) - solveTotal - badgeTotal),
    rewards: SOLVE_REWARD
  };
};
