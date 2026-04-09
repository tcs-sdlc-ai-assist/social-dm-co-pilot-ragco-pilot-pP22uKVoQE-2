import { v4 as uuidv4 } from "uuid";
import type {
  Notification,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  DM,
} from "../types";
import { logAction } from "./audit-logger";

// ─── In-Memory Notification Store ────────────────────────────────────────────

const notificationStore: Map<string, Notification> = new Map();

// ─── SLA Configuration ───────────────────────────────────────────────────────

const SLA_BREACH_MINUTES = parseInt(process.env.SLA_BREACH_MINUTES ?? "30", 10);

// ─── Event Bus (In-Memory Observer Pattern) ──────────────────────────────────

type NotificationEventType =
  | "notification_created"
  | "notification_read"
  | "sla_breach"
  | "high_priority_alert";

type NotificationEventHandler = (notification: Notification) => void;

const eventListeners: Map<NotificationEventType, NotificationEventHandler[]> = new Map();

export function onNotificationEvent(
  eventType: NotificationEventType,
  handler: NotificationEventHandler
): void {
  const handlers = eventListeners.get(eventType) ?? [];
  handlers.push(handler);
  eventListeners.set(eventType, handlers);
}

export function offNotificationEvent(
  eventType: NotificationEventType,
  handler: NotificationEventHandler
): void {
  const handlers = eventListeners.get(eventType);
  if (!handlers) {
    return;
  }
  const filtered = handlers.filter((h) => h !== handler);
  eventListeners.set(eventType, filtered);
}

function emitEvent(eventType: NotificationEventType, notification: Notification): void {
  const handlers = eventListeners.get(eventType);
  if (!handlers || handlers.length === 0) {
    return;
  }
  for (const handler of handlers) {
    try {
      handler(notification);
    } catch {
      // Event handler errors are non-critical — silently ignore
    }
  }
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

const seedNotifications: Notification[] = [
  {
    id: "notif_001",
    type: "lead_created",
    recipientId: "officer_001",
    channel: "in_app",
    status: "sent",
    timestamp: "2024-06-01T09:30:00Z",
    relatedLeadId: "lead_001",
    message: "New high-priority lead extracted from Facebook DM by Sarah Jones.",
  },
  {
    id: "notif_002",
    type: "draft_ready",
    recipientId: "officer_001",
    channel: "in_app",
    status: "sent",
    timestamp: "2024-06-01T10:00:00Z",
    relatedLeadId: null,
    message: "AI draft ready for review: DM from Michael Chen regarding Aura pricing.",
  },
  {
    id: "notif_003",
    type: "escalation",
    recipientId: "officer_002",
    channel: "email",
    status: "pending",
    timestamp: "2024-06-02T09:45:00Z",
    relatedLeadId: "lead_003",
    message: "Escalated DM from Priya Sharma requires immediate attention — budget $750k, Elara.",
  },
];

function initializeSeedData(): void {
  if (notificationStore.size === 0) {
    for (const notification of seedNotifications) {
      notificationStore.set(notification.id, { ...notification });
    }
  }
}

initializeSeedData();

// ─── Validation Helpers ──────────────────────────────────────────────────────

const VALID_TYPES: Set<string> = new Set<NotificationType>([
  "lead_created",
  "draft_ready",
  "escalation",
  "review_needed",
]);

const VALID_CHANNELS: Set<string> = new Set<NotificationChannel>([
  "email",
  "sms",
  "in_app",
  "slack",
]);

function isValidNotificationType(type: string): type is NotificationType {
  return VALID_TYPES.has(type);
}

function isValidNotificationChannel(channel: string): channel is NotificationChannel {
  return VALID_CHANNELS.has(channel);
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Triggers a new notification and stores it in the in-memory store.
 * Logs the action to the audit trail and emits an event.
 */
export function triggerNotification(
  type: string,
  recipientId: string,
  channel: string,
  message: string,
  relatedLeadId?: string
): Notification {
  if (!isValidNotificationType(type)) {
    throw new Error(
      `Invalid notification type: "${type}". Must be one of: ${Array.from(VALID_TYPES).join(", ")}`
    );
  }

  if (!isValidNotificationChannel(channel)) {
    throw new Error(
      `Invalid notification channel: "${channel}". Must be one of: ${Array.from(VALID_CHANNELS).join(", ")}`
    );
  }

  if (!recipientId || recipientId.trim().length === 0) {
    throw new Error("Recipient ID is required.");
  }

  if (!message || message.trim().length === 0) {
    throw new Error("Notification message is required.");
  }

  const notification: Notification = {
    id: uuidv4(),
    type,
    recipientId: recipientId.trim(),
    channel,
    status: "pending",
    timestamp: new Date().toISOString(),
    relatedLeadId: relatedLeadId ?? null,
    message: message.trim(),
  };

  notificationStore.set(notification.id, notification);

  // Simulate delivery — mark as sent
  notification.status = "sent";
  notificationStore.set(notification.id, { ...notification });

  // Audit log
  logAction(
    "notification_sent",
    "system",
    {
      type: notification.type,
      channel: notification.channel,
      recipientId: notification.recipientId,
      relatedLeadId: notification.relatedLeadId,
    },
    "notification",
    notification.id
  );

  // Emit event
  emitEvent("notification_created", notification);

  if (type === "escalation") {
    emitEvent("high_priority_alert", notification);
  }

  return { ...notification };
}

/**
 * Monitors DMs for SLA breaches based on configured SLA_BREACH_MINUTES.
 * Returns an array of notifications created for breached DMs.
 * Only DMs with status "new" are checked for SLA breach.
 */
export function monitorSLA(dms: DM[]): Notification[] {
  const now = Date.now();
  const breachThresholdMs = SLA_BREACH_MINUTES * 60 * 1000;
  const breachNotifications: Notification[] = [];

  // Track which DMs already have SLA breach notifications to avoid duplicates
  const existingBreachDmIds = new Set<string>();
  for (const notification of notificationStore.values()) {
    if (
      notification.type === "escalation" &&
      notification.message.includes("SLA breach")
    ) {
      // Extract DM ID from message if present, or track by relatedLeadId
      // We store DM context in the message for deduplication
      const dmIdMatch = notification.message.match(/DM ([\w_-]+)/);
      if (dmIdMatch && dmIdMatch[1]) {
        existingBreachDmIds.add(dmIdMatch[1]);
      }
    }
  }

  for (const dm of dms) {
    // Only check "new" DMs that haven't been responded to
    if (dm.status !== "new") {
      continue;
    }

    // Skip if we already sent a breach notification for this DM
    if (existingBreachDmIds.has(dm.id)) {
      continue;
    }

    const dmTimestamp = new Date(dm.timestamp).getTime();
    const elapsed = now - dmTimestamp;

    if (elapsed > breachThresholdMs) {
      const minutesElapsed = Math.floor(elapsed / 60000);

      const notification = triggerNotification(
        "escalation",
        "system",
        "in_app",
        `SLA breach: DM ${dm.id} from ${dm.senderName} (@${dm.senderHandle}) on ${dm.platform} has been unanswered for ${minutesElapsed} minutes (threshold: ${SLA_BREACH_MINUTES} min).`,
        null
      );

      breachNotifications.push(notification);

      // Audit log for SLA breach
      logAction(
        "sla_breach_detected",
        "system",
        {
          dmId: dm.id,
          platform: dm.platform,
          senderHandle: dm.senderHandle,
          minutesElapsed,
          thresholdMinutes: SLA_BREACH_MINUTES,
        },
        "dm",
        dm.id
      );

      emitEvent("sla_breach", notification);
    }
  }

  return breachNotifications;
}

/**
 * Retrieves notifications, optionally filtered by recipientId.
 * Returns notifications sorted by timestamp descending (most recent first).
 */
export function getNotifications(recipientId?: string): Notification[] {
  let results = Array.from(notificationStore.values());

  if (recipientId && recipientId.trim().length > 0) {
    const targetRecipient = recipientId.trim();
    results = results.filter(
      (notification) => notification.recipientId === targetRecipient
    );
  }

  // Sort by timestamp descending
  results.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return results.map((notification) => ({ ...notification }));
}

/**
 * Marks a notification as read.
 * Returns true if the notification was found and updated, false otherwise.
 */
export function markAsRead(notificationId: string): boolean {
  const notification = notificationStore.get(notificationId);

  if (!notification) {
    return false;
  }

  // Already read — no-op but still return true
  if (notification.status === "read") {
    return true;
  }

  const previousStatus = notification.status;
  notification.status = "read";
  notificationStore.set(notificationId, { ...notification });

  // Audit log
  logAction(
    "notification_read",
    notification.recipientId,
    {
      notificationId,
      previousStatus,
      newStatus: "read",
    },
    "notification",
    notificationId
  );

  emitEvent("notification_read", { ...notification });

  return true;
}

/**
 * Triggers a high-priority lead alert notification.
 * Convenience function for lead-related notifications.
 */
export function triggerHighPriorityLeadAlert(
  recipientId: string,
  leadId: string,
  leadName: string,
  channel: NotificationChannel = "in_app"
): Notification {
  const message = `High-priority lead detected: ${leadName}. Immediate follow-up recommended.`;

  return triggerNotification(
    "lead_created",
    recipientId,
    channel,
    message,
    leadId
  );
}

/**
 * Triggers a low-confidence draft alert notification.
 * Used when AI-generated drafts have low confidence scores.
 */
export function triggerLowConfidenceDraftAlert(
  recipientId: string,
  dmId: string,
  confidenceScore: number,
  channel: NotificationChannel = "in_app"
): Notification {
  const percentage = Math.round(
    confidenceScore <= 1 ? confidenceScore * 100 : confidenceScore
  );
  const message = `Low-confidence draft (${percentage}%) generated for DM ${dmId}. Human review required before sending.`;

  return triggerNotification(
    "review_needed",
    recipientId,
    channel,
    message,
    null
  );
}

/**
 * Triggers a review-needed notification for a draft.
 */
export function triggerDraftReadyNotification(
  recipientId: string,
  dmId: string,
  senderName: string,
  channel: NotificationChannel = "in_app"
): Notification {
  const message = `AI draft ready for review: DM from ${senderName} (${dmId}).`;

  return triggerNotification(
    "draft_ready",
    recipientId,
    channel,
    message,
    null
  );
}

/**
 * Returns the count of unread notifications for a given recipient.
 */
export function getUnreadCount(recipientId: string): number {
  let count = 0;
  for (const notification of notificationStore.values()) {
    if (
      notification.recipientId === recipientId &&
      notification.status !== "read"
    ) {
      count++;
    }
  }
  return count;
}

/**
 * Retrieves a single notification by ID.
 * Returns null if not found.
 */
export function getNotificationById(notificationId: string): Notification | null {
  const notification = notificationStore.get(notificationId);
  return notification ? { ...notification } : null;
}