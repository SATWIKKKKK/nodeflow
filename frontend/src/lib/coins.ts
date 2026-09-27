import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import { useSession } from "./session";

/**
 * The coin balance, shared by every place that shows it.
 *
 * A round of the waiting game changes the balance on screen the instant it is
 * played; the change is sent to the account in batches a moment later, and the
 * server's answer (which clamps at zero) becomes the balance. Guests keep
 * their coins in this browser.
 */

const GUEST_KEY = "noesis:coins";
const listeners = new Set<() => void>();

let balance = 0;
let token: string | null = null;
let signedIn = false;
let unsent = 0;
let timer: number | undefined;
/** Last change, so a badge can float "+2" or "−1" beside the balance. */
let lastChange = { delta: 0, at: 0 };

const emit = () => listeners.forEach((listener) => listener());

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

export const earnCoins = (delta: number) => {
  balance = Math.max(0, balance + delta);
  lastChange = { delta, at: Date.now() };
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

export const useCoins = () => useSyncExternalStore(subscribe, () => balance);
export const useLastCoinChange = () => useSyncExternalStore(subscribe, () => lastChange);

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
