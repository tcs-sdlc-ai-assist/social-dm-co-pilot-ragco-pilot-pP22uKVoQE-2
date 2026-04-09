"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import type { Notification, NotificationType } from "@/types";

// ─── Notification Type Icons ─────────────────────────────────────────────────

function LeadAlertIcon({ className }: { className?: string }) {
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

function SLABreachIcon({ className }: { className?: string }) {
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
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DraftAlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
      <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
    </svg>
  );
}

function SyncConfirmIcon({ className }: { className?: string }) {
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
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
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
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 2a6 6 0 00-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 00.515 1.076 32.91 32.91 0 003.256.508 3.5 3.5 0 006.972 0 32.903 32.903 0 003.256-.508.75.75 0 00.515-1.076A11.448 11.448 0 0116 8a6 6 0 00-6-6zM8.05 14.943a33.54 33.54 0 003.9 0 2 2 0 01-3.9 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNotificationIcon(type: NotificationType): React.ReactNode {
  switch (type) {
    case "lead_created":
      return <LeadAlertIcon className="h-5 w-5 flex-shrink-0 text-red-500" />;
    case "escalation":
      return <SLABreachIcon className="h-5 w-5 flex-shrink-0 text-orange-500" />;
    case "draft_ready":
      return <DraftAlertIcon className="h-5 w-5 flex-shrink-0 text-yellow-500" />;
    case "review_needed":
      return <SyncConfirmIcon className="h-5 w-5 flex-shrink-0 text-green-500" />;
    default:
      return <BellIcon className="h-5 w-5 flex-shrink-0 text-gray-400" />;
  }
}

function getNotificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case "lead_created":
      return "High-Priority Lead";
    case "escalation":
      return "SLA Breach Warning";
    case "draft_ready":
      return "Low-Confidence Draft";
    case "review_needed":
      return "Review Needed";
    default:
      return "Notification";
  }
}

function getNotificationTypeBadgeClasses(type: NotificationType): string {
  switch (type) {
    case "lead_created":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "escalation":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    case "draft_ready":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "review_needed":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  }
}

function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return then.toLocaleDateString();
  }
}

// ─── Notification Item ───────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => Promise<void>;
}

function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  const isUnread = notification.status !== "read";

  const handleClick = () => {
    if (isUnread) {
      void onMarkAsRead(notification.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === "Enter" || e.key === " ") && isUnread) {
      e.preventDefault();
      void onMarkAsRead(notification.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`flex items-start gap-3 px-4 py-3 transition-colors ${
        isUnread
          ? "cursor-pointer bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900"
          : "bg-white dark:bg-gray-800"
      }`}
    >
      <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium ${getNotificationTypeBadgeClasses(notification.type)}`}
          >
            {getNotificationTypeLabel(notification.type)}
          </span>
          {isUnread && (
            <span
              className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-blue-500"
              aria-label="Unread"
            />
          )}
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300">
          {notification.message}
        </p>

        <span className="text-xs text-gray-400 dark:text-gray-500">
          {getRelativeTime(notification.timestamp)}
        </span>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function NotificationEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <BellIcon className="h-10 w-10 text-gray-300 dark:text-gray-600" />
      <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
        No notifications
      </h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        You&apos;re all caught up! New notifications will appear here.
      </p>
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function NotificationSkeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <div className="h-5 w-5 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-4 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="h-3.5 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
            <div className="h-3 w-16 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { notifications, unreadCount, markAsRead, isLoading, error } =
    useNotifications();

  // Sort notifications by timestamp, newest first
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    const unreadNotifications = notifications.filter(
      (n) => n.status !== "read"
    );
    for (const notification of unreadNotifications) {
      await markAsRead(notification.id);
    }
  }, [notifications, markAsRead]);

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close panel on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={togglePanel}
        className="relative inline-flex items-center justify-center rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-2xs font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg animate-slide-down dark:border-gray-700 dark:bg-gray-800 sm:w-96"
          role="dialog"
          aria-label="Notification center"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Notifications
              </h2>
              {unreadCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-2xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllAsRead()}
                className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-800 focus:outline-none focus:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {isLoading ? (
              <NotificationSkeleton />
            ) : error ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            ) : sortedNotifications.length === 0 ? (
              <NotificationEmptyState />
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {sortedNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}