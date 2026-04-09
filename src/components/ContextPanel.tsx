"use client";

import { useState } from "react";
import type { KnowledgeBaseEntry } from "@/types";

interface ContextPanelProps {
  entries: KnowledgeBaseEntry[];
  isLoading?: boolean;
}

interface RelevanceIndicatorProps {
  category: string;
}

function RelevanceIndicator({ category }: RelevanceIndicatorProps) {
  const colorMap: Record<string, string> = {
    property: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    faq: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    pricing: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    policy: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  };

  const colorClass =
    colorMap[category.toLowerCase()] ??
    "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {category}
    </span>
  );
}

interface ContextEntryCardProps {
  entry: KnowledgeBaseEntry;
}

function ContextEntryCard({ entry }: ContextEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded-lg"
        aria-expanded={isExpanded}
      >
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <RelevanceIndicator category={entry.category} />
            <h3 className="text-sm font-semibold text-gray-900 truncate dark:text-gray-100">
              {entry.title}
            </h3>
          </div>
          {!isExpanded && entry.keywords.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {entry.keywords.slice(0, 3).map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                  {keyword}
                </span>
              ))}
              {entry.keywords.length > 3 && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  +{entry.keywords.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
        <svg
          className={`ml-2 h-5 w-5 flex-shrink-0 text-gray-400 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isExpanded && (
        <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
          <p className="text-sm text-gray-700 whitespace-pre-wrap dark:text-gray-300">
            {entry.content}
          </p>
          {entry.keywords.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Keywords:
              </span>
              {entry.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex items-center gap-2">
            <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
          <div className="mt-2 flex gap-1">
            <div className="h-4 w-12 rounded bg-gray-100 dark:bg-gray-700" />
            <div className="h-4 w-14 rounded bg-gray-100 dark:bg-gray-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-10 text-center dark:border-gray-600">
      <svg
        className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500"
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
          d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
        />
      </svg>
      <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
        No context found
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        No relevant knowledge base entries were found for this message.
      </p>
    </div>
  );
}

export default function ContextPanel({ entries, isLoading = false }: ContextPanelProps) {
  const categories = Array.from(new Set(entries.map((e) => e.category)));

  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Knowledge Base Context
        </h2>
        {!isLoading && entries.length > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      {!isLoading && categories.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map((category) => (
            <RelevanceIndicator key={category} category={category} />
          ))}
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton />
      ) : entries.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <ContextEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </aside>
  );
}