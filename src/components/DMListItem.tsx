"use client";

import { useRouter } from "next/navigation";
import { DM } from "@/types";

interface DMListItemProps {
  dm: DM;
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

function truncateMessage(content: string, maxLength: number = 80): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength).trimEnd() + "…";
}

function getStatusBadgeClasses(status: DM["status"]): string {
  switch (status) {
    case "new":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "drafted":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "sent":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "escalated":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
}

function getStatusLabel(status: DM["status"]): string {
  switch (status) {
    case "new":
      return "New";
    case "drafted":
      return "Drafted";
    case "sent":
      return "Sent";
    case "escalated":
      return "Escalated";
    default:
      return status;
  }
}

function PlatformIcon({ platform }: { platform: string }) {
  const normalized = platform.toLowerCase();

  if (normalized === "facebook" || normalized === "fb") {
    return (
      <svg
        className="h-4 w-4 flex-shrink-0 text-blue-600"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-label="Facebook"
      >
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }

  if (normalized === "instagram" || normalized === "ig") {
    return (
      <svg
        className="h-4 w-4 flex-shrink-0 text-pink-600"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-label="Instagram"
      >
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    );
  }

  return (
    <svg
      className="h-4 w-4 flex-shrink-0 text-gray-500"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-label={platform}
    >
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
    </svg>
  );
}

function SenderAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
      {initials}
    </div>
  );
}

function PriorityIndicator({ status }: { status: DM["status"] }) {
  if (status === "escalated") {
    return (
      <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-red-500" aria-label="High priority" />
    );
  }
  if (status === "new") {
    return (
      <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" aria-label="New message" />
    );
  }
  return null;
}

export default function DMListItem({ dm }: DMListItemProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/dm/${dm.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750"
    >
      <SenderAvatar name={dm.senderName} />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <PriorityIndicator status={dm.status} />
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {dm.senderName}
          </span>
          <span className="truncate text-xs text-gray-500 dark:text-gray-400">
            @{dm.senderHandle}
          </span>
          <PlatformIcon platform={dm.platform} />
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300">
          {truncateMessage(dm.content)}
        </p>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClasses(dm.status)}`}
          >
            {getStatusLabel(dm.status)}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {getRelativeTime(dm.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}