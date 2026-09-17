import { useEffect, useState } from "react";
import { api } from "./api";

export interface ServerStatus {
  /** False on deployments without Docker: Run, Test, Submit and previews cannot execute. */
  sandbox: boolean;
  /** False where the server cannot store accounts. */
  accounts: boolean;
}

// Assume a full server until told otherwise, so local development never flashes a warning.
const FULL: ServerStatus = { sandbox: true, accounts: true };
let pending: Promise<ServerStatus> | null = null;

const loadStatus = () => {
  if (!pending) {
    pending = api
      .health()
      .then((health) => ({ sandbox: health.sandbox !== false, accounts: health.accounts !== false }))
      .catch(() => FULL);
  }
  return pending;
};

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>(FULL);
  useEffect(() => {
    let mounted = true;
    void loadStatus().then((value) => mounted && setStatus(value));
    return () => {
      mounted = false;
    };
  }, []);
  return status;
}
