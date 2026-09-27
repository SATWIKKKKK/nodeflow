import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import { useSession } from "./session";

/**
 * The coin balance, shared by every place that shows it.
 *
 * A round of the waiting game changes the real balance the instant it is
 * played; the change is sent to the account in batches a moment later, and the
 * server's answer (which clamps at zero) becomes the balance. Guests keep
 * their coins in this browser.
 *
 * What the counters show lags the real balance by whatever is in the air: a
 * coin earned is first celebrated as a big coin (components/CoinCelebration)
 * and only counted when it lands in a counter. Quick wins in a row join the
 * coin still on show rather than launching one each.
 */

const GUEST_KEY = "noesis:coins";
/** A coin that has not landed by now lands anyway, so nothing is ever lost. */
const LAND_BY_MS = 5000;

export interface CoinFlight {
  id: number;
  amount: number;
  /** Where it was earned, in viewport coordinates. */
  origin?: { x: number; y: number };
  flying: boolean;
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

const readGuest = () => {
  try {
    return Math.max(0, Number(window.localStorage.getItem(GUEST_KEY) ?? "0") || 0);
  } catch {
    return 0;
  }
};

const writeGuest = (value: number) => {
  try {
    window.localStorage.setItem(GUEST_KEY, String(value));
  } catch {
    // Coins still count for this visit.
  }
};

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

/** The coin on show has left for the counter; the next win starts a new one. */
export const launchFlight = (id: number) => {
  flights = flights.map((entry) => (entry.id === id ? { ...entry, flying: true } : entry));
  emit();
};

export const earnCoins = (delta: number, origin?: { x: number; y: number }) => {
  balance = Math.max(0, balance + delta);
  if (delta > 0 && celebrating > 0 && !reducedMotion()) {
    inFlight += delta;
    const showing = flights.find((entry) => !entry.flying);
    if (showing) {
      flights = flights.map((entry) => (entry === showing ? { ...entry, amount: entry.amount + delta } : entry));
    } else {
      const id = ++flightSeq;
      flights = [...flights, { id, amount: delta, origin, flying: false }];
      window.setTimeout(() => landFlight(id), LAND_BY_MS);
    }
  } else {
    lastChange = { delta, at: Date.now() };
  }
  emit();
  if (!signedIn) {
    writeGuest(balance);
    return;
  }
  unsent += delta;
  window.clearTimeout(timer);
  timer = window.setTimeout(flush, 900);
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

// Lets the coin celebration be tried from the console while developing.
if (import.meta.env.DEV) (window as unknown as { __noesisCoins?: unknown }).__noesisCoins = { earnCoins };
