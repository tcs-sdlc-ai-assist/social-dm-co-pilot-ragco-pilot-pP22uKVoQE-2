// Central type definitions for the social-dm-copilot application

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum UserRole {
  ADMIN = "admin",
  AGENT = "agent",
  REVIEWER = "reviewer",
  READONLY = "readonly",
}

export enum ConfidenceLevel {
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

// ─── DM Types ────────────────────────────────────────────────────────────────

export type DMStatus = "new" | "drafted" | "sent" | "escalated";

export interface DM {
  id: string;
  platform: string;
  timestamp: string;
  senderName: string;
  senderHandle: string;
  content: string;
  status: DMStatus;
}

// ─── Draft Types ─────────────────────────────────────────────────────────────

export type DraftStatus = "pending" | "approved" | "rejected" | "sent";

export interface Draft {
  id: string;
  dmId: string;
  generatedText: string;
  editedText: string | null;
  confidenceScore: number;
  referencedContextIds: string[];
  status: DraftStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

// ─── Lead Types ──────────────────────────────────────────────────────────────

export type LeadPriority = "high" | "medium" | "low";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "converted"
  | "lost";

export interface Lead {
  id: string;
  dmId: string;
  name: string;
  contact: string;
  budget: string | null;
  location: string | null;
  intent: string;
  priority: LeadPriority;
  status: LeadStatus;
  salesforceId: string | null;
}

export interface CandidateLead {
  dmId: string;
  name: string;
  contact: string;
  budget: string | null;
  location: string | null;
  intent: string;
  priority: LeadPriority;
}

// ─── Notification Types ──────────────────────────────────────────────────────

export type NotificationType = "lead_created" | "draft_ready" | "escalation" | "review_needed";

export type NotificationChannel = "email" | "sms" | "in_app" | "slack";

export type NotificationStatus = "pending" | "sent" | "failed" | "read";

export interface Notification {
  id: string;
  type: NotificationType;
  recipientId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  timestamp: string;
  relatedLeadId: string | null;
  message: string;
}

// ─── Audit Log Types ─────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details: Record<string, unknown>;
  entityType: string;
  entityId: string;
}

// ─── Knowledge Base Types ────────────────────────────────────────────────────

export interface KnowledgeBaseEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string[];
}

// ─── Auth Types ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  error: string | null;
  timestamp: string;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}