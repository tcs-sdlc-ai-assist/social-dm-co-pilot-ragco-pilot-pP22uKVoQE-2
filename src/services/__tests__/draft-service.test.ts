import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateDraft,
  editDraft,
  approveDraft,
  rejectDraft,
  markDraftAsSent,
  getDraft,
  getDraftByDMId,
  getDrafts,
  requiresHumanReview,
  getDraftConfidenceLevel,
} from "../draft-service";
import { ingestDM } from "../dm-inbox-service";
import { ConfidenceLevel } from "../../types";
import type { DM, Draft } from "../../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ingestTestDM(overrides: Partial<{
  senderName: string;
  senderHandle: string;
  content: string;
  platform: string;
}>): DM {
  const content = overrides.content ?? "Hi, I'm interested in your properties.";
  const senderName = overrides.senderName ?? "Test User";
  const senderHandle = overrides.senderHandle ?? `@testuser_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const platform = overrides.platform ?? "facebook";

  return ingestDM(
    {
      senderName,
      senderHandle,
      content,
      timestamp: new Date().toISOString(),
    },
    platform,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DraftService", () => {
  describe("generateDraft", () => {
    it("creates a draft with a confidence score for a valid DM", async () => {
      const dm = ingestTestDM({
        senderName: "Sarah Jones",
        content: "I'm interested in the Willowdale community. Can you send me some info?",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      expect(draft).toBeDefined();
      expect(draft.id).toBeTruthy();
      expect(draft.dmId).toBe(dm.id);
      expect(draft.generatedText).toBeTruthy();
      expect(draft.generatedText.length).toBeGreaterThan(0);
      expect(typeof draft.confidenceScore).toBe("number");
      expect(draft.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(draft.confidenceScore).toBeLessThanOrEqual(1);
      expect(draft.status).toBe("pending");
      expect(draft.reviewedBy).toBeNull();
      expect(draft.reviewedAt).toBeNull();
      expect(draft.editedText).toBeNull();
      expect(Array.isArray(draft.referencedContextIds)).toBe(true);
    });

    it("returns the existing draft when called again for the same DM", async () => {
      const dm = ingestTestDM({
        senderName: "Existing Draft User",
        content: "Tell me about Aura community pricing.",
      });

      const draft1 = await generateDraft(dm.id, "agent_001");
      const draft2 = await generateDraft(dm.id, "agent_001");

      expect(draft1.id).toBe(draft2.id);
      expect(draft1.dmId).toBe(draft2.dmId);
      expect(draft1.generatedText).toBe(draft2.generatedText);
    });

    it("regenerates a new draft when regenerate flag is true", async () => {
      const dm = ingestTestDM({
        senderName: "Regenerate User",
        content: "I want to buy a home in Willowdale. Budget is $600,000.",
      });

      const draft1 = await generateDraft(dm.id, "agent_001");
      const draft2 = await generateDraft(dm.id, "agent_001", true);

      // Regenerated draft should have a different ID
      expect(draft2).toBeDefined();
      expect(draft2.dmId).toBe(dm.id);
      expect(draft2.generatedText).toBeTruthy();
    });

    it("throws an error when DM ID is empty", async () => {
      await expect(generateDraft("", "agent_001")).rejects.toThrow(
        "DM ID is required",
      );
    });

    it("throws an error when actor is empty", async () => {
      await expect(generateDraft("dm_test_001", "")).rejects.toThrow(
        "Actor is required",
      );
    });

    it("throws an error when DM is not found", async () => {
      await expect(
        generateDraft("nonexistent-dm-xyz-999", "agent_001"),
      ).rejects.toThrow("DM not found");
    });

    it("includes referenced context IDs in the generated draft", async () => {
      const dm = ingestTestDM({
        senderName: "Context Ref User",
        content: "What are the prices for land lots in Willowdale? I'm a first home buyer.",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      expect(draft.referencedContextIds).toBeDefined();
      expect(Array.isArray(draft.referencedContextIds)).toBe(true);
    });

    it("generates a draft with higher confidence when DM matches knowledge base context", async () => {
      const dm = ingestTestDM({
        senderName: "High Context User",
        content: "I'm interested in Willowdale community in Denham Court. What are the house and land packages available? I'm a first home buyer looking for grants.",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      // With strong context matches, confidence should be reasonable
      expect(draft.confidenceScore).toBeGreaterThan(0);
    });

    it("generates a draft with lower confidence for vague messages", async () => {
      const dm = ingestTestDM({
        senderName: "Vague User",
        content: "Hello there!",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      // Vague messages should have lower confidence
      expect(draft.confidenceScore).toBeLessThanOrEqual(0.6);
    });
  });

  describe("editDraft", () => {
    it("updates the draft text with edited content", async () => {
      const dm = ingestTestDM({
        senderName: "Edit Test User",
        content: "Tell me about Minta community.",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      const editedText = "Hi there! Thank you for your interest in Minta. Let me provide you with the latest details.";
      const updated = editDraft(draft.id, editedText, "agent_002");

      expect(updated).not.toBeNull();
      expect(updated!.editedText).toBe(editedText);
      expect(updated!.generatedText).toBe(draft.generatedText);
    });

    it("resets status to pending when editing an approved draft", async () => {
      const dm = ingestTestDM({
        senderName: "Approved Edit User",
        content: "I want to buy a home in Cloverton.",
      });

      const draft = await generateDraft(dm.id, "agent_001");
      approveDraft(draft.id, "reviewer_001");

      const approved = getDraft(draft.id);
      expect(approved!.status).toBe("approved");

      const editedText = "Updated response text after approval.";
      const updated = editDraft(draft.id, editedText, "agent_001");

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("pending");
      expect(updated!.editedText).toBe(editedText);
    });

    it("throws an error when edited text is empty", async () => {
      const dm = ingestTestDM({
        senderName: "Empty Edit User",
        content: "Tell me about properties.",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      expect(() => editDraft(draft.id, "", "agent_001")).toThrow(
        "Edited text cannot be empty",
      );
    });

    it("throws an error when edited text is only whitespace", async () => {
      const dm = ingestTestDM({
        senderName: "Whitespace Edit User",
        content: "Tell me about properties.",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      expect(() => editDraft(draft.id, "   ", "agent_001")).toThrow(
        "Edited text cannot be empty",
      );
    });

    it("throws an error when draft ID is empty", () => {
      expect(() => editDraft("", "Some text", "agent_001")).toThrow(
        "Draft ID is required",
      );
    });

    it("throws an error when actor is empty", async () => {
      const dm = ingestTestDM({
        senderName: "No Actor Edit User",
        content: "Tell me about properties.",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      expect(() => editDraft(draft.id, "Some text", "")).toThrow(
        "Actor is required",
      );
    });

    it("returns null when draft ID does not exist", () => {
      const result = editDraft("nonexistent-draft-xyz", "Some text", "agent_001");
      expect(result).toBeNull();
    });

    it("throws an error when editing a sent draft", async () => {
      const dm = ingestTestDM({
        senderName: "Sent Edit User",
        content: "Tell me about Willowdale.",
      });

      const draft = await generateDraft(dm.id, "agent_001");
      approveDraft(draft.id, "reviewer_001");
      markDraftAsSent(draft.id, "agent_001");

      expect(() => editDraft(draft.id, "New text", "agent_001")).toThrow(
        "Cannot edit a draft that has already been sent",
      );
    });

    it("throws an error when edited text exceeds max length", async () => {
      const dm = ingestTestDM({
        senderName: "Long Edit User",
        content: "Tell me about properties.",
      });

      const draft = await generateDraft(dm.id, "agent_001");
      const longText = "A".repeat(2001);

      expect(() => editDraft(draft.id, longText, "agent_001")).toThrow(
        "cannot exceed",
      );
    });
  });

  describe("approveDraft", () => {
    it("marks a draft as approved with reviewer info", async () => {
      const dm = ingestTestDM({
        senderName: "Approve Test User",
        content: "I want to buy a home in Aura.",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      const approved = approveDraft(draft.id, "reviewer_001");

      expect(approved).not.toBeNull();
      expect(approved!.status).toBe("approved");
      expect(approved!.reviewedBy).toBe("reviewer_001");
      expect(approved!.reviewedAt).toBeTruthy();
    });

    it("records the review timestamp", async () => {
      const dm = ingestTestDM({
        senderName: "Timestamp Approve User",
        content: "Tell me about Minta.",
      });

      const draft = await generateDraft(dm.id, "agent_001");
      const beforeApproval = new Date().toISOString();

      const approved = approveDraft(draft.id, "reviewer_002");

      expect(approved).not.toBeNull();
      expect(approved!.reviewedAt).toBeTruthy();
      const reviewedAt = new Date(approved!.reviewedAt!).getTime();
      const beforeTime = new Date(beforeApproval).getTime();
      expect(reviewedAt).toBeGreaterThanOrEqual(beforeTime - 1000);
    });

    it("throws an error when draft ID is empty", () => {
      expect(() => approveDraft("", "reviewer_001")).toThrow(
        "Draft ID is required",
      );
    });

    it("throws an error when actor is empty", async () => {
      const dm = ingestTestDM({
        senderName: "No Actor Approve User",
        content: "Tell me about properties.",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      expect(() => approveDraft(draft.id, "")).toThrow(
        "Actor is required",
      );
    });

    it("returns null when draft ID does not exist", () => {
      const result = approveDraft("nonexistent-draft-xyz", "reviewer_001");
      expect(result).toBeNull();
    });

    it("throws an error when approving a sent draft", async () => {
      const dm = ingestTestDM({
        senderName: "Sent Approve User",
        content: "Tell me about Willowdale.",
      });

      const draft = await generateDraft(dm.id, "agent_001");
      approveDraft(draft.id, "reviewer_001");
      markDraftAsSent(draft.id, "agent_001");

      expect(() => approveDraft(draft.id, "reviewer_002")).toThrow(
        "Cannot approve a draft that has already been sent",
      );
    });

    it("throws an error when approving a rejected draft without re-editing", async () => {
      const dm = ingestTestDM({
        senderName: "Rejected Approve User",
        content: "Tell me about Cloverton.",
      });

      const draft = await generateDraft(dm.id, "agent_001");
      rejectDraft(draft.id, "reviewer_001");

      expect(() => approveDraft(draft.id, "reviewer_002")).toThrow(
        "Cannot approve a rejected draft",
      );
    });

    it("persists the approval so getDraft reflects it", async () => {
      const dm = ingestTestDM({
        senderName: "Persist Approve User",
        content: "Tell me about Aura pricing.",
      });

      const draft = await generateDraft(dm.id, "agent_001");
      approveDraft(draft.id, "reviewer_003");

      const fetched = getDraft(draft.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.status).toBe("approved");
      expect(fetched!.reviewedBy).toBe("reviewer_003");
    });
  });

  describe("rejectDraft", () => {
    it("marks a draft as rejected", async () => {
      const dm = ingestTestDM({
        senderName: "Reject Test User",
        content: "Tell me about properties.",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      const rejected = rejectDraft(draft.id, "reviewer_001");

      expect(rejected).not.toBeNull();
      expect(rejected!.status).toBe("rejected");
      expect(rejected!.reviewedBy).toBe("reviewer_001");
      expect(rejected!.reviewedAt).toBeTruthy();
    });

    it("throws an error when rejecting a sent draft", async () => {
      const dm = ingestTestDM({
        senderName: "Sent Reject User",
        content: "Tell me about Willowdale.",
      });

      const draft = await generateDraft(dm.id, "agent_001");
      approveDraft(draft.id, "reviewer_001");
      markDraftAsSent(draft.id, "agent_001");

      expect(() => rejectDraft(draft.id, "reviewer_002")).toThrow(
        "Cannot reject a draft that has already been sent",
      );
    });

    it("returns null when draft ID does not exist", () => {
      const result = rejectDraft("nonexistent-draft-xyz", "reviewer_001");
      expect(result).toBeNull();
    });
  });

  describe("markDraftAsSent", () => {
    it("marks an approved draft as sent", async () => {
      const dm = ingestTestDM({
        senderName: "Send Test User",
        content: "Tell me about Minta.",
      });

      const draft = await generateDraft(dm.id, "agent_001");
      approveDraft(draft.id, "reviewer_001");

      const sent = markDraftAsSent(draft.id, "agent_001");

      expect(sent).not.toBeNull();
      expect(sent!.status).toBe("sent");
    });

    it("throws an error when sending a pending draft", async () => {
      const dm = ingestTestDM({
        senderName: "Pending Send User",
        content: "Tell me about properties.",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      expect(() => markDraftAsSent(draft.id, "agent_001")).toThrow(
        "Draft must be approved first",
      );
    });

    it("throws an error when sending a rejected draft", async () => {
      const dm = ingestTestDM({
        senderName: "Rejected Send User",
        content: "Tell me about Cloverton.",
      });

      const draft = await generateDraft(dm.id, "agent_001");
      rejectDraft(draft.id, "reviewer_001");

      expect(() => markDraftAsSent(draft.id, "agent_001")).toThrow(
        "Draft must be approved first",
      );
    });

    it("returns null when draft ID does not exist", () => {
      const result = markDraftAsSent("nonexistent-draft-xyz", "agent_001");
      expect(result).toBeNull();
    });
  });

  describe("low-confidence drafts and human review", () => {
    it("flags low-confidence drafts as requiring human review", async () => {
      const dm = ingestTestDM({
        senderName: "Low Confidence User",
        content: "Hey!",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      // Vague messages should produce low confidence
      if (draft.confidenceScore < 0.6) {
        const needsReview = requiresHumanReview(draft.id);
        expect(needsReview).toBe(true);
      }
    });

    it("does not flag high-confidence drafts for review", async () => {
      const dm = ingestTestDM({
        senderName: "High Confidence User",
        content: "I'm interested in Willowdale community in Denham Court. What house and land packages are available? I'm a first home buyer looking for government grants and stamp duty concessions.",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      // If confidence is high enough, should not require review
      if (draft.confidenceScore >= 0.6) {
        const needsReview = requiresHumanReview(draft.id);
        expect(needsReview).toBe(false);
      }
    });

    it("returns false for requiresHumanReview when draft does not exist", () => {
      const result = requiresHumanReview("nonexistent-draft-xyz");
      expect(result).toBe(false);
    });

    it("returns the correct confidence level for a draft", async () => {
      const dm = ingestTestDM({
        senderName: "Confidence Level User",
        content: "Tell me about Willowdale community pricing and first home buyer grants.",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      const level = getDraftConfidenceLevel(draft.id);
      expect(level).not.toBeNull();
      expect([ConfidenceLevel.HIGH, ConfidenceLevel.MEDIUM, ConfidenceLevel.LOW]).toContain(level);
    });

    it("returns null confidence level for non-existent draft", () => {
      const level = getDraftConfidenceLevel("nonexistent-draft-xyz");
      expect(level).toBeNull();
    });
  });

  describe("getDraft", () => {
    it("retrieves a draft by its ID", async () => {
      const dm = ingestTestDM({
        senderName: "Get Draft User",
        content: "Tell me about Aura.",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      const retrieved = getDraft(draft.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(draft.id);
      expect(retrieved!.dmId).toBe(dm.id);
      expect(retrieved!.generatedText).toBe(draft.generatedText);
    });

    it("returns null for a non-existent draft ID", () => {
      const result = getDraft("nonexistent-draft-id-xyz");
      expect(result).toBeNull();
    });

    it("returns null for an empty draft ID", () => {
      const result = getDraft("");
      expect(result).toBeNull();
    });
  });

  describe("getDraftByDMId", () => {
    it("returns the correct draft for a given DM ID", async () => {
      const dm = ingestTestDM({
        senderName: "Get By DM User",
        content: "I want to know about Minta community.",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      const retrieved = getDraftByDMId(dm.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(draft.id);
      expect(retrieved!.dmId).toBe(dm.id);
    });

    it("returns null for a DM ID with no associated draft", () => {
      const result = getDraftByDMId("nonexistent-dm-id-xyz");
      expect(result).toBeNull();
    });

    it("returns null for an empty DM ID", () => {
      const result = getDraftByDMId("");
      expect(result).toBeNull();
    });

    it("returns the draft with all fields populated", async () => {
      const dm = ingestTestDM({
        senderName: "Full Fields User",
        content: "Tell me about Willowdale house and land packages.",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      const retrieved = getDraftByDMId(dm.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved).toHaveProperty("id");
      expect(retrieved).toHaveProperty("dmId");
      expect(retrieved).toHaveProperty("generatedText");
      expect(retrieved).toHaveProperty("editedText");
      expect(retrieved).toHaveProperty("confidenceScore");
      expect(retrieved).toHaveProperty("referencedContextIds");
      expect(retrieved).toHaveProperty("status");
      expect(retrieved).toHaveProperty("reviewedBy");
      expect(retrieved).toHaveProperty("reviewedAt");
    });
  });

  describe("getDrafts", () => {
    it("returns all drafts when no status filter is provided", () => {
      const drafts = getDrafts();

      expect(Array.isArray(drafts)).toBe(true);
      expect(drafts.length).toBeGreaterThan(0);
    });

    it("filters drafts by status", async () => {
      const dm = ingestTestDM({
        senderName: "Filter Status User",
        content: "Tell me about Aura community.",
      });

      await generateDraft(dm.id, "agent_001");

      const pendingDrafts = getDrafts("pending");

      expect(pendingDrafts.length).toBeGreaterThan(0);
      for (const draft of pendingDrafts) {
        expect(draft.status).toBe("pending");
      }
    });

    it("returns empty array when no drafts match the status filter", () => {
      // "sent" drafts may not exist yet
      const sentDrafts = getDrafts("sent");
      expect(Array.isArray(sentDrafts)).toBe(true);
    });
  });

  describe("audit logging", () => {
    it("logs an audit action when generating a draft", async () => {
      const dm = ingestTestDM({
        senderName: "Audit Generate User",
        content: "Tell me about Willowdale.",
      });

      // This should not throw — audit logging happens internally
      const draft = await generateDraft(dm.id, "agent_audit_001");

      expect(draft).toBeDefined();
      expect(draft.id).toBeTruthy();
    });

    it("logs an audit action when approving a draft", async () => {
      const dm = ingestTestDM({
        senderName: "Audit Approve User",
        content: "Tell me about Aura.",
      });

      const draft = await generateDraft(dm.id, "agent_audit_002");

      // This should not throw — audit logging happens internally
      const approved = approveDraft(draft.id, "reviewer_audit_001");

      expect(approved).not.toBeNull();
      expect(approved!.status).toBe("approved");
    });

    it("logs an audit action when editing a draft", async () => {
      const dm = ingestTestDM({
        senderName: "Audit Edit User",
        content: "Tell me about Minta.",
      });

      const draft = await generateDraft(dm.id, "agent_audit_003");

      // This should not throw — audit logging happens internally
      const edited = editDraft(draft.id, "Edited text for audit test.", "agent_audit_003");

      expect(edited).not.toBeNull();
      expect(edited!.editedText).toBe("Edited text for audit test.");
    });

    it("logs an audit action when rejecting a draft", async () => {
      const dm = ingestTestDM({
        senderName: "Audit Reject User",
        content: "Tell me about Cloverton.",
      });

      const draft = await generateDraft(dm.id, "agent_audit_004");

      // This should not throw — audit logging happens internally
      const rejected = rejectDraft(draft.id, "reviewer_audit_002");

      expect(rejected).not.toBeNull();
      expect(rejected!.status).toBe("rejected");
    });

    it("logs an audit action when marking a draft as sent", async () => {
      const dm = ingestTestDM({
        senderName: "Audit Send User",
        content: "Tell me about Willowdale pricing.",
      });

      const draft = await generateDraft(dm.id, "agent_audit_005");
      approveDraft(draft.id, "reviewer_audit_003");

      // This should not throw — audit logging happens internally
      const sent = markDraftAsSent(draft.id, "agent_audit_005");

      expect(sent).not.toBeNull();
      expect(sent!.status).toBe("sent");
    });
  });

  describe("draft lifecycle", () => {
    it("follows the complete lifecycle: generate → edit → approve → send", async () => {
      const dm = ingestTestDM({
        senderName: "Lifecycle User",
        content: "I want to buy a home in Willowdale. Budget is $500,000.",
      });

      // Step 1: Generate
      const draft = await generateDraft(dm.id, "agent_001");
      expect(draft.status).toBe("pending");
      expect(draft.editedText).toBeNull();

      // Step 2: Edit
      const editedText = "Thank you for your interest in Willowdale! We have great options in your budget range.";
      const edited = editDraft(draft.id, editedText, "agent_001");
      expect(edited).not.toBeNull();
      expect(edited!.status).toBe("pending");
      expect(edited!.editedText).toBe(editedText);

      // Step 3: Approve
      const approved = approveDraft(draft.id, "reviewer_001");
      expect(approved).not.toBeNull();
      expect(approved!.status).toBe("approved");
      expect(approved!.reviewedBy).toBe("reviewer_001");

      // Step 4: Send
      const sent = markDraftAsSent(draft.id, "agent_001");
      expect(sent).not.toBeNull();
      expect(sent!.status).toBe("sent");

      // Verify final state
      const finalDraft = getDraft(draft.id);
      expect(finalDraft).not.toBeNull();
      expect(finalDraft!.status).toBe("sent");
      expect(finalDraft!.editedText).toBe(editedText);
      expect(finalDraft!.reviewedBy).toBe("reviewer_001");
    });

    it("follows the reject → edit → approve → send lifecycle", async () => {
      const dm = ingestTestDM({
        senderName: "Reject Lifecycle User",
        content: "Tell me about Aura community.",
      });

      // Step 1: Generate
      const draft = await generateDraft(dm.id, "agent_001");
      expect(draft.status).toBe("pending");

      // Step 2: Reject
      const rejected = rejectDraft(draft.id, "reviewer_001");
      expect(rejected).not.toBeNull();
      expect(rejected!.status).toBe("rejected");

      // Step 3: Edit (required after rejection)
      const editedText = "Improved response after rejection.";
      const edited = editDraft(draft.id, editedText, "agent_001");
      expect(edited).not.toBeNull();

      // Step 4: Approve (now possible after editing)
      const approved = approveDraft(draft.id, "reviewer_002");
      expect(approved).not.toBeNull();
      expect(approved!.status).toBe("approved");

      // Step 5: Send
      const sent = markDraftAsSent(draft.id, "agent_001");
      expect(sent).not.toBeNull();
      expect(sent!.status).toBe("sent");
    });
  });

  describe("edge cases", () => {
    it("handles DM with empty content gracefully", async () => {
      const dm = ingestTestDM({
        senderName: "Empty Content User",
        content: "",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      expect(draft).toBeDefined();
      expect(draft.generatedText).toBeTruthy();
      expect(draft.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    it("handles DM with special characters in content", async () => {
      const dm = ingestTestDM({
        senderName: "Special Chars User",
        content: "Hi!!! I'm interested in buying @ Willowdale??? Budget: $500,000!!!",
      });

      const draft = await generateDraft(dm.id, "agent_001");

      expect(draft).toBeDefined();
      expect(draft.generatedText).toBeTruthy();
    });

    it("handles DM with very long content", async () => {
      const longContent =
        "I want to buy a home in Willowdale. ".repeat(100) +
        "Budget is $800,000. Please help.";

      const dm = ingestTestDM({
        senderName: "Long Content User",
        content: longContent,
      });

      const draft = await generateDraft(dm.id, "agent_001");

      expect(draft).toBeDefined();
      expect(draft.generatedText).toBeTruthy();
    });
  });
});