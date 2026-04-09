import { v4 as uuidv4 } from "uuid";
import type { DM, DMStatus, PaginatedResponse } from "../types";
import {
  getAllDMs,
  getDMById,
  addDM,
  updateDMStatus as repoUpdateDMStatus,
} from "./dm-repository";
import { logAction } from "./audit-logger";
import { AUDIT_ACTIONS } from "../constants";

// ─── Filter & Pagination Types ───────────────────────────────────────────────

export interface InboxFilterParams {
  status?: DMStatus;
  platform?: string;
  search?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

// ─── Platform Normalization ──────────────────────────────────────────────────

interface RawDMPayload {
  id?: string;
  message_id?: string;
  messageId?: string;
  sender_name?: string;
  senderName?: string;
  from?: string;
  sender_handle?: string;
  senderHandle?: string;
  handle?: string;
  username?: string;
  sender_avatar?: string;
  senderAvatar?: string;
  avatar_url?: string;
  avatarUrl?: string;
  content?: string;
  text?: string;
  message?: string;
  body?: string;
  timestamp?: string;
  created_at?: string;
  createdAt?: string;
  sent_at?: string;
  sentAt?: string;
  status?: DMStatus;
  platform?: string;
}

function normalizePlatform(platform: string): string {
  const normalized = platform.toLowerCase().trim();
  const platformMap: Record<string, string> = {
    fb: "facebook",
    facebook: "facebook",
    ig: "instagram",
    instagram: "instagram",
    twitter: "twitter",
    x: "twitter",
    linkedin: "linkedin",
    whatsapp: "whatsapp",
    telegram: "telegram",
  };
  return platformMap[normalized] ?? normalized;
}

function normalizeSenderName(raw: RawDMPayload): string {
  const name =
    raw.senderName ??
    raw.sender_name ??
    raw.from ??
    "";
  return name.trim() || "Unknown";
}

function normalizeSenderHandle(raw: RawDMPayload): string {
  const handle =
    raw.senderHandle ??
    raw.sender_handle ??
    raw.handle ??
    raw.username ??
    "";
  const trimmed = handle.trim();
  if (trimmed.length === 0) {
    return "@unknown";
  }
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function normalizeContent(raw: RawDMPayload): string {
  return (
    raw.content ??
    raw.text ??
    raw.message ??
    raw.body ??
    ""
  ).trim();
}

function normalizeTimestamp(raw: RawDMPayload): string {
  const rawTimestamp =
    raw.timestamp ??
    raw.createdAt ??
    raw.created_at ??
    raw.sentAt ??
    raw.sent_at ??
    null;

  if (rawTimestamp) {
    const parsed = new Date(rawTimestamp);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function normalizeId(raw: RawDMPayload, platform: string): string {
  const rawId =
    raw.id ??
    raw.messageId ??
    raw.message_id ??
    null;

  if (rawId && typeof rawId === "string" && rawId.trim().length > 0) {
    const prefix = platform.substring(0, 2).toLowerCase();
    // If the ID already has a platform prefix, use it as-is
    if (rawId.includes("_")) {
      return rawId;
    }
    return `${prefix}_${rawId}`;
  }

  const prefix = platform.substring(0, 2).toLowerCase();
  return `${prefix}_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

const STATUS_PRIORITY: Record<DMStatus, number> = {
  escalated: 0,
  new: 1,
  drafted: 2,
  sent: 3,
};

function sortByNewest(a: DM, b: DM): number {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Retrieves a paginated, filtered list of DMs for the inbox.
 * Supports filtering by status, platform, and search text.
 */
export function getInbox(
  filters?: InboxFilterParams,
  pagination?: PaginationParams,
): PaginatedResponse<DM> {
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 20;

  let dms = getAllDMs();

  // Apply status filter
  if (filters?.status) {
    const status = filters.status;
    dms = dms.filter((dm) => dm.status === status);
  }

  // Apply platform filter
  if (filters?.platform && filters.platform !== "all") {
    const platform = normalizePlatform(filters.platform);
    dms = dms.filter((dm) => dm.platform.toLowerCase() === platform);
  }

  // Apply search filter (matches sender name, handle, or content)
  if (filters?.search && filters.search.trim().length > 0) {
    const searchLower = filters.search.trim().toLowerCase();
    dms = dms.filter((dm) => {
      const nameMatch = dm.senderName.toLowerCase().includes(searchLower);
      const handleMatch = dm.senderHandle.toLowerCase().includes(searchLower);
      const contentMatch = dm.content.toLowerCase().includes(searchLower);
      return nameMatch || handleMatch || contentMatch;
    });
  }

  // Sort by status priority first, then by newest timestamp
  dms.sort((a, b) => {
    const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return sortByNewest(a, b);
  });

  const totalItems = dms.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const clampedPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (clampedPage - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedDMs = dms.slice(startIndex, endIndex);

  return {
    success: true,
    data: paginatedDMs,
    error: null,
    timestamp: new Date().toISOString(),
    pagination: {
      page: clampedPage,
      pageSize: limit,
      totalItems,
      totalPages,
    },
  };
}

/**
 * Retrieves a single DM by its ID.
 * Returns null if the DM does not exist.
 */
export function getDM(dmId: string): DM | null {
  if (!dmId || dmId.trim().length === 0) {
    return null;
  }
  return getDMById(dmId);
}

/**
 * Updates the status of a DM and logs the action for audit.
 * Returns the updated DM or null if not found.
 */
export function updateDMStatusAction(
  dmId: string,
  status: DMStatus,
  actor: string,
): DM | null {
  if (!dmId || dmId.trim().length === 0) {
    return null;
  }

  const existingDM = getDMById(dmId);
  if (!existingDM) {
    return null;
  }

  const previousStatus = existingDM.status;
  const updatedDM = repoUpdateDMStatus(dmId, status);

  if (updatedDM) {
    const auditAction =
      status === "escalated"
        ? AUDIT_ACTIONS.DM_ESCALATED
        : AUDIT_ACTIONS.DM_RECEIVED;

    logAction(
      auditAction,
      actor,
      {
        dmId,
        previousStatus,
        newStatus: status,
        platform: updatedDM.platform,
        senderHandle: updatedDM.senderHandle,
      },
      "dm",
      dmId,
    );
  }

  return updatedDM;
}

/**
 * Ingests a raw DM payload from any platform, normalizes it,
 * stores it in the repository, and logs the ingestion.
 * Returns the normalized DM.
 */
export function ingestDM(rawDM: unknown, platform: string): DM {
  const raw = (rawDM ?? {}) as RawDMPayload;
  const normalizedPlatform = normalizePlatform(platform);

  const dm: DM = {
    id: normalizeId(raw, normalizedPlatform),
    platform: normalizedPlatform,
    timestamp: normalizeTimestamp(raw),
    senderName: normalizeSenderName(raw),
    senderHandle: normalizeSenderHandle(raw),
    content: normalizeContent(raw),
    status: "new",
  };

  const storedDM = addDM(dm);

  logAction(
    AUDIT_ACTIONS.DM_RECEIVED,
    "system",
    {
      dmId: storedDM.id,
      platform: storedDM.platform,
      senderHandle: storedDM.senderHandle,
      contentPreview:
        storedDM.content.length > 100
          ? storedDM.content.substring(0, 100) + "…"
          : storedDM.content,
    },
    "dm",
    storedDM.id,
  );

  return storedDM;
}