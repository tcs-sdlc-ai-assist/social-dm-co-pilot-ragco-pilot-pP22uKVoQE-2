"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import useNotifications from "@/hooks/useNotifications";
import useAuth from "@/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";
import StatusBadge from "@/components/StatusBadge";
import type { Notification, NotificationType } from "@/types";

// ─── Filter Types ────────────────────────────────────────────────────────────

interface NotificationFilters {
  type: NotificationType | "all";
  dateFrom: string;
  dateTo: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { label: string; value: NotificationType | "all" }[] = [
  { label: "All Types", value: "all" },
  { label: "Lead Created", value: "lead_created" },
  { label: "Draft Ready", value: "draft_ready" },
  { label: "Escalation", value: "escalation" },
  { label: "Review Needed", value: "review_needed" },
];

const TYPE_LABELS: Record<NotificationType, string> = {
  lead_created: "Lead Created",
  draft_ready: "Draft Ready",
  escalation: "Escalation",
  review_needed: "Review Needed",
};

// ─── Icon Components ─────────────────────────────────────────────────────────

function LeadCreatedIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
    </svg>
  );
}

function DraftReadyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function EscalationIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ReviewNeededIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
      />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTypeIcon(type: NotificationType): React.ReactNode {
  switch (type) {
    case "lead_created":
      return <LeadCreatedIcon className="h-5 w-5 text-blue-600" />;
    case "draft_ready":
      return <DraftReadyIcon className="h-5 w-5 text-green-600" />;
    case "escalation":
      return <EscalationIcon className="h-5 w-5 text-red-600" />;
    case "review_needed":
      return <ReviewNeededIcon className="h-5 w-5 text-yellow-600" />;
    default:
      return <BellIcon className="h-5 w-5 text-gray-500" />;
  }
}

function getTypeIconBgClass(type: NotificationType): string {
  switch (type) {
    case "lead_created":
      return "bg-blue-100 dark:bg-blue-900";
    case "draft_ready":
      return "bg-green-100 dark:bg-green-900";
    case "escalation":
      return "bg-red-100 dark:bg-red-900";
    case "review_needed":
      return "bg-yellow-100 dark:bg-yellow-900";
    default:
      return "bg-gray-100 dark:bg-gray-800";
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return "Just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatFullTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Notification Item Component ─────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => Promise<void>;
  onNavigate: (notification: Notification) => void;
}

function NotificationItem({ notification, onMarkAsRead, onNavigate }: NotificationItemProps) {
  const isUnread = notification.status !== "read";

  const handleClick = () => {
    if (isUnread) {
      void onMarkAsRead(notification.id);
    }
    onNavigate(notification);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const handleMarkRead = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    void onMarkAsRead(notification.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`flex items-start gap-4 rounded-lg border p-4 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        isUnread
          ? "border-blue-200 bg-blue-50/50 hover:bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 dark:hover:bg-blue-950/50"
          : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750"
      }`}
    >
      {/* Type Icon */}
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${getTypeIconBgClass(notification.type)}`}
      >
        {getTypeIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm font-medium ${
              isUnread
                ? "text-gray-900 dark:text-gray-100"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            {TYPE_LABELS[notification.type]}
          </span>
          <StatusBadge status={notification.status} size="sm" />
          <StatusBadge status={notification.channel} size="sm" />
        </div>

        <p
          className={`text-sm ${
            isUnread
              ? "text-gray-800 dark:text-gray-200"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {notification.message}
        </p>

        <div className="flex items-center gap-3 mt-1">
          <span
            className="text-xs text-gray-400 dark:text-gray-500"
            title={formatFullTimestamp(notification.timestamp)}
          >
            {formatTimestamp(notification.timestamp)}
          </span>

          {notification.relatedLeadId && (
            <span className="text-xs text-blue-500 dark:text-blue-400">
              Lead: {notification.relatedLeadId}
            </span>
          )}
        </div>
      </div>

      {/* Unread Indicator & Actions */}
      <div className="flex flex-shrink-0 items-center gap-2">
        {isUnread && (
          <>
            <span
              className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500"
              aria-label="Unread notification"
            />
            <button
              type="button"
              onClick={handleMarkRead}
              className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              aria-label={`Mark notification as read: ${notification.message}`}
            >
              Mark read
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function NotificationsEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-16 text-center dark:border-gray-600">
      <BellIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {hasFilters ? "No matching notifications" : "No notifications yet"}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        {hasFilters
          ? "Try adjusting your filters to see more notifications."
          : "When there are new leads, drafts, escalations, or reviews, notifications will appear here."}
      </p>
    </div>
  );
}

// ─── Login Prompt ────────────────────────────────────────────────────────────

function LoginPrompt() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Authentication Required
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Please sign in to view your notifications.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-6 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
        >
          Go to Sign In
        </button>
      </div>
    </div>
  );
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { notifications, unreadCount, markAsRead, isLoading, error } = useNotifications();

  const [filters, setFilters] = useState<NotificationFilters>({
    type: "all",
    dateFrom: "",
    dateTo: "",
  });

  // ─── Filter Handlers ────────────────────────────────────────────────────

  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setFilters((prev) => ({
        ...prev,
        type: e.target.value as NotificationType | "all",
      }));
    },
    [],
  );

  const handleDateFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, dateFrom: e.target.value }));
    },
    [],
  );

  const handleDateToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, dateTo: e.target.value }));
    },
    [],
  );

  const handleResetFilters = useCallback(() => {
    setFilters({ type: "all", dateFrom: "", dateTo: "" });
  }, []);

  // ─── Filtered Notifications ─────────────────────────────────────────────

  const hasActiveFilters =
    filters.type !== "all" ||
    filters.dateFrom.length > 0 ||
    filters.dateTo.length > 0;

  const filteredNotifications = useMemo(() => {
    let result = [...notifications];

    if (filters.type !== "all") {
      result = result.filter((n) => n.type === filters.type);
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom).getTime();
      result = result.filter((n) => new Date(n.timestamp).getTime() >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      const toTime = toDate.getTime();
      result = result.filter((n) => new Date(n.timestamp).getTime() <= toTime);
    }

    // Sort by timestamp descending (most recent first)
    result.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return result;
  }, [notifications, filters]);

  // ─── Navigation Handler ─────────────────────────────────────────────────

  const handleNavigate = useCallback(
    (notification: Notification) => {
      if (notification.relatedLeadId) {
        router.push(`/leads`);
      } else if (notification.type === "draft_ready" || notification.type === "review_needed") {
        router.push(`/inbox`);
      } else if (notification.type === "escalation") {
        router.push(`/inbox`);
      } else {
        router.push(`/inbox`);
      }
    },
    [router],
  );

  // ─── Auth Guard ─────────────────────────────────────────────────────────

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" label="Checking authentication…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
              {unreadCount} unread
            </span>
          )}
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {filteredNotifications.length}{" "}
          {filteredNotifications.length === 1 ? "notification" : "notifications"}
        </span>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
          {/* Type Filter */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="notification-type-filter"
              className="text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              Type
            </label>
            <select
              id="notification-type-filter"
              value={filters.type}
              onChange={handleTypeChange}
              className="rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="notification-date-from"
              className="text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              From
            </label>
            <input
              id="notification-date-from"
              type="date"
              value={filters.dateFrom}
              onChange={handleDateFromChange}
              className="rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="notification-date-to"
              className="text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              To
            </label>
            <input
              id="notification-date-to"
              type="date"
              value={filters.dateTo}
              onChange={handleDateToChange}
              className="rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Reset Filters */}
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

      {/* Error State */}
      {error && (
        <div
          className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30"
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
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" label="Loading notifications…" />
        </div>
      )}

      {/* Notification List */}
      {!isLoading && filteredNotifications.length === 0 && (
        <NotificationsEmptyState hasFilters={hasActiveFilters} />
      )}

      {!isLoading && filteredNotifications.length > 0 && (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={markAsRead}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}