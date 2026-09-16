import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser } from "@nodeflow/shared";
import { api } from "./api";

const sessionKey = "noesis:session";

interface StoredSession {
  token: string;
  user: AuthUser;
}

interface SessionContextValue {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const readStoredSession = (): StoredSession | null => {
  try {
    const raw = window.localStorage.getItem(sessionKey);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredSession()?.token ?? null);
  const [user, setUser] = useState<AuthUser | null>(() => readStoredSession()?.user ?? null);
  const [loading, setLoading] = useState(Boolean(token));

  const persist = (next: StoredSession | null) => {
    if (!next) {
      window.localStorage.removeItem(sessionKey);
      setToken(null);
      setUser(null);
      return;
    }

    window.localStorage.setItem(sessionKey, JSON.stringify(next));
    setToken(next.token);
    setUser(next.user);
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;
    api
      .me(token)
      .then((response) => {
        if (!active) return;
        if (!response.user) {
          persist(null);
          return;
        }
        setUser(response.user);
        window.localStorage.setItem(sessionKey, JSON.stringify({ token, user: response.user }));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const value = useMemo<SessionContextValue>(
    () => ({
      token,
      user,
      loading,
      signIn: async (email, password) => {
        const response = await api.signIn(email, password);
        persist(response);
      },
      signUp: async (email, password) => {
        const response = await api.signUp(email, password);
        persist(response);
      },
      signOut: async () => {
        await api.signOut(token);
        persist(null);
      }
    }),
    [loading, token, user]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return context;
};
