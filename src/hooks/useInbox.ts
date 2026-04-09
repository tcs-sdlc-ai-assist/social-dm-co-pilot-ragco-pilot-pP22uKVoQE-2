"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { DM, DMStatus, PaginatedResponse } from "@/types";
import { POLLING_INTERVAL_MS } from "@/constants";

// ─── Filter Types ────────────────────────────────────────────────────────────

export interface InboxFilters {
  status?: DMStatus;
  platform?: string;
  search?: string;
  pageSize?: number;
}

// ─── Hook Return Type ────────────────────────────────────────────────────────

export interface UseInboxReturn {
  dms: DM[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  totalCount: number;
  currentPage: number;
  setPage: (page: number) => void;
}

// ─── Build Query String ──────────────────────────────────────────────────────

function buildQueryString(filters: InboxFilters, page: number): string {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("pageSize", String(filters.pageSize ?? 20));

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.platform) {
    params.set("platform", filters.platform);
  }

  if (filters.search && filters.search.trim().length > 0) {
    params.set("search", filters.search.trim());
  }

  return params.toString();
}

// ─── Hook Implementation ─────────────────────────────────────────────────────

export function useInbox(filters: InboxFilters = {}): UseInboxReturn {
  const [dms, setDms] = useState<DM[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filtersRef = useRef<InboxFilters>(filters);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update filters ref when filters change
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.status, filters.platform, filters.search]);

  const fetchInbox = useCallback(async (isPolling = false): Promise<void> => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!isPolling) {
      setIsLoading(true);
    }

    try {
      const queryString = buildQueryString(filtersRef.current, currentPage);
      const response = await fetch(`/api/dms?${queryString}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const errorMessage =
          errorBody && typeof errorBody === "object" && "error" in errorBody
            ? String(errorBody.error)
            : `Failed to fetch inbox (${response.status})`;
        setError(errorMessage);
        return;
      }

      const body = (await response.json()) as PaginatedResponse<DM>;

      if (!body.success) {
        setError(body.error ?? "Failed to fetch inbox");
        return;
      }

      setDms(body.data);
      setTotalCount(body.pagination.totalItems);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Request was aborted — ignore
        return;
      }

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while fetching inbox");
      }
    } finally {
      if (!controller.signal.aborted && !isPolling) {
        setIsLoading(false);
      }
      if (!controller.signal.aborted && isPolling) {
        setIsLoading(false);
      }
    }
  }, [currentPage]);

  const refetch = useCallback(async (): Promise<void> => {
    await fetchInbox(false);
  }, [fetchInbox]);

  const setPage = useCallback((page: number): void => {
    if (page < 1) {
      return;
    }
    setCurrentPage(page);
  }, []);

  // Initial fetch and re-fetch when page changes
  useEffect(() => {
    fetchInbox(false);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchInbox]);

  // Polling
  useEffect(() => {
    pollingIntervalRef.current = setInterval(() => {
      fetchInbox(true);
    }, POLLING_INTERVAL_MS);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [fetchInbox]);

  return {
    dms,
    isLoading,
    error,
    refetch,
    totalCount,
    currentPage,
    setPage,
  };
}

export default useInbox;