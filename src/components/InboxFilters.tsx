"use client";

import { useState, useCallback } from "react";
import type { DMStatus } from "@/types";

// ─── Filter Types ────────────────────────────────────────────────────────────

export type SortOption = "newest" | "oldest" | "priority";

export interface InboxFilterValues {
  status: DMStatus | "all";
  platform: string;
  search: string;
  sort: SortOption;
}

interface InboxFiltersProps {
  filters: InboxFilterValues;
  onFilterChange: (filters: InboxFilterValues) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { label: string; value: DMStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "Drafted", value: "drafted" },
  { label: "Sent", value: "sent" },
  { label: "Escalated", value: "escalated" },
];

const PLATFORM_OPTIONS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Facebook", value: "facebook" },
  { label: "Instagram", value: "instagram" },
];

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Newest First", value: "newest" },
  { label: "Oldest First", value: "oldest" },
  { label: "Priority", value: "priority" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function InboxFilters({ filters, onFilterChange }: InboxFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search);

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as DMStatus | "all";
      onFilterChange({ ...filters, status: value });
    },
    [filters, onFilterChange],
  );

  const handlePlatformChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ ...filters, platform: e.target.value });
    },
    [filters, onFilterChange],
  );

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as SortOption;
      onFilterChange({ ...filters, sort: value });
    },
    [filters, onFilterChange],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchValue(value);
      onFilterChange({ ...filters, search: value });
    },
    [filters, onFilterChange],
  );

  const handleClearSearch = useCallback(() => {
    setSearchValue("");
    onFilterChange({ ...filters, search: "" });
  }, [filters, onFilterChange]);

  const handleResetFilters = useCallback(() => {
    const defaultFilters: InboxFilterValues = {
      status: "all",
      platform: "all",
      search: "",
      sort: "newest",
    };
    setSearchValue("");
    onFilterChange(defaultFilters);
  }, [onFilterChange]);

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.platform !== "all" ||
    filters.search.trim().length > 0 ||
    filters.sort !== "newest";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <label htmlFor="inbox-search" className="sr-only">
            Search messages
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg
              className="h-4 w-4 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <input
            id="inbox-search"
            type="text"
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Search by sender or content…"
            className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-9 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
          />
          {searchValue.length > 0 && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Clear search"
            >
              <svg
                className="h-4 w-4"
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
            </button>
          )}
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="inbox-status-filter"
            className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
          >
            Status
          </label>
          <select
            id="inbox-status-filter"
            value={filters.status}
            onChange={handleStatusChange}
            className="rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Platform Dropdown */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="inbox-platform-filter"
            className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
          >
            Platform
          </label>
          <select
            id="inbox-platform-filter"
            value={filters.platform}
            onChange={handlePlatformChange}
            className="rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="inbox-sort"
            className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
          >
            Sort
          </label>
          <select
            id="inbox-sort"
            value={filters.sort}
            onChange={handleSortChange}
            className="rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reset Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
          >
            <svg
              className="h-3.5 w-3.5"
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
            Reset
          </button>
        )}
      </div>
    </div>
  );
}