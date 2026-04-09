import {
  ConfidenceLevel,
  DMStatus,
  DraftStatus,
  LeadPriority,
  LeadStatus,
  NotificationType,
  NotificationChannel,
} from "./types";

// ─── SLA & Thresholds ────────────────────────────────────────────────────────

export const SLA_BREACH_MINUTES = 60;

export const HIGH_PRIORITY_THRESHOLD = 80;

export const MAX_DRAFT_LENGTH = 2000;

export const POLLING_INTERVAL_MS = 5000;

// ─── Confidence Thresholds ───────────────────────────────────────────────────

export const CONFIDENCE_THRESHOLDS: Record<ConfidenceLevel, number> = {
  [ConfidenceLevel.HIGH]: 85,
  [ConfidenceLevel.MEDIUM]: 60,
  [ConfidenceLevel.LOW]: 0,
};

// ─── Status Labels ───────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<DMStatus | DraftStatus | LeadStatus, string> = {
  // DM statuses
  new: "New",
  drafted: "Drafted",
  sent: "Sent",
  escalated: "Escalated",
  // Draft statuses
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  // Lead statuses
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  lost: "Lost",
};

// ─── Platform Labels ─────────────────────────────────────────────────────────

export const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "Twitter",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

// ─── Notification Types ──────────────────────────────────────────────────────

export const NOTIFICATION_TYPES: Record<NotificationType, string> = {
  lead_created: "Lead Created",
  draft_ready: "Draft Ready",
  escalation: "Escalation",
  review_needed: "Review Needed",
};

export const NOTIFICATION_CHANNELS: Record<NotificationChannel, string> = {
  email: "Email",
  sms: "SMS",
  in_app: "In-App",
  slack: "Slack",
};

// ─── Lead Priority Levels ────────────────────────────────────────────────────

export const LEAD_PRIORITY_LEVELS: Record<LeadPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

// ─── Audit Actions ───────────────────────────────────────────────────────────

export const AUDIT_ACTIONS = {
  DM_RECEIVED: "dm_received",
  DM_ESCALATED: "dm_escalated",
  DRAFT_GENERATED: "draft_generated",
  DRAFT_APPROVED: "draft_approved",
  DRAFT_REJECTED: "draft_rejected",
  DRAFT_EDITED: "draft_edited",
  DRAFT_SENT: "draft_sent",
  LEAD_CREATED: "lead_created",
  LEAD_UPDATED: "lead_updated",
  LEAD_CONVERTED: "lead_converted",
  LEAD_LOST: "lead_lost",
  NOTIFICATION_SENT: "notification_sent",
  USER_LOGIN: "user_login",
  USER_LOGOUT: "user_logout",
  SETTINGS_UPDATED: "settings_updated",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// ─── API Routes ──────────────────────────────────────────────────────────────

export const API_ROUTES = {
  // DMs
  DMS: "/api/dms",
  DM_BY_ID: (id: string) => `/api/dms/${id}`,

  // Drafts
  DRAFTS: "/api/drafts",
  DRAFT_BY_ID: (id: string) => `/api/drafts/${id}`,
  DRAFT_APPROVE: (id: string) => `/api/drafts/${id}/approve`,
  DRAFT_REJECT: (id: string) => `/api/drafts/${id}/reject`,
  DRAFT_SEND: (id: string) => `/api/drafts/${id}/send`,

  // Leads
  LEADS: "/api/leads",
  LEAD_BY_ID: (id: string) => `/api/leads/${id}`,

  // Notifications
  NOTIFICATIONS: "/api/notifications",
  NOTIFICATION_BY_ID: (id: string) => `/api/notifications/${id}`,

  // Audit Logs
  AUDIT_LOGS: "/api/audit-logs",

  // Knowledge Base
  KNOWLEDGE_BASE: "/api/knowledge-base",
  KNOWLEDGE_BASE_BY_ID: (id: string) => `/api/knowledge-base/${id}`,

  // Auth
  AUTH_LOGIN: "/api/auth/login",
  AUTH_LOGOUT: "/api/auth/logout",
  AUTH_ME: "/api/auth/me",
} as const;