import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** Shared with the bootstrap script in index.html, which applies it before first paint. */
const STORAGE_KEY = "theme_preference";
const CHANGE_EVENT = "noesis:themechange";

const readPreference = (): ThemePreference => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    // Blocked storage: fall through to the default.
  }
  return "light";
};

const systemPrefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

const resolve = (preference: ThemePreference): ResolvedTheme =>
  preference === "dark" || (preference === "system" && systemPrefersDark()) ? "dark" : "light";

const apply = (preference: ThemePreference) => {
  const resolved = resolve(preference);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = preference;
  root.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#050505" : "#fbf9f9");
  return resolved;
};

/**
 * Theme state for any component. Every hook instance stays in sync through a
 * window event, so the navbar toggle and the 3D scene never disagree.
 */
export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(readPreference()));

  useEffect(() => {
    const sync = () => {
      const next = readPreference();
      setPreferenceState(next);
      setResolved(apply(next));
    };

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    media?.addEventListener("change", sync);

    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
      media?.removeEventListener("change", sync);
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this page view.
    }
    setPreferenceState(next);
    setResolved(apply(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolve(readPreference()) === "dark" ? "light" : "dark");
  }, [setPreference]);

  return { preference, resolved, setPreference, toggle };
}
