import { useEffect, useState } from "react";
import type { PublicProblem } from "@nodeflow/shared";
import { api } from "./api";

/**
 * The problem list is fetched by the search bar, the list page, the landing
 * metrics and the workspace. One shared request serves all of them; a failed
 * request is dropped so the next caller retries.
 */
let pending: Promise<PublicProblem[]> | null = null;

export const loadProblems = () => {
  if (!pending) {
    pending = api.problems().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
};

export function useProblems() {
  const [problems, setProblems] = useState<PublicProblem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
