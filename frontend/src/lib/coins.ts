import { useEffect, useSyncExternalStore } from "react";
import { BADGE_TIERS, SOLVE_REWARD, type BadgeAward, type CoinBreakdown, type Difficulty } from "@nodeflow/shared";
import { api } from "./api";
import { useSession } from "./session";

/**
 * The coin balance, shared by every place that shows it.
 *
 * Two ways in. A round of the waiting game changes the balance the instant it
 * is played, quietly: the counter ticks and a small "+2" or "−1" floats off
 * it. The change goes to the account in batches a moment later, and the
 * server's answer (which clamps at zero) becomes the balance.
 *
 * A problem's first accepted submission is paid by the server itself, and
 * that one is marked: a single coin rises, turns slowly and settles into the
 * counter (components/CoinCelebration), and only then is it counted.
 *
 * Guests keep their coins, and a record of where they came from, in this
 * browser.
 */

const GUEST_KEY = "noesis:coins";
const GUEST_LEDGER_KEY = "noesis:coin-ledger";
/** A coin that has not landed by now lands anyway, so nothing is ever lost. */
const LAND_BY_MS = 6000;

export interface CoinFlight {
  id: number;
  amount: number;
  /** What it was for, shown under the coin: "First solve · Two Sum". */
  label: string;
  /** Where it was earned, in viewport coordinates. */
  origin?: { x: number; y: number };
  flying: boolean;
}

interface GuestLedger {
  game: { gained: number; lost: number };
  solves: CoinBreakdown["solve"]["recent"];
}

const listeners = new Set<() => void>();

let balance = 0;
let inFlight = 0;
let shown = 0;
let token: string | null = null;
let signedIn = false;
let unsent = 0;
let timer: number | undefined;
let flights: CoinFlight[] = [];
let flightSeq = 0;
let celebrating = 0;
/** Last change the counters showed, so a badge can float "+2" or "−1" beside it. */
let lastChange = { delta: 0, at: 0 };

const emit = () => {
  shown = Math.max(0, balance - inFlight);
  listeners.forEach((listener) => listener());
};

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Coins still count for this visit.
  }
};

const readGuest = () => Math.max(0, Number(readJson<number>(GUEST_KEY, 0)) || 0);
const readLedger = () => readJson<GuestLedger>(GUEST_LEDGER_KEY, { game: { gained: 0, lost: 0 }, solves: [] });

const flush = () => {
  window.clearTimeout(timer);
  timer = undefined;
  if (!signedIn || !token || unsent === 0) return;
  const delta = unsent;
  unsent = 0;
  api
    .addCoins(delta, token)
    .then(({ coins }) => {
      // Rounds played while the request was out are still on top of it.
      balance = Math.max(0, coins + unsent);
      emit();
    })
    .catch(() => {
      unsent += delta;
    });
};

const reducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/** A celebrated coin has reached a counter: count it. */
export const landFlight = (id: number) => {
  const flight = flights.find((entry) => entry.id === id);
  if (!flight) return;
  flights = flights.filter((entry) => entry.id !== id);
  inFlight = Math.max(0, inFlight - flight.amount);
  lastChange = { delta: flight.amount, at: Date.now() };
  emit();
};

/** The coin on show has left for the counter. */
export const launchFlight = (id: number) => {
  flights = flights.map((entry) => (entry.id === id ? { ...entry, flying: true } : entry));
  emit();
};

/** A waiting-game round: counted at once, without ceremony. */
export const earnCoins = (delta: number) => {
  const before = balance;
  balance = Math.max(0, balance + delta);
  lastChange = { delta, at: Date.now() };
  emit();
  if (!signedIn) {
    writeJson(GUEST_KEY, balance);
    const ledger = readLedger();
    const change = balance - before;
    if (change > 0) ledger.game.gained += change;
    if (change < 0) ledger.game.lost -= change;
    writeJson(GUEST_LEDGER_KEY, ledger);
    return;
  }
  unsent += delta;
  window.clearTimeout(timer);
  timer = window.setTimeout(flush, 900);
};

/** Coins the server has already paid (or a guest's first solve): shown as a moment. */
const receive = (amount: number, label: string, origin?: { x: number; y: number }) => {
  if (amount <= 0) return;
  balance += amount;
  if (celebrating > 0 && !reducedMotion()) {
    inFlight += amount;
    const id = ++flightSeq;
    flights = [...flights, { id, amount, label, origin, flying: false }];
    window.setTimeout(() => landFlight(id), LAND_BY_MS);
  } else {
    lastChange = { delta: amount, at: Date.now() };
  }
  emit();
};

/**
 * A problem was accepted. For an account the server has decided whether it
 * pays (`awarded`); a guest is paid here, once per problem, from this
 * browser's own record.
 */
export const creditSolve = (
  problem: { id: string; title: string; difficulty: Difficulty },
  awarded: number | undefined,
  origin?: { x: number; y: number }
) => {
  const label = `First solve · ${problem.title}`;
  if (signedIn) {
    receive(awarded ?? 0, label, origin);
    return;
  }
  const ledger = readLedger();
  if (ledger.solves.some((entry) => entry.problemId === problem.id)) return;
  const amount = SOLVE_REWARD[problem.difficulty] ?? SOLVE_REWARD.Easy;
  ledger.solves.unshift({
    problemId: problem.id,
    title: problem.title,
    difficulty: problem.difficulty,
    amount,
    at: new Date().toISOString()
  });
  writeJson(GUEST_LEDGER_KEY, ledger);
  receive(amount, label, origin);
  writeJson(GUEST_KEY, balance);
};

/** Badge tiers the server has just paid for: each lands like a solve does. */
export const creditBadges = (awards: BadgeAward[] | undefined, origin?: { x: number; y: number }) => {
  if (!signedIn) return;
  for (const award of awards ?? []) {
    const tier = award.tiers > 1 ? ` ${BADGE_TIERS[award.tier - 1] ?? ""}` : "";
    receive(award.coins, `Badge · ${award.name}${tier}`, origin);
  }
};

/** Where the coins came from: the account's ledger, or this browser's. */
export const loadBreakdown = async (): Promise<CoinBreakdown> => {
  if (signedIn && token) return api.coinBreakdown(token);
  const ledger = readLedger();
  const coins = readGuest();
  const net = ledger.game.gained - ledger.game.lost;
  const solveTotal = ledger.solves.reduce((sum, entry) => sum + entry.amount, 0);
  return {
    coins,
    game: { net, gained: ledger.game.gained, lost: ledger.game.lost },
    solve: { total: solveTotal, count: ledger.solves.length, recent: ledger.solves.slice(0, 6) },
    earlier: Math.max(0, coins - net - solveTotal),
    rewards: SOLVE_REWARD
  };
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The balance as the counters show it: without coins still in the air. */
export const useCoins = () => useSyncExternalStore(subscribe, () => shown);
export const useLastCoinChange = () => useSyncExternalStore(subscribe, () => lastChange);
export const useCoinFlights = () => useSyncExternalStore(subscribe, () => flights);

/** The celebration layer registers itself; without it, coins count at once. */
export const useCelebrationSlot = () => {
  useEffect(() => {
    celebrating += 1;
    return () => {
      celebrating -= 1;
    };
  }, []);
};

/** Mounted once: follows the session, loads the balance, and sends what is left on the way out. */
export function CoinsSync() {
  const session = useSession();
  useEffect(() => {
    flush();
    token = session.token;
    signedIn = Boolean(session.user && session.token);
    unsent = 0;
    if (!signedIn) {
      balance = readGuest();
      emit();
      return;
    }
    let active = true;
    api
      .coins(session.token)
      .then(({ coins }) => {
        if (!active) return;
        balance = Math.max(0, coins + unsent);
        emit();
      })
      .catch(() => undefined);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [session.token, session.user]);
  return null;
}

// Lets coins be tried from the console while developing.
if (import.meta.env.DEV) {
  (window as unknown as { __noesisCoins?: unknown }).__noesisCoins = {
    earnCoins,
    receive: (amount: number, label = "First solve · Test") => receive(amount, label)
  };
}
