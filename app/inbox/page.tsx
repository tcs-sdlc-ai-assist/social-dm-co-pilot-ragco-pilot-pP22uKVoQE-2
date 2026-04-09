"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import DMListItem from "@/components/DMListItem";
import InboxFilters, { type InboxFilterValues } from "@/components/InboxFilters";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useInbox, type InboxFilters as InboxFilterParams } from "@/hooks/useInbox";
import { useAuth } from "@/hooks/useAuth";
import type { DMStatus } from "@/types";

function mapFiltersToHookParams(filters: InboxFilterValues): InboxFilterParams {
  return {
    status: filters.status !== "all" ? (filters.status as DMStatus) : undefined,
    platform: filters.platform !== "all" ? filters.platform : undefined,
    search: filters.search.trim().length > 0 ? filters.search.trim() : undefined,
    pageSize: 20,
  };
}

function sortDMs(
  dms: ReturnType<typeof useInbox>["dms"],
  sort: InboxFilterValues["sort"]
) {
  const sorted = [...dms];
  switch (sort) {
    case "newest":
      sorted.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      break;
    case "oldest":
      sorted.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      break;
    case "priority": {
      const priorityOrder: Record<string, number> = {
        escalated: 0,
        new: 1,
        drafted: 2,
        sent: 3,
      };
      sorted.sort(
        (a, b) =>
          (priorityOrder[a.status] ?? 99) - (priorityOrder[b.status] ?? 99)
      );
      break;
    }
    default:
      break;
  }
  return sorted;
}

export default function InboxPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [filters, setFilters] = useState<InboxFilterValues>({
    status: "all",
    platform: "all",
    search: "",
    sort: "newest",
  });

  const hookParams = mapFiltersToHookParams(filters);
  const { dms, isLoading, error, totalCount, currentPage, setPage } =
    useInbox(hookParams);

  const handleFilterChange = useCallback((newFilters: InboxFilterValues) => {
    setFilters(newFilters);
  }, []);

  const sortedDMs = sortDMs(dms, filters.sort);

  const unreadCount = dms.filter((dm) => dm.status === "new").length;

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Auth guard — redirect to home if not authenticated
  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" label="Checking authentication…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push("/");
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            DM Inbox
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalCount} {totalCount === 1 ? "message" : "messages"} total
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                {unreadCount} new
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <InboxFilters filters={filters} onFilterChange={handleFilterChange} />
      </div>

      {/* Error State */}
      {error && (
        <div
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <div className="flex items-center">
            <svg
              className="mr-2 h-5 w-5 flex-shrink-0 text-red-500"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" label="Loading messages…" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && sortedDMs.length === 0 && (
        <EmptyState
          icon={
            <svg
              className="h-12 w-12"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          }
          title="No messages found"
          description="There are no direct messages matching your current filters. Try adjusting your filters or check back later."
        />
      )}

      {/* DM List */}
      {!isLoading && sortedDMs.length > 0 && (
        <div className="space-y-3">
          {sortedDMs.map((dm) => (
            <DMListItem key={dm.id} dm={dm} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <nav
          className="mt-6 flex items-center justify-center gap-2"
          aria-label="Inbox pagination"
        >
          <button
            type="button"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((page) => {
              if (totalPages <= 5) return true;
              if (page === 1 || page === totalPages) return true;
              if (Math.abs(page - currentPage) <= 1) return true;
              return false;
            })
            .reduce<(number | "ellipsis")[]>((acc, page, idx, arr) => {
              if (idx > 0) {
                const prev = arr[idx - 1];
                if (page - prev > 1) {
                  acc.push("ellipsis");
                }
              }
              acc.push(page);
              return acc;
            }, [])
            .map((item, idx) => {
              if (item === "ellipsis") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 text-sm text-gray-400"
                  >
                    …
                  </span>
                );
              }
              const page = item;
              const isActive = page === currentPage;
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => setPage(page)}
                  disabled={isActive}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={`Page ${page}`}
                >
                  {page}
                </button>
              );
            })}

          <button
            type="button"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}