"use client";

import React from "react";
import type { DMStatus, DraftStatus, LeadPriority, LeadStatus } from "@/types";

type BadgeStatus = DMStatus | DraftStatus | LeadPriority | LeadStatus | string;

interface StatusBadgeProps {
  status: BadgeStatus;
  size?: "sm" | "md" | "lg";
}

const STATUS_COLOR_MAP: Record<string, string> = {
  // DM statuses
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  drafted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  sent: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  escalated: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",

  // Draft statuses
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",

  // Lead priorities
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",

  // Lead statuses
  contacted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  qualified: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  converted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  lost: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

const STATUS_LABEL_MAP: Record<string, string> = {
  new: "New",
  drafted: "Drafted",
  sent: "Sent",
  escalated: "Escalated",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  high: "High",
  medium: "Medium",
  low: "Low",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  lost: "Lost",
};

const SIZE_CLASSES: Record<NonNullable<StatusBadgeProps["size"]>, string> = {
  sm: "px-1.5 py-0.5 text-2xs",
  md: "px-2.5 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
};

function getColorClasses(status: string): string {
  const normalized = status.toLowerCase();
  return (
    STATUS_COLOR_MAP[normalized] ??
    "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
  );
}

function getLabel(status: string): string {
  const normalized = status.toLowerCase();
  return STATUS_LABEL_MAP[normalized] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const colorClasses = getColorClasses(status);
  const sizeClasses = SIZE_CLASSES[size];
  const label = getLabel(status);

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${colorClasses} ${sizeClasses}`}
    >
      {label}
    </span>
  );
}

export default StatusBadge;