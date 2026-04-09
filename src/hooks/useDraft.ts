"use client";

import { useState, useEffect, useCallback } from "react";
import type { Draft, APIResponse } from "@/types";
import { API_ROUTES } from "@/constants";

interface UseDraftReturn {
  draft: Draft | null;
  generateDraft: () => Promise<void>;
  editDraft: (editedText: string) => Promise<void>;
  approveDraft: () => Promise<void>;
  isGenerating: boolean;
  isSaving: boolean;
  error: string | null;
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const body: APIResponse<T> = await response.json();

  if (!response.ok || !body.success) {
    throw new Error(body.error ?? `Request failed with status ${response.status}`);
  }

  if (body.data === null) {
    throw new Error("No data returned from server");
  }

  return body.data;
}

export function useDraft(dmId: string): UseDraftReturn {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing draft for the given DM on mount
  useEffect(() => {
    if (!dmId) {
      return;
    }

    let cancelled = false;

    async function loadDraft(): Promise<void> {
      try {
        const drafts = await fetchJSON<Draft[]>(
          `${API_ROUTES.DRAFTS}?dmId=${encodeURIComponent(dmId)}`
        );

        if (!cancelled && Array.isArray(drafts) && drafts.length > 0) {
          setDraft(drafts[0]);
        }
      } catch {
        // No existing draft found — this is not an error condition
        if (!cancelled) {
          setDraft(null);
        }
      }
    }

    loadDraft();

    return () => {
      cancelled = true;
    };
  }, [dmId]);

  const generateDraft = useCallback(async (): Promise<void> => {
    if (!dmId) {
      setError("DM ID is required to generate a draft.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const generated = await fetchJSON<Draft>(API_ROUTES.DRAFTS, {
        method: "POST",
        body: JSON.stringify({ dmId }),
      });

      setDraft(generated);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to generate draft.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }, [dmId]);

  const editDraft = useCallback(
    async (editedText: string): Promise<void> => {
      if (!draft) {
        setError("No draft available to edit.");
        return;
      }

      if (!editedText.trim()) {
        setError("Edited text cannot be empty.");
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        const updated = await fetchJSON<Draft>(
          API_ROUTES.DRAFT_BY_ID(draft.id),
          {
            method: "PATCH",
            body: JSON.stringify({ editedText }),
          }
        );

        setDraft(updated);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to save draft edits.";
        setError(message);
      } finally {
        setIsSaving(false);
      }
    },
    [draft]
  );

  const approveDraft = useCallback(async (): Promise<void> => {
    if (!draft) {
      setError("No draft available to approve.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const approved = await fetchJSON<Draft>(
        API_ROUTES.DRAFT_APPROVE(draft.id),
        {
          method: "POST",
        }
      );

      setDraft(approved);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to approve draft.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }, [draft]);

  return {
    draft,
    generateDraft,
    editDraft,
    approveDraft,
    isGenerating,
    isSaving,
    error,
  };
}

export default useDraft;