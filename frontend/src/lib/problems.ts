import { useEffect, useState } from "react";
import type { ProblemSummary } from "@nodeflow/shared";
import { api } from "./api";
import { readCached, writeCached } from "./cached";

/**
 * The problem list is fetched by the search bar, the list page, the landing
 * metrics and the workspace. One shared request serves all of them; a failed
 * request is dropped so the next caller retries.
 */
let pending: Promise<ProblemSummary[]> | null = null;

export const loadProblems = () => {
  if (!pending) {
    pending = api
      .problems()
      .then((list) => {
        writeCached("problems", "all", list);
        return list;
      })
      .catch((error) => {
        pending = null;
        throw error;
      });
  }
  return pending;
};

/** The list as last seen, for drawing before the fresh one arrives. */
export const cachedProblems = () => readCached<ProblemSummary[]>("problems", "all") ?? [];

export function useProblems() {
  // Last-known list first, so the page draws at once; the fresh one replaces it.
  const [problems, setProblems] = useState<ProblemSummary[]>(cachedProblems);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => cachedProblems().length === 0);

  useEffect(() => {
    let mounted = true;

    loadProblems()
      .then((list) => {
        if (mounted) setProblems(list);
      })
      .catch((requestError) => {
        if (mounted) {
          setError(requestError instanceof Error ? requestError.message : "Could not load problems.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { problems, error, loading };
}

const STRUCTURE_LABELS: Record<string, string> = {
  array: "Array",
  string: "String",
  matrix: "Matrix",
  linked_list: "Linked list",
  stack: "Stack",
  queue: "Queue",
  hashmap: "Hash map",
  tree: "Tree",
  heap: "Heap",
  graph: "Graph",
  trie: "Trie",
  number: "Number"
};

export const structureLabel = (structureType: string) => STRUCTURE_LABELS[structureType] ?? "Array";
