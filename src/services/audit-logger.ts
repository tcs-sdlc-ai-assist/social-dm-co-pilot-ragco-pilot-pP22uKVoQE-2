import { v4 as uuidv4 } from "uuid";
import type { AuditLog } from "../types";

// ─── PII Detection & Sanitization ────────────────────────────────────────────

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL_REDACTED]" },
  {
    pattern: /(?:\+?61|0)[\s-]?(?:\d[\s-]?){8,9}\d/g,
    replacement: "[PHONE_REDACTED]",
  },
  {
    pattern: /\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/g,
    replacement: "[TFN_REDACTED]",
  },
  {
    pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
    replacement: "[CARD_REDACTED]",
  },
];

const PII_FIELD_NAMES = new Set([
  "email",
  "phone",
  "phoneNumber",
  "phone_number",
  "mobile",
  "address",
  "streetAddress",
  "street_address",
  "dateOfBirth",
  "date_of_birth",
  "dob",
  "ssn",
  "tfn",
  "taxFileNumber",
  "tax_file_number",
  "creditCard",
  "credit_card",
  "cardNumber",
  "card_number",
  "password",
  "secret",
  "token",
]);

function sanitizeString(value: string): string {
  let sanitized = value;
  for (const { pattern, replacement } of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

function sanitizeDetails(
  details: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    if (PII_FIELD_NAMES.has(key.toLowerCase())) {
      sanitized[key] = "[PII_REDACTED]";
      continue;
    }

    if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => {
        if (typeof item === "string") {
          return sanitizeString(item);
        }
        if (typeof item === "object" && item !== null) {
          return sanitizeDetails(item as Record<string, unknown>);
        }
        return item;
      });
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ─── Date Range Filter Interface ─────────────────────────────────────────────

export interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  actor?: string;
  dateRange?: {
    from?: string;
    to?: string;
  };
}

// ─── In-Memory Audit Log Store (Append-Only) ────────────────────────────────

const auditLogStore: AuditLog[] = [];

// ─── Exported Functions ──────────────────────────────────────────────────────

/**
 * Records an audit log entry for a critical action.
 * Sanitizes details to ensure no PII is stored.
 * Append-only — entries cannot be modified or deleted.
 */
export function logAction(
  action: string,
  actor: string,
  details: Record<string, unknown>,
  entityType: string,
  entityId: string
): AuditLog {
  const sanitizedDetails = sanitizeDetails(details);

  const auditLog: AuditLog = {
    id: uuidv4(),
    action,
    actor,
    timestamp: new Date().toISOString(),
    details: sanitizedDetails,
    entityType,
    entityId,
  };

  auditLogStore.push(auditLog);

  return { ...auditLog };
}

/**
 * Retrieves audit logs with optional filtering.
 * Supports filtering by entityType, entityId, actor, and date range.
 * Returns a copy of matching logs sorted by timestamp descending.
 */
export function getAuditLogs(filters?: AuditLogFilters): AuditLog[] {
  let results = auditLogStore.slice();

  if (filters) {
    if (filters.entityType) {
      const entityType = filters.entityType;
      results = results.filter((log) => log.entityType === entityType);
    }

    if (filters.entityId) {
      const entityId = filters.entityId;
      results = results.filter((log) => log.entityId === entityId);
    }

    if (filters.actor) {
      const actor = filters.actor;
      results = results.filter((log) => log.actor === actor);
    }

    if (filters.dateRange) {
      if (filters.dateRange.from) {
        const fromDate = new Date(filters.dateRange.from).getTime();
        results = results.filter(
          (log) => new Date(log.timestamp).getTime() >= fromDate
        );
      }
      if (filters.dateRange.to) {
        const toDate = new Date(filters.dateRange.to).getTime();
        results = results.filter(
          (log) => new Date(log.timestamp).getTime() <= toDate
        );
      }
    }
  }

  // Sort by timestamp descending (most recent first)
  results.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Return copies to prevent external mutation
  return results.map((log) => ({ ...log }));
}

/**
 * Retrieves a single audit log entry by ID.
 * Returns null if not found.
 */
export function getAuditLogById(id: string): AuditLog | null {
  const log = auditLogStore.find((entry) => entry.id === id);
  return log ? { ...log } : null;
}

/**
 * Returns the total count of audit log entries, optionally filtered.
 */
export function getAuditLogCount(filters?: AuditLogFilters): number {
  return getAuditLogs(filters).length;
}