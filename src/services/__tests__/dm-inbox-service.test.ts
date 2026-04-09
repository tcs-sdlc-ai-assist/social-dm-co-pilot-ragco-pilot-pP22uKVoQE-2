import { describe, it, expect, beforeEach } from "vitest";
import {
  getInbox,
  getDM,
  updateDMStatusAction,
  ingestDM,
} from "../dm-inbox-service";
import type { DM, DMStatus, PaginatedResponse } from "../../types";

describe("DMInboxService", () => {
  describe("getInbox", () => {
    it("returns a paginated response with DMs", () => {
      const result = getInbox();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
      expect(result.pagination.totalItems).toBeGreaterThan(0);
      expect(result.pagination.totalPages).toBeGreaterThanOrEqual(1);
      expect(result.timestamp).toBeDefined();
      expect(result.error).toBeNull();
    });

    it("returns correct pagination metadata for page 1 with custom limit", () => {
      const result = getInbox({}, { page: 1, limit: 2 });

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(2);
      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(result.pagination.totalPages).toBe(
        Math.ceil(result.pagination.totalItems / 2)
      );
    });

    it("returns correct data for page 2", () => {
      const page1 = getInbox({}, { page: 1, limit: 2 });
      const page2 = getInbox({}, { page: 2, limit: 2 });

      expect(page2.pagination.page).toBe(2);

      // Ensure page 2 data is different from page 1 data (if enough items exist)
      if (page1.pagination.totalItems > 2) {
        const page1Ids = page1.data.map((dm) => dm.id);
        const page2Ids = page2.data.map((dm) => dm.id);
        const overlap = page2Ids.filter((id) => page1Ids.includes(id));
        expect(overlap.length).toBe(0);
      }
    });

    it("clamps page to valid range when page exceeds total pages", () => {
      const result = getInbox({}, { page: 9999, limit: 20 });

      expect(result.success).toBe(true);
      expect(result.pagination.page).toBeLessThanOrEqual(
        result.pagination.totalPages
      );
    });

    it("defaults to page 1 and limit 20 when no pagination params provided", () => {
      const result = getInbox();

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
    });

    it("returns DMs sorted with escalated first, then new, drafted, sent", () => {
      const result = getInbox();

      const statuses = result.data.map((dm) => dm.status);
      const statusPriority: Record<DMStatus, number> = {
        escalated: 0,
        new: 1,
        drafted: 2,
        sent: 3,
      };

      for (let i = 1; i < statuses.length; i++) {
        const prevPriority = statusPriority[statuses[i - 1]];
        const currPriority = statusPriority[statuses[i]];
        expect(prevPriority).toBeLessThanOrEqual(currPriority);
      }
    });

    it("each DM in the response has all required fields", () => {
      const result = getInbox();

      for (const dm of result.data) {
        expect(dm).toHaveProperty("id");
        expect(dm).toHaveProperty("platform");
        expect(dm).toHaveProperty("timestamp");
        expect(dm).toHaveProperty("senderName");
        expect(dm).toHaveProperty("senderHandle");
        expect(dm).toHaveProperty("content");
        expect(dm).toHaveProperty("status");
        expect(typeof dm.id).toBe("string");
        expect(typeof dm.platform).toBe("string");
        expect(typeof dm.timestamp).toBe("string");
        expect(typeof dm.senderName).toBe("string");
        expect(typeof dm.senderHandle).toBe("string");
        expect(typeof dm.content).toBe("string");
        expect(typeof dm.status).toBe("string");
      }
    });
  });

  describe("getInbox filtering", () => {
    it("filters DMs by status 'new'", () => {
      const result = getInbox({ status: "new" });

      expect(result.success).toBe(true);
      for (const dm of result.data) {
        expect(dm.status).toBe("new");
      }
    });

    it("filters DMs by status 'escalated'", () => {
      const result = getInbox({ status: "escalated" });

      expect(result.success).toBe(true);
      for (const dm of result.data) {
        expect(dm.status).toBe("escalated");
      }
    });

    it("filters DMs by status 'drafted'", () => {
      const result = getInbox({ status: "drafted" });

      expect(result.success).toBe(true);
      for (const dm of result.data) {
        expect(dm.status).toBe("drafted");
      }
    });

    it("filters DMs by status 'sent'", () => {
      const result = getInbox({ status: "sent" });

      expect(result.success).toBe(true);
      for (const dm of result.data) {
        expect(dm.status).toBe("sent");
      }
    });

    it("filters DMs by platform 'facebook'", () => {
      const result = getInbox({ platform: "facebook" });

      expect(result.success).toBe(true);
      for (const dm of result.data) {
        expect(dm.platform).toBe("facebook");
      }
    });

    it("filters DMs by platform 'instagram'", () => {
      const result = getInbox({ platform: "instagram" });

      expect(result.success).toBe(true);
      for (const dm of result.data) {
        expect(dm.platform).toBe("instagram");
      }
    });

    it("normalizes platform filter (fb -> facebook)", () => {
      const result = getInbox({ platform: "fb" });

      expect(result.success).toBe(true);
      for (const dm of result.data) {
        expect(dm.platform).toBe("facebook");
      }
    });

    it("normalizes platform filter (ig -> instagram)", () => {
      const result = getInbox({ platform: "ig" });

      expect(result.success).toBe(true);
      for (const dm of result.data) {
        expect(dm.platform).toBe("instagram");
      }
    });

    it("filters DMs by search text matching sender name", () => {
      const result = getInbox({ search: "Sarah" });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      for (const dm of result.data) {
        const matchesName = dm.senderName.toLowerCase().includes("sarah");
        const matchesHandle = dm.senderHandle.toLowerCase().includes("sarah");
        const matchesContent = dm.content.toLowerCase().includes("sarah");
        expect(matchesName || matchesHandle || matchesContent).toBe(true);
      }
    });

    it("filters DMs by search text matching content", () => {
      const result = getInbox({ search: "Willowdale" });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      for (const dm of result.data) {
        const matchesName = dm.senderName.toLowerCase().includes("willowdale");
        const matchesHandle = dm.senderHandle
          .toLowerCase()
          .includes("willowdale");
        const matchesContent = dm.content.toLowerCase().includes("willowdale");
        expect(matchesName || matchesHandle || matchesContent).toBe(true);
      }
    });

    it("returns empty data when search matches nothing", () => {
      const result = getInbox({ search: "zzzznonexistentzzzzz" });

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(0);
      expect(result.pagination.totalItems).toBe(0);
    });

    it("combines status and platform filters", () => {
      const result = getInbox({ status: "new", platform: "facebook" });

      expect(result.success).toBe(true);
      for (const dm of result.data) {
        expect(dm.status).toBe("new");
        expect(dm.platform).toBe("facebook");
      }
    });

    it("combines status, platform, and search filters", () => {
      const result = getInbox({
        status: "new",
        platform: "instagram",
        search: "lot",
      });

      expect(result.success).toBe(true);
      for (const dm of result.data) {
        expect(dm.status).toBe("new");
        expect(dm.platform).toBe("instagram");
        const matchesAny =
          dm.senderName.toLowerCase().includes("lot") ||
          dm.senderHandle.toLowerCase().includes("lot") ||
          dm.content.toLowerCase().includes("lot");
        expect(matchesAny).toBe(true);
      }
    });

    it("ignores platform filter when set to 'all'", () => {
      const allResult = getInbox({ platform: "all" });
      const noFilterResult = getInbox();

      expect(allResult.pagination.totalItems).toBe(
        noFilterResult.pagination.totalItems
      );
    });

    it("handles empty search string gracefully", () => {
      const result = getInbox({ search: "" });
      const noFilterResult = getInbox();

      expect(result.pagination.totalItems).toBe(
        noFilterResult.pagination.totalItems
      );
    });

    it("handles whitespace-only search string gracefully", () => {
      const result = getInbox({ search: "   " });
      const noFilterResult = getInbox();

      expect(result.pagination.totalItems).toBe(
        noFilterResult.pagination.totalItems
      );
    });
  });

  describe("getDM", () => {
    it("returns a DM by its ID", () => {
      // Get a known DM ID from the inbox
      const inbox = getInbox();
      const firstDM = inbox.data[0];

      const dm = getDM(firstDM.id);

      expect(dm).not.toBeNull();
      expect(dm!.id).toBe(firstDM.id);
      expect(dm!.platform).toBe(firstDM.platform);
      expect(dm!.senderName).toBe(firstDM.senderName);
      expect(dm!.senderHandle).toBe(firstDM.senderHandle);
      expect(dm!.content).toBe(firstDM.content);
      expect(dm!.status).toBe(firstDM.status);
    });

    it("returns null for a non-existent DM ID", () => {
      const dm = getDM("non-existent-dm-id-12345");

      expect(dm).toBeNull();
    });

    it("returns null for an empty string ID", () => {
      const dm = getDM("");

      expect(dm).toBeNull();
    });

    it("returns null for a whitespace-only ID", () => {
      const dm = getDM("   ");

      expect(dm).toBeNull();
    });

    it("returns a copy of the DM (not a reference)", () => {
      const inbox = getInbox();
      const firstDM = inbox.data[0];

      const dm1 = getDM(firstDM.id);
      const dm2 = getDM(firstDM.id);

      expect(dm1).not.toBeNull();
      expect(dm2).not.toBeNull();
      expect(dm1).toEqual(dm2);
      expect(dm1).not.toBe(dm2); // Different object references
    });
  });

  describe("updateDMStatusAction", () => {
    it("updates the status of an existing DM", () => {
      // Ingest a fresh DM to avoid mutating seed data
      const dm = ingestDM(
        {
          senderName: "Status Update Test",
          senderHandle: "@statustest",
          content: "Testing status update functionality.",
          timestamp: "2024-06-10T10:00:00Z",
        },
        "facebook"
      );

      expect(dm.status).toBe("new");

      const updated = updateDMStatusAction(dm.id, "drafted", "agent_001");

      expect(updated).not.toBeNull();
      expect(updated!.id).toBe(dm.id);
      expect(updated!.status).toBe("drafted");
    });

    it("updates status to 'escalated'", () => {
      const dm = ingestDM(
        {
          senderName: "Escalation Test",
          senderHandle: "@escalatetest",
          content: "Testing escalation status.",
          timestamp: "2024-06-10T11:00:00Z",
        },
        "instagram"
      );

      const updated = updateDMStatusAction(dm.id, "escalated", "agent_002");

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("escalated");
    });

    it("updates status to 'sent'", () => {
      const dm = ingestDM(
        {
          senderName: "Sent Test",
          senderHandle: "@senttest",
          content: "Testing sent status.",
          timestamp: "2024-06-10T12:00:00Z",
        },
        "facebook"
      );

      const updated = updateDMStatusAction(dm.id, "sent", "agent_003");

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("sent");
    });

    it("returns null when DM ID does not exist", () => {
      const result = updateDMStatusAction(
        "nonexistent-dm-999",
        "drafted",
        "agent_001"
      );

      expect(result).toBeNull();
    });

    it("returns null when DM ID is empty", () => {
      const result = updateDMStatusAction("", "drafted", "agent_001");

      expect(result).toBeNull();
    });

    it("persists the status change so getDM reflects it", () => {
      const dm = ingestDM(
        {
          senderName: "Persist Test",
          senderHandle: "@persisttest",
          content: "Testing persistence of status change.",
          timestamp: "2024-06-10T13:00:00Z",
        },
        "facebook"
      );

      updateDMStatusAction(dm.id, "drafted", "agent_001");

      const fetched = getDM(dm.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.status).toBe("drafted");
    });
  });

  describe("ingestDM", () => {
    it("normalizes and stores a DM from a raw payload", () => {
      const raw = {
        senderName: "Ingestion Test User",
        senderHandle: "ingestionuser",
        content: "Hello, I want to learn about your communities.",
        timestamp: "2024-06-15T08:00:00Z",
      };

      const dm = ingestDM(raw, "facebook");

      expect(dm).toBeDefined();
      expect(dm.id).toBeDefined();
      expect(dm.id.length).toBeGreaterThan(0);
      expect(dm.platform).toBe("facebook");
      expect(dm.senderName).toBe("Ingestion Test User");
      expect(dm.senderHandle).toBe("@ingestionuser");
      expect(dm.content).toBe(
        "Hello, I want to learn about your communities."
      );
      expect(dm.status).toBe("new");
      expect(dm.timestamp).toBe("2024-06-15T08:00:00.000Z");
    });

    it("normalizes platform name (fb -> facebook)", () => {
      const dm = ingestDM(
        {
          senderName: "Platform Test",
          content: "Testing platform normalization.",
        },
        "fb"
      );

      expect(dm.platform).toBe("facebook");
    });

    it("normalizes platform name (ig -> instagram)", () => {
      const dm = ingestDM(
        {
          senderName: "Platform Test IG",
          content: "Testing IG normalization.",
        },
        "ig"
      );

      expect(dm.platform).toBe("instagram");
    });

    it("adds @ prefix to sender handle if missing", () => {
      const dm = ingestDM(
        {
          senderName: "Handle Test",
          senderHandle: "noatprefix",
          content: "Testing handle normalization.",
        },
        "facebook"
      );

      expect(dm.senderHandle).toBe("@noatprefix");
    });

    it("preserves @ prefix on sender handle if already present", () => {
      const dm = ingestDM(
        {
          senderName: "Handle Test 2",
          senderHandle: "@alreadyhas",
          content: "Testing handle preservation.",
        },
        "facebook"
      );

      expect(dm.senderHandle).toBe("@alreadyhas");
    });

    it("defaults senderName to 'Unknown' when not provided", () => {
      const dm = ingestDM(
        {
          content: "No sender name provided.",
        },
        "instagram"
      );

      expect(dm.senderName).toBe("Unknown");
    });

    it("defaults senderHandle to '@unknown' when not provided", () => {
      const dm = ingestDM(
        {
          senderName: "No Handle",
          content: "No handle provided.",
        },
        "facebook"
      );

      expect(dm.senderHandle).toBe("@unknown");
    });

    it("uses current timestamp when no timestamp is provided", () => {
      const before = new Date().getTime();

      const dm = ingestDM(
        {
          senderName: "Timestamp Test",
          content: "No timestamp provided.",
        },
        "facebook"
      );

      const after = new Date().getTime();
      const dmTime = new Date(dm.timestamp).getTime();

      expect(dmTime).toBeGreaterThanOrEqual(before - 1000);
      expect(dmTime).toBeLessThanOrEqual(after + 1000);
    });

    it("always sets status to 'new' for ingested DMs", () => {
      const dm = ingestDM(
        {
          senderName: "Status Test",
          content: "Status should be new.",
          status: "sent", // Attempt to override — should be ignored
        },
        "facebook"
      );

      expect(dm.status).toBe("new");
    });

    it("handles alternative field names (sender_name, text, created_at)", () => {
      const dm = ingestDM(
        {
          sender_name: "Alt Field User",
          sender_handle: "altfieldhandle",
          text: "Using alternative field names.",
          created_at: "2024-06-20T14:00:00Z",
        },
        "instagram"
      );

      expect(dm.senderName).toBe("Alt Field User");
      expect(dm.senderHandle).toBe("@altfieldhandle");
      expect(dm.content).toBe("Using alternative field names.");
      expect(dm.timestamp).toBe("2024-06-20T14:00:00.000Z");
    });

    it("handles empty raw payload gracefully", () => {
      const dm = ingestDM({}, "facebook");

      expect(dm).toBeDefined();
      expect(dm.platform).toBe("facebook");
      expect(dm.senderName).toBe("Unknown");
      expect(dm.senderHandle).toBe("@unknown");
      expect(dm.content).toBe("");
      expect(dm.status).toBe("new");
    });

    it("handles null raw payload gracefully", () => {
      const dm = ingestDM(null, "facebook");

      expect(dm).toBeDefined();
      expect(dm.platform).toBe("facebook");
      expect(dm.senderName).toBe("Unknown");
      expect(dm.status).toBe("new");
    });

    it("stores the ingested DM so it can be retrieved by getDM", () => {
      const dm = ingestDM(
        {
          senderName: "Retrieval Test",
          senderHandle: "@retrievaltest",
          content: "This DM should be retrievable.",
          timestamp: "2024-06-25T09:00:00Z",
        },
        "facebook"
      );

      const fetched = getDM(dm.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(dm.id);
      expect(fetched!.senderName).toBe("Retrieval Test");
      expect(fetched!.content).toBe("This DM should be retrievable.");
    });

    it("stores the ingested DM so it appears in getInbox results", () => {
      const uniqueContent = `Unique inbox test content ${Date.now()}`;

      ingestDM(
        {
          senderName: "Inbox Appearance Test",
          senderHandle: "@inboxtest",
          content: uniqueContent,
        },
        "instagram"
      );

      const inbox = getInbox({ search: uniqueContent });

      expect(inbox.data.length).toBeGreaterThanOrEqual(1);
      expect(inbox.data.some((dm) => dm.content === uniqueContent)).toBe(true);
    });
  });

  describe("deduplication", () => {
    it("prevents duplicate DMs with the same ID from being stored twice", () => {
      const raw = {
        id: "dedup-test-001",
        senderName: "Dedup Test",
        senderHandle: "@deduptest",
        content: "This is a deduplication test message.",
        timestamp: "2024-07-01T10:00:00Z",
      };

      const dm1 = ingestDM(raw, "facebook");
      const dm2 = ingestDM(raw, "facebook");

      // Both calls should return the same DM
      expect(dm1.senderName).toBe(dm2.senderName);
      expect(dm1.content).toBe(dm2.content);

      // Verify only one copy exists in the inbox
      const inbox = getInbox({ search: "This is a deduplication test message." });
      const matchingDMs = inbox.data.filter(
        (dm) => dm.content === "This is a deduplication test message."
      );
      expect(matchingDMs.length).toBe(1);
    });

    it("prevents duplicate DMs with same platform, handle, content, and timestamp", () => {
      const uniqueContent = `Dedup content match test ${Date.now()}`;
      const raw = {
        senderName: "Dedup Content Test",
        senderHandle: "@dedupcontent",
        content: uniqueContent,
        timestamp: "2024-07-01T11:00:00Z",
      };

      const dm1 = ingestDM(raw, "instagram");
      const dm2 = ingestDM(raw, "instagram");

      // Should return the same DM data
      expect(dm1.content).toBe(dm2.content);
      expect(dm1.senderHandle).toBe(dm2.senderHandle);

      // Verify only one copy in search results
      const inbox = getInbox({ search: uniqueContent });
      const matchingDMs = inbox.data.filter(
        (dm) => dm.content === uniqueContent
      );
      expect(matchingDMs.length).toBe(1);
    });

    it("allows DMs with different content even from the same sender", () => {
      const handle = `@diffcontent${Date.now()}`;
      const content1 = `First message from sender ${Date.now()}`;
      const content2 = `Second message from sender ${Date.now()}`;

      ingestDM(
        {
          senderName: "Multi Message",
          senderHandle: handle,
          content: content1,
          timestamp: "2024-07-01T12:00:00Z",
        },
        "facebook"
      );

      ingestDM(
        {
          senderName: "Multi Message",
          senderHandle: handle,
          content: content2,
          timestamp: "2024-07-01T12:01:00Z",
        },
        "facebook"
      );

      const dm1 = getInbox({ search: content1 });
      const dm2 = getInbox({ search: content2 });

      expect(dm1.data.length).toBeGreaterThanOrEqual(1);
      expect(dm2.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});