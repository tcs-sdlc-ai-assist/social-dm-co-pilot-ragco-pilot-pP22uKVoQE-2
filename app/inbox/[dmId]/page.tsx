"use client";

import { useRouter } from "next/navigation";
import { useDM } from "@/hooks/useDM";
import { useAuth } from "@/hooks/useAuth";
import DraftComposer from "@/components/DraftComposer";
import ContextPanel from "@/components/ContextPanel";
import LeadCaptureSidebar from "@/components/LeadCaptureSidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import StatusBadge from "@/components/StatusBadge";
import type { DM } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFullTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    return then.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
}

// ─── Platform Icon ───────────────────────────────────────────────────────────

function PlatformIcon({ platform }: { platform: string }) {
  const normalized = platform.toLowerCase();

  if (normalized === "facebook" || normalized === "fb") {
    return (
      <svg
        className="h-5 w-5 flex-shrink-0 text-blue-600"
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
        className="h-5 w-5 flex-shrink-0 text-pink-600"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-label="Instagram"
      >
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    );
  }

  if (normalized === "twitter" || normalized === "x") {
    return (
      <svg
        className="h-5 w-5 flex-shrink-0 text-gray-800"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-label="Twitter/X"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }

  if (normalized === "linkedin") {
    return (
      <svg
        className="h-5 w-5 flex-shrink-0 text-blue-700"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-label="LinkedIn"
      >
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    );
  }

  return (
    <svg
      className="h-5 w-5 flex-shrink-0 text-gray-500"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-label={platform}
    >
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
    </svg>
  );
}

function getPlatformLabel(platform: string): string {
  const normalized = platform.toLowerCase();
  const labels: Record<string, string> = {
    facebook: "Facebook",
    fb: "Facebook",
    instagram: "Instagram",
    ig: "Instagram",
    twitter: "Twitter / X",
    x: "Twitter / X",
    linkedin: "LinkedIn",
  };
  return labels[normalized] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
}

// ─── Sender Avatar ───────────────────────────────────────────────────────────

function SenderAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-base font-semibold text-emerald-800">
      {initials}
    </div>
  );
}

// ─── DM Content Panel ────────────────────────────────────────────────────────

function DMContentPanel({ dm }: { dm: DM }) {
  return (
    <div className="card space-y-4">
      {/* Sender Info */}
      <div className="flex items-start gap-3">
        <SenderAvatar name={dm.senderName} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {dm.senderName}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {dm.senderHandle.startsWith("@") ? dm.senderHandle : `@${dm.senderHandle}`}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <PlatformIcon platform={dm.platform} />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {getPlatformLabel(dm.platform)}
            </span>
            <span className="text-xs text-gray-300 dark:text-gray-600">•</span>
            <span
              className="text-xs text-gray-500 dark:text-gray-400"
              title={formatFullTimestamp(dm.timestamp)}
            >
              {getRelativeTime(dm.timestamp)}
            </span>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <StatusBadge status={dm.status} size="md" />
        </div>
      </div>

      {/* Full Timestamp */}
      <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Received {formatFullTimestamp(dm.timestamp)}
        </p>
      </div>

      {/* Message Content */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
          {dm.content}
        </p>
      </div>

      {/* Conversation Thread Placeholder */}
      <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-gray-400 dark:text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293a.783.783 0 01.642-.413 41.102 41.102 0 003.55-.414c1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2zM6.75 6a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 2.5a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            1 message in this conversation
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Back Button ─────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
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
          d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
          clipRule="evenodd"
        />
      </svg>
      Back to Inbox
    </button>
  );
}

// ─── Error State ─────────────────────────────────────────────────────────────

function ErrorState({
  error,
  onRetry,
  onBack,
}: {
  error: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 dark:border-red-800 dark:bg-red-900/20">
        <svg
          className="mx-auto h-12 w-12 text-red-400"
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
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-semibold text-red-800 dark:text-red-200">
          Failed to load message
        </h3>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary text-sm"
          >
            Back to Inbox
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="btn-primary text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Not Found State ─────────────────────────────────────────────────────────

function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
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
        <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Message not found
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          The message you are looking for does not exist or has been removed.
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={onBack}
            className="btn-primary text-sm"
          >
            Back to Inbox
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function DMDetailPage({
  params,
}: {
  params: { dmId: string };
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { dm, context, isLoading, error, refetch } = useDM(params.dmId);

  const handleBack = () => {
    router.push("/inbox" as never);
  };

  const handleSend = (text: string) => {
    // In a real implementation, this would call an API to send the reply
    console.log("Sending reply:", text);
    router.push("/inbox" as never);
  };

  const handleEscalate = () => {
    // In a real implementation, this would call an API to escalate the DM
    console.log("Escalating DM:", params.dmId);
    router.push("/inbox" as never);
  };

  // Auth guard
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

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" label="Loading message…" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <ErrorState error={error} onRetry={() => void refetch()} onBack={handleBack} />
    );
  }

  // Not found state
  if (!dm) {
    return <NotFoundState onBack={handleBack} />;
  }

  return (
    <div className="mx-auto max-w-9xl px-4 py-6 sm:px-6 lg:px-8 animate-fade-in">
      {/* Header with Back Button */}
      <div className="mb-4 flex items-center justify-between">
        <BackButton onClick={handleBack} />
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ID: {dm.id}
          </span>
        </div>
      </div>

      {/* Three-Panel Layout */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left + Center: DM Content + Draft Composer */}
        <div className="flex flex-1 flex-col gap-6 min-w-0">
          {/* DM Content */}
          <DMContentPanel dm={dm} />

          {/* Draft Composer */}
          <DraftComposer
            dmId={dm.id}
            contextEntries={context}
            onSend={handleSend}
            onEscalate={handleEscalate}
          />
        </div>

        {/* Right: Context Panel + Lead Capture Sidebar */}
        <div className="flex w-full flex-shrink-0 flex-col gap-6 lg:w-80 xl:w-96">
          {/* Context Panel */}
          <ContextPanel entries={context} isLoading={false} />

          {/* Lead Capture Sidebar */}
          <LeadCaptureSidebar dmId={dm.id} />
        </div>
      </div>
    </div>
  );
}