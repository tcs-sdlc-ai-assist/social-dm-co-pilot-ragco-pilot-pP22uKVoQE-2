"use client";

import { useState, useEffect, useCallback } from "react";
import type { CandidateLead, Lead, APIResponse } from "@/types";
import { API_ROUTES } from "@/constants";

interface UseLeadsReturn {
  candidateLead: CandidateLead | null;
  lead: Lead | null;
  extractLead: () => Promise<CandidateLead | null>;
  confirmLead: (candidate: CandidateLead) => Promise<Lead | null>;
  syncToSalesforce: (leadId: string) => Promise<Lead | null>;
  isExtracting: boolean;
  isConfirming: boolean;
  isSyncing: boolean;
  error: string | null;
}

export function useLeads(dmId?: string): UseLeadsReturn {
  const [candidateLead, setCandidateLead] = useState<CandidateLead | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dmId changes
  useEffect(() => {
    setCandidateLead(null);
    setLead(null);
    setError(null);
  }, [dmId]);

  const extractLead = useCallback(async (): Promise<CandidateLead | null> => {
    if (!dmId) {
      setError("No DM ID provided for lead extraction.");
      return null;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const response = await fetch(API_ROUTES.LEADS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dmId, action: "extract" }),
      });

      const result: APIResponse<CandidateLead> = await response.json();

      if (!response.ok || !result.success || !result.data) {
        const errorMessage = result.error ?? `Failed to extract lead (${response.status})`;
        setError(errorMessage);
        return null;
      }

      setCandidateLead(result.data);
      return result.data;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred during lead extraction.";
      setError(errorMessage);
      return null;
    } finally {
      setIsExtracting(false);
    }
  }, [dmId]);

  const confirmLead = useCallback(
    async (candidate: CandidateLead): Promise<Lead | null> => {
      setIsConfirming(true);
      setError(null);

      try {
        const response = await fetch(API_ROUTES.LEADS, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...candidate, action: "confirm" }),
        });

        const result: APIResponse<Lead> = await response.json();

        if (!response.ok || !result.success || !result.data) {
          const errorMessage = result.error ?? `Failed to confirm lead (${response.status})`;
          setError(errorMessage);
          return null;
        }

        setLead(result.data);
        return result.data;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "An unexpected error occurred during lead confirmation.";
        setError(errorMessage);
        return null;
      } finally {
        setIsConfirming(false);
      }
    },
    [],
  );

  const syncToSalesforce = useCallback(
    async (leadId: string): Promise<Lead | null> => {
      setIsSyncing(true);
      setError(null);

      try {
        const syncUrl = `${API_ROUTES.LEAD_BY_ID(leadId)}/sync`;
        const response = await fetch(syncUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const result: APIResponse<Lead> = await response.json();

        if (!response.ok || !result.success || !result.data) {
          const errorMessage = result.error ?? `Failed to sync lead to Salesforce (${response.status})`;
          setError(errorMessage);
          return null;
        }

        setLead(result.data);
        return result.data;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "An unexpected error occurred during Salesforce sync.";
        setError(errorMessage);
        return null;
      } finally {
        setIsSyncing(false);
      }
    },
    [],
  );

  return {
    candidateLead,
    lead,
    extractLead,
    confirmLead,
    syncToSalesforce,
    isExtracting,
    isConfirming,
    isSyncing,
    error,
  };
}

export default useLeads;