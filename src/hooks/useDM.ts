"use client";

import { useState, useEffect, useCallback } from "react";
import type { DM, KnowledgeBaseEntry, Draft } from "@/types";

interface UseDMResult {
  dm: DM | null;
  context: KnowledgeBaseEntry[];
  draft: Draft | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDM(dmId: string): UseDMResult {
  const [dm, setDM] = useState<DM | null>(null);
  const [context, setContext] = useState<KnowledgeBaseEntry[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDM = useCallback(async () => {
    if (!dmId) {
      setDM(null);
      setContext([]);
      setDraft(null);
      setIsLoading(false);
      setError("No DM ID provided.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/dm/${dmId}`);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const errorMessage =
          errorBody?.error ?? `Failed to fetch DM: ${response.status} ${response.statusText}`;
        setError(errorMessage);
        setDM(null);
        setContext([]);
        setDraft(null);
        return;
      }

      const json = await response.json();

      if (!json.success) {
        setError(json.error ?? "An unknown error occurred.");
        setDM(null);
        setContext([]);
        setDraft(null);
        return;
      }

      const data = json.data;

      setDM(data.dm ?? null);
      setContext(data.context ?? []);
      setDraft(data.draft ?? null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while fetching the DM.");
      }
      setDM(null);
      setContext([]);
      setDraft(null);
    } finally {
      setIsLoading(false);
    }
  }, [dmId]);

  useEffect(() => {
    void fetchDM();
  }, [fetchDM]);

  return {
    dm,
    context,
    draft,
    isLoading,
    error,
    refetch: fetchDM,
  };
}

export default useDM;