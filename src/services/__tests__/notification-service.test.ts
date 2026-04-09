import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  triggerNotification,
  monitorSLA,
  getNotifications,
  markAsRead,
  triggerHighPriorityLeadAlert,
  triggerLowConfidenceDraftAlert,
  triggerDraftReadyNotification,
  getUnreadCount,
  getNotificationById,
} from "../notification-service";
import type { DM, Notification } from "../../types";

function makeDM(overrides: Partial<DM> = {}): DM {
  return {
    id: "dm-test-001",
    platform: "facebook",
    timestamp: new Date().toISOString(),
    senderName: "Test User",
    senderHandle: "@testuser",
    content: "Hello, I am interested in your properties.",
    status: "new",
    ...overrides,
  };
}

describe("NotificationService", () => {
  describe("triggerNotification", () => {
    it("creates a notification with correct fields", () => {
      const notification = triggerNotification(
        "lead_created",
        "officer_100",
        "in_app",
        "A new lead has been created from a Facebook DM.",
        "lead_100",
      );

      expect(notification).toBeDefined();
      expect(notification.id).toBeTruthy();
      expect(notification.type).toBe("lead_created");
      expect(notification.recipientId).toBe("officer_100");
      expect(notification.channel).toBe("in_app");
      expect(notification.message).toBe("A new lead has been created from a Facebook DM.");
      expect(notification.relatedLeadId).toBe("lead_100");
      expect(notification.status).toBe("sent");
      expect(notification.timestamp).toBeTruthy();
    });

    it("creates a notification without a related lead ID", () => {
      const notification = triggerNotification(
        "draft_ready",
        "officer_101",
        "email",
        "A draft is ready for review.",
      );

      expect(notification).toBeDefined();
      expect(notification.relatedLeadId).toBeNull();
      expect(notification.type).toBe("draft_ready");
      expect(notification.channel).toBe("email");
    });

    it("creates notifications with all valid types", () => {
      const types = ["lead_created", "draft_ready", "escalation", "review_needed"] as const;

      for (const type of types) {
        const notification = triggerNotification(
          type,
          "officer_102",
          "in_app",
          `Test notification for type: ${type}`,
        );
        expect(notification.type).toBe(type);
        expect(notification.status).toBe("sent");
      }
    });

    it("creates notifications with all valid channels", () => {
      const channels = ["email", "sms", "in_app", "slack"] as const;

      for (const channel of channels) {
        const notification = triggerNotification(
          "lead_created",
          "officer_103",
          channel,
          `Test notification for channel: ${channel}`,
        );
        expect(notification.channel).toBe(channel);
      }
    });

    it("throws an error for invalid notification type", () => {
      expect(() =>
        triggerNotification(
          "invalid_type",
          "officer_104",
          "in_app",
          "This should fail.",
        ),
      ).toThrow("Invalid notification type");
    });

    it("throws an error for invalid notification channel", () => {
      expect(() =>
        triggerNotification(
          "lead_created",
          "officer_105",
          "carrier_pigeon",
          "This should fail.",
        ),
      ).toThrow("Invalid notification channel");
    });

    it("throws an error when recipientId is empty", () => {
      expect(() =>
        triggerNotification(
          "lead_created",
          "",
          "in_app",
          "This should fail.",
        ),
      ).toThrow("Recipient ID is required");
    });

    it("throws an error when message is empty", () => {
      expect(() =>
        triggerNotification(
          "lead_created",
          "officer_106",
          "in_app",
          "",
        ),
      ).toThrow("Notification message is required");
    });

    it("trims whitespace from recipientId and message", () => {
      const notification = triggerNotification(
        "lead_created",
        "  officer_107  ",
        "in_app",
        "  Trimmed message  ",
      );

      expect(notification.recipientId).toBe("officer_107");
      expect(notification.message).toBe("Trimmed message");
    });

    it("generates unique IDs for each notification", () => {
      const notification1 = triggerNotification(
        "lead_created",
        "officer_108",
        "in_app",
        "First notification.",
      );
      const notification2 = triggerNotification(
        "lead_created",
        "officer_108",
        "in_app",
        "Second notification.",
      );

      expect(notification1.id).not.toBe(notification2.id);
    });
  });

  describe("monitorSLA", () => {
    it("detects SLA breaches for old unanswered DMs", () => {
      const oldTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 60 minutes ago

      const dms: DM[] = [
        makeDM({
          id: "dm-sla-001",
          timestamp: oldTimestamp,
          status: "new",
          senderName: "SLA Breach User",
          senderHandle: "@slabreach",
        }),
      ];

      const breachNotifications = monitorSLA(dms);

      expect(breachNotifications.length).toBeGreaterThanOrEqual(1);

      const breachNotification = breachNotifications.find(
        (n) => n.message.includes("dm-sla-001"),
      );
      expect(breachNotification).toBeDefined();
      expect(breachNotification!.type).toBe("escalation");
      expect(breachNotification!.message).toContain("SLA breach");
      expect(breachNotification!.message).toContain("SLA Breach User");
    });

    it("does not create breach notifications for recent DMs", () => {
      const recentTimestamp = new Date().toISOString(); // just now

      const dms: DM[] = [
        makeDM({
          id: "dm-sla-recent-001",
          timestamp: recentTimestamp,
          status: "new",
          senderName: "Recent User",
        }),
      ];

      const breachNotifications = monitorSLA(dms);

      const relevant = breachNotifications.filter(
        (n) => n.message.includes("dm-sla-recent-001"),
      );
      expect(relevant.length).toBe(0);
    });

    it("does not create breach notifications for non-new DMs", () => {
      const oldTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const dms: DM[] = [
        makeDM({
          id: "dm-sla-drafted-001",
          timestamp: oldTimestamp,
          status: "drafted",
        }),
        makeDM({
          id: "dm-sla-sent-001",
          timestamp: oldTimestamp,
          status: "sent",
        }),
        makeDM({
          id: "dm-sla-escalated-001",
          timestamp: oldTimestamp,
          status: "escalated",
        }),
      ];

      const breachNotifications = monitorSLA(dms);

      const relevant = breachNotifications.filter(
        (n) =>
          n.message.includes("dm-sla-drafted-001") ||
          n.message.includes("dm-sla-sent-001") ||
          n.message.includes("dm-sla-escalated-001"),
      );
      expect(relevant.length).toBe(0);
    });

    it("returns an empty array when no DMs are provided", () => {
      const breachNotifications = monitorSLA([]);
      expect(breachNotifications).toEqual([]);
    });

    it("does not duplicate breach notifications for the same DM", () => {
      const oldTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const dms: DM[] = [
        makeDM({
          id: "dm-sla-dedup-001",
          timestamp: oldTimestamp,
          status: "new",
          senderName: "Dedup User",
          senderHandle: "@dedupuser",
        }),
      ];

      // First call should create a breach notification
      const firstBatch = monitorSLA(dms);
      const firstRelevant = firstBatch.filter(
        (n) => n.message.includes("dm-sla-dedup-001"),
      );
      expect(firstRelevant.length).toBe(1);

      // Second call should not create a duplicate
      const secondBatch = monitorSLA(dms);
      const secondRelevant = secondBatch.filter(
        (n) => n.message.includes("dm-sla-dedup-001"),
      );
      expect(secondRelevant.length).toBe(0);
    });
  });

  describe("getNotifications", () => {
    it("returns notifications filtered by recipientId", () => {
      const recipientId = "officer_filter_001";

      triggerNotification(
        "lead_created",
        recipientId,
        "in_app",
        "Notification for filter test recipient.",
      );

      triggerNotification(
        "draft_ready",
        "officer_filter_other",
        "in_app",
        "Notification for another recipient.",
      );

      const notifications = getNotifications(recipientId);

      expect(notifications.length).toBeGreaterThanOrEqual(1);
      for (const notification of notifications) {
        expect(notification.recipientId).toBe(recipientId);
      }
    });

    it("returns all notifications when no recipientId is provided", () => {
      const allNotifications = getNotifications();
      expect(allNotifications.length).toBeGreaterThan(0);
    });

    it("returns notifications sorted by timestamp descending", () => {
      const recipientId = "officer_sort_001";

      triggerNotification(
        "lead_created",
        recipientId,
        "in_app",
        "First notification for sort test.",
      );

      triggerNotification(
        "draft_ready",
        recipientId,
        "in_app",
        "Second notification for sort test.",
      );

      const notifications = getNotifications(recipientId);

      for (let i = 1; i < notifications.length; i++) {
        const prevTime = new Date(notifications[i - 1].timestamp).getTime();
        const currTime = new Date(notifications[i].timestamp).getTime();
        expect(prevTime).toBeGreaterThanOrEqual(currTime);
      }
    });

    it("returns an empty array for a recipient with no notifications", () => {
      const notifications = getNotifications("nonexistent_recipient_xyz");
      expect(notifications).toEqual([]);
    });

    it("returns copies of notifications (not references)", () => {
      const recipientId = "officer_copy_001";

      triggerNotification(
        "lead_created",
        recipientId,
        "in_app",
        "Copy test notification.",
      );

      const notifications1 = getNotifications(recipientId);
      const notifications2 = getNotifications(recipientId);

      expect(notifications1.length).toBeGreaterThanOrEqual(1);

      // Mutating the first result should not affect the second
      if (notifications1.length > 0) {
        (notifications1[0] as { message: string }).message = "MUTATED";
        expect(notifications2[0].message).not.toBe("MUTATED");
      }
    });
  });

  describe("markAsRead", () => {
    it("marks a notification as read and returns true", () => {
      const notification = triggerNotification(
        "lead_created",
        "officer_read_001",
        "in_app",
        "Notification to be marked as read.",
      );

      expect(notification.status).toBe("sent");

      const result = markAsRead(notification.id);
      expect(result).toBe(true);

      const updated = getNotificationById(notification.id);
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("read");
    });

    it("returns true when marking an already-read notification", () => {
      const notification = triggerNotification(
        "draft_ready",
        "officer_read_002",
        "in_app",
        "Already read notification.",
      );

      markAsRead(notification.id);
      const secondResult = markAsRead(notification.id);
      expect(secondResult).toBe(true);

      const updated = getNotificationById(notification.id);
      expect(updated!.status).toBe("read");
    });

    it("returns false for a non-existent notification ID", () => {
      const result = markAsRead("nonexistent_notification_id_xyz");
      expect(result).toBe(false);
    });

    it("decreases unread count after marking as read", () => {
      const recipientId = "officer_unread_count_001";

      triggerNotification(
        "lead_created",
        recipientId,
        "in_app",
        "Unread count test notification 1.",
      );

      const notification2 = triggerNotification(
        "draft_ready",
        recipientId,
        "in_app",
        "Unread count test notification 2.",
      );

      const unreadBefore = getUnreadCount(recipientId);

      markAsRead(notification2.id);

      const unreadAfter = getUnreadCount(recipientId);
      expect(unreadAfter).toBe(unreadBefore - 1);
    });
  });

  describe("triggerHighPriorityLeadAlert", () => {
    it("creates a high-priority lead notification with correct fields", () => {
      const notification = triggerHighPriorityLeadAlert(
        "officer_hp_001",
        "lead_hp_001",
        "Sarah Jones",
      );

      expect(notification).toBeDefined();
      expect(notification.type).toBe("lead_created");
      expect(notification.recipientId).toBe("officer_hp_001");
      expect(notification.relatedLeadId).toBe("lead_hp_001");
      expect(notification.message).toContain("Sarah Jones");
      expect(notification.message).toContain("High-priority");
      expect(notification.channel).toBe("in_app");
      expect(notification.status).toBe("sent");
    });

    it("supports custom notification channel", () => {
      const notification = triggerHighPriorityLeadAlert(
        "officer_hp_002",
        "lead_hp_002",
        "Michael Chen",
        "email",
      );

      expect(notification.channel).toBe("email");
      expect(notification.type).toBe("lead_created");
      expect(notification.message).toContain("Michael Chen");
    });

    it("includes the lead name in the notification message", () => {
      const notification = triggerHighPriorityLeadAlert(
        "officer_hp_003",
        "lead_hp_003",
        "Emily Watson",
      );

      expect(notification.message).toContain("Emily Watson");
      expect(notification.message.toLowerCase()).toContain("immediate");
    });
  });

  describe("triggerLowConfidenceDraftAlert", () => {
    it("creates a low-confidence draft alert with correct fields", () => {
      const notification = triggerLowConfidenceDraftAlert(
        "officer_lc_001",
        "dm_lc_001",
        0.35,
      );

      expect(notification).toBeDefined();
      expect(notification.type).toBe("review_needed");
      expect(notification.recipientId).toBe("officer_lc_001");
      expect(notification.message).toContain("35%");
      expect(notification.message).toContain("dm_lc_001");
      expect(notification.message.toLowerCase()).toContain("review");
      expect(notification.channel).toBe("in_app");
    });

    it("handles confidence score as a percentage (> 1)", () => {
      const notification = triggerLowConfidenceDraftAlert(
        "officer_lc_002",
        "dm_lc_002",
        42,
      );

      expect(notification.message).toContain("42%");
    });

    it("handles confidence score as a decimal (0-1)", () => {
      const notification = triggerLowConfidenceDraftAlert(
        "officer_lc_003",
        "dm_lc_003",
        0.28,
      );

      expect(notification.message).toContain("28%");
    });
  });

  describe("triggerDraftReadyNotification", () => {
    it("creates a draft ready notification with correct fields", () => {
      const notification = triggerDraftReadyNotification(
        "officer_dr_001",
        "dm_dr_001",
        "Priya Sharma",
      );

      expect(notification).toBeDefined();
      expect(notification.type).toBe("draft_ready");
      expect(notification.recipientId).toBe("officer_dr_001");
      expect(notification.message).toContain("Priya Sharma");
      expect(notification.message).toContain("dm_dr_001");
      expect(notification.channel).toBe("in_app");
      expect(notification.status).toBe("sent");
    });

    it("supports custom notification channel", () => {
      const notification = triggerDraftReadyNotification(
        "officer_dr_002",
        "dm_dr_002",
        "Tom Richards",
        "slack",
      );

      expect(notification.channel).toBe("slack");
    });
  });

  describe("getNotificationById", () => {
    it("retrieves a notification by its ID", () => {
      const created = triggerNotification(
        "lead_created",
        "officer_byid_001",
        "in_app",
        "Notification to retrieve by ID.",
      );

      const retrieved = getNotificationById(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.message).toBe("Notification to retrieve by ID.");
    });

    it("returns null for a non-existent notification ID", () => {
      const result = getNotificationById("nonexistent_id_xyz_123");
      expect(result).toBeNull();
    });
  });

  describe("getUnreadCount", () => {
    it("returns the correct unread count for a recipient", () => {
      const recipientId = "officer_unread_test_001";

      triggerNotification(
        "lead_created",
        recipientId,
        "in_app",
        "Unread test 1.",
      );

      triggerNotification(
        "draft_ready",
        recipientId,
        "in_app",
        "Unread test 2.",
      );

      const count = getUnreadCount(recipientId);
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("returns 0 for a recipient with no notifications", () => {
      const count = getUnreadCount("nonexistent_recipient_unread_xyz");
      expect(count).toBe(0);
    });

    it("decreases after marking notifications as read", () => {
      const recipientId = "officer_unread_dec_001";

      const n1 = triggerNotification(
        "lead_created",
        recipientId,
        "in_app",
        "Unread decrease test.",
      );

      const countBefore = getUnreadCount(recipientId);
      markAsRead(n1.id);
      const countAfter = getUnreadCount(recipientId);

      expect(countAfter).toBe(countBefore - 1);
    });
  });
});