import { useEffect, useState } from "react";
import type { ProgressSummary } from "@nodeflow/shared";
import { api } from "./api";
import { readCached, writeCached } from "./cached";
import { useSession } from "./session";

/**
 * The signed-in learner's progress, shared by the problem list, the dashboard
 * and the problem map.
 *
 * The last copy is shown at once (lib/cached.ts) and replaced when the server
 * answers, so solved marks never sit blank while the request is in flight. One
 * request is shared by every page that asks within the same moment.
 */
let inflight: { token: string; request: Promise<ProgressSummary> } | null = null;

const fetchProgress = (token: string) => {
  if (inflight?.token !== token) {
    const request = api.progress(token).finally(() => {
      if (inflight?.request === request) inflight = null;
    });
    inflight = { token, request };
  }
  return inflight.request;
};

export function useProgress() {
  const session = useSession();
  const owner = session.user?.id ?? "guest";
  const [progress, setProgress] = useState<ProgressSummary | null>(() => readCached<ProgressSummary>("progress", owner));
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setProgress(readCached<ProgressSummary>("progress", owner));
    setError(false);
    if (!session.token) return;
    fetchProgress(session.token)
      .then((summary) => {
        writeCached("progress", owner, summary);
        if (mounted) setProgress(summary);
      })
      .catch(() => mounted && setError(true));
    return () => {
      mounted = false;
    };
  }, [session.token, owner]);

  return { progress, error };
}
