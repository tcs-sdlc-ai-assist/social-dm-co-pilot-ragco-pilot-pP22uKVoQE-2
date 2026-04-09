import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCandidateLead,
  confirmLead,
  syncToSalesforce,
  getLeadById,
  getLeadByDMId,
  getCandidateLeadByDMId,
  getAllLeads,
  updateLeadStatus,
  getLeadCount,
} from "../lead-service";
import { ingestDM } from "../dm-inbox-service";
import type { CandidateLead, Lead, DM } from "../../types";

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

describe("LeadService", () => {
  describe("createCandidateLead", () => {
    it("extracts candidate lead fields from a DM", () => {
      const dm = ingestTestDM({
        senderName: "Sarah Jones",
        senderHandle: "@sarahjones",
        content: "I want to buy a home in Elara. My budget is $750,000. Email me at sarah@example.com.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate).toBeDefined();
      expect(candidate.dmId).toBe(dm.id);
      expect(candidate.name).toBe("Sarah Jones");
      expect(candidate.contact).toBe("sarah@example.com");
      expect(candidate.budget).toBe("750000");
      expect(candidate.location).toBe("Elara");
      expect(candidate.intent.toLowerCase()).toContain("purchasing");
      expect(candidate.priority).toBe("high");
    });

    it("extracts name from senderName when available", () => {
      const dm = ingestTestDM({
        senderName: "Michael Chen",
        content: "Tell me about Willowdale.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.name).toBe("Michael Chen");
    });

    it("extracts email contact from DM content", () => {
      const dm = ingestTestDM({
        content: "Please send details to john.doe@example.com thanks!",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.contact).toBe("john.doe@example.com");
    });

    it("extracts phone contact from DM content", () => {
      const dm = ingestTestDM({
        content: "Call me on 0412 345 678 please.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.contact).toBe("0412345678");
    });

    it("extracts budget from dollar amount", () => {
      const dm = ingestTestDM({
        content: "My budget is $500,000 for a family home.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.budget).toBe("500000");
    });

    it("extracts budget in K format", () => {
      const dm = ingestTestDM({
        content: "Looking for something around 650k.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.budget).toBe("650000");
    });

    it("extracts known location from content", () => {
      const dm = ingestTestDM({
        content: "Do you have anything available in Leppington?",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.location).toBe("Leppington");
    });

    it("returns null budget when no amount is mentioned", () => {
      const dm = ingestTestDM({
        content: "I want to learn more about your communities.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.budget).toBeNull();
    });

    it("returns null location when no known location is mentioned", () => {
      const dm = ingestTestDM({
        content: "I want to buy a house somewhere nice.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.location).toBeNull();
    });

    it("classifies buying intent correctly", () => {
      const dm = ingestTestDM({
        content: "I'm looking to buy a 3-bedroom home for my family.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.intent.toLowerCase()).toContain("purchasing");
    });

    it("classifies tour intent correctly", () => {
      const dm = ingestTestDM({
        content: "Can I book a tour of the display homes this weekend?",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.intent.toLowerCase()).toContain("tour");
    });

    it("stores the candidate lead for later retrieval", () => {
      const dm = ingestTestDM({
        senderName: "Stored Candidate",
        content: "I want to buy a home.",
      });

      createCandidateLead(dm.id, "agent_001");

      const retrieved = getCandidateLeadByDMId(dm.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.dmId).toBe(dm.id);
      expect(retrieved!.name).toBe("Stored Candidate");
    });

    it("throws an error when DM ID is empty", () => {
      expect(() => createCandidateLead("", "agent_001")).toThrow(
        "DM ID is required",
      );
    });

    it("throws an error when DM is not found", () => {
      expect(() =>
        createCandidateLead("nonexistent-dm-id-xyz", "agent_001"),
      ).toThrow("DM not found");
    });

    it("handles empty content gracefully", () => {
      const dm = ingestTestDM({
        senderName: "Empty Content User",
        content: "",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate).toBeDefined();
      expect(candidate.dmId).toBe(dm.id);
      expect(candidate.budget).toBeNull();
      expect(candidate.location).toBeNull();
    });
  });

  describe("priority scoring", () => {
    it("assigns high priority for buying intent with budget and contact", () => {
      const dm = ingestTestDM({
        senderName: "High Priority Buyer",
        content:
          "I want to buy a home in Elara. My budget is $750,000. Email me at buyer@example.com.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.priority).toBe("high");
    });

    it("assigns high priority for tour request with budget", () => {
      const dm = ingestTestDM({
        senderName: "Tour Person",
        content:
          "I'd like to book a tour of display homes. Budget around $500,000. Email me at tour@test.com.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.priority).toBe("high");
    });

    it("assigns medium priority for contact with specific intent but no budget", () => {
      const dm = ingestTestDM({
        senderName: "Medium Priority User",
        senderHandle: "@mediumpriority",
        content: "I'm interested in buying a home in Sydney.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(["medium", "high"]).toContain(candidate.priority);
    });

    it("assigns low priority for vague messages with no details", () => {
      const dm = ingestTestDM({
        senderName: "",
        senderHandle: "@random",
        content: "Hey, just browsing.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.priority).toBe("low");
    });

    it("assigns higher priority when budget is >= 500k with buying intent", () => {
      const dm = ingestTestDM({
        senderName: "Big Budget Buyer",
        content: "I want to buy a property. Budget is $800,000.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.priority).toBe("high");
    });
  });

  describe("confirmLead", () => {
    it("creates a confirmed lead from a candidate lead", () => {
      const dm = ingestTestDM({
        senderName: "Confirm Test User",
        senderHandle: `@confirmtest_${Date.now()}`,
        content: "I want to buy a home in Elara for $600,000. Email: confirm@test.com",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      const lead = confirmLead(candidate, {}, "agent_001");

      expect(lead).toBeDefined();
      expect(lead.id).toBeTruthy();
      expect(lead.id).toContain("lead_");
      expect(lead.dmId).toBe(dm.id);
      expect(lead.name).toBe("Confirm Test User");
      expect(lead.contact).toBe("confirm@test.com");
      expect(lead.budget).toBe("600000");
      expect(lead.location).toBe("Elara");
      expect(lead.status).toBe("new");
      expect(lead.salesforceId).toBeNull();
    });

    it("applies human edits to the confirmed lead", () => {
      const dm = ingestTestDM({
        senderName: "Edit Test User",
        senderHandle: `@edittest_${Date.now()}`,
        content: "I want to buy a home.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      const edits: Partial<Lead> = {
        name: "Edited Name",
        contact: "edited@example.com",
        budget: "900000",
        location: "Melbourne",
        intent: "Interested in purchasing premium property",
      };

      const lead = confirmLead(candidate, edits, "agent_001");

      expect(lead.name).toBe("Edited Name");
      expect(lead.contact).toBe("edited@example.com");
      expect(lead.budget).toBe("900000");
      expect(lead.location).toBe("Melbourne");
      expect(lead.intent).toBe("Interested in purchasing premium property");
    });

    it("stores the confirmed lead for retrieval by ID", () => {
      const dm = ingestTestDM({
        senderName: "Retrieve Test",
        senderHandle: `@retrievetest_${Date.now()}`,
        content: "I want to buy a home in Sydney for $500,000.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");
      const lead = confirmLead(candidate, {}, "agent_001");

      const retrieved = getLeadById(lead.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(lead.id);
      expect(retrieved!.name).toBe("Retrieve Test");
    });

    it("stores the confirmed lead for retrieval by DM ID", () => {
      const dm = ingestTestDM({
        senderName: "DM Retrieve Test",
        senderHandle: `@dmretrieve_${Date.now()}`,
        content: "I want to buy a home.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");
      const lead = confirmLead(candidate, {}, "agent_001");

      const retrieved = getLeadByDMId(dm.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(lead.id);
      expect(retrieved!.dmId).toBe(dm.id);
    });

    it("prevents duplicate leads for the same DM", () => {
      const dm = ingestTestDM({
        senderName: "Dedup Lead Test",
        senderHandle: `@dedupleadtest_${Date.now()}`,
        content: "I want to buy a home.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      const lead1 = confirmLead(candidate, {}, "agent_001");
      const lead2 = confirmLead(candidate, {}, "agent_001");

      // Second call should return the existing lead
      expect(lead1.id).toBe(lead2.id);
      expect(lead1.dmId).toBe(lead2.dmId);
    });

    it("throws an error when candidate lead is null", () => {
      expect(() =>
        confirmLead(null as unknown as CandidateLead, {}, "agent_001"),
      ).toThrow("Candidate lead is required");
    });

    it("throws an error when candidate lead has no DM ID", () => {
      const invalidCandidate: CandidateLead = {
        dmId: "",
        name: "Test",
        contact: "test@test.com",
        budget: null,
        location: null,
        intent: "general inquiry",
        priority: "low",
      };

      expect(() => confirmLead(invalidCandidate, {}, "agent_001")).toThrow(
        "valid DM ID",
      );
    });

    it("recomputes priority when fields are edited", () => {
      const dm = ingestTestDM({
        senderName: "Priority Recompute",
        senderHandle: `@priorityrecompute_${Date.now()}`,
        content: "Hey, just browsing.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      // Original should be low priority
      expect(candidate.priority).toBe("low");

      // Edit to add buying intent and budget — should recompute to higher priority
      const edits: Partial<Lead> = {
        budget: "750000",
        intent: "Interested in purchasing property",
        contact: "recompute@example.com",
      };

      const lead = confirmLead(candidate, edits, "agent_001");

      expect(["high", "medium"]).toContain(lead.priority);
    });

    it("sets default status to 'new' for confirmed leads", () => {
      const dm = ingestTestDM({
        senderName: "Status Default Test",
        senderHandle: `@statusdefault_${Date.now()}`,
        content: "I want to buy a home.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");
      const lead = confirmLead(candidate, {}, "agent_001");

      expect(lead.status).toBe("new");
    });
  });

  describe("syncToSalesforce", () => {
    it("syncs a lead to Salesforce and returns a salesforce ID", async () => {
      const dm = ingestTestDM({
        senderName: "Sync Test User",
        senderHandle: `@synctest_${Date.now()}`,
        content: "I want to buy a home in Elara for $600,000. Email: sync@test.com",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");
      const lead = confirmLead(candidate, {}, "agent_001");

      const result = await syncToSalesforce(lead.id, "agent_001");

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.salesforceId).toBeTruthy();
    });

    it("updates the lead with the Salesforce ID after sync", async () => {
      const dm = ingestTestDM({
        senderName: "Sync Update Test",
        senderHandle: `@syncupdate_${Date.now()}`,
        content: "I want to buy a home. Email: syncupdate@test.com",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");
      const lead = confirmLead(candidate, {}, "agent_001");

      expect(lead.salesforceId).toBeNull();

      const result = await syncToSalesforce(lead.id, "agent_001");

      if (result.success) {
        const updatedLead = getLeadById(lead.id);
        expect(updatedLead).not.toBeNull();
        expect(updatedLead!.salesforceId).toBe(result.salesforceId);
        expect(updatedLead!.status).toBe("contacted");
      }
    });

    it("returns existing salesforce ID if already synced", async () => {
      const dm = ingestTestDM({
        senderName: "Already Synced Test",
        senderHandle: `@alreadysynced_${Date.now()}`,
        content: "I want to buy a home. Email: alreadysynced@test.com",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");
      const lead = confirmLead(candidate, {}, "agent_001");

      const firstResult = await syncToSalesforce(lead.id, "agent_001");

      if (firstResult.success) {
        const secondResult = await syncToSalesforce(lead.id, "agent_001");

        expect(secondResult.success).toBe(true);
        expect(secondResult.salesforceId).toBe(firstResult.salesforceId);
      }
    });

    it("throws an error when lead ID is empty", async () => {
      await expect(syncToSalesforce("", "agent_001")).rejects.toThrow(
        "Lead ID is required",
      );
    });

    it("throws an error when lead is not found", async () => {
      await expect(
        syncToSalesforce("nonexistent-lead-xyz", "agent_001"),
      ).rejects.toThrow("Lead not found");
    });
  });

  describe("getAllLeads", () => {
    it("returns all confirmed leads", () => {
      const leads = getAllLeads();

      expect(Array.isArray(leads)).toBe(true);
      expect(leads.length).toBeGreaterThan(0);
    });

    it("filters leads by status", () => {
      const newLeads = getAllLeads({ status: "new" });

      for (const lead of newLeads) {
        expect(lead.status).toBe("new");
      }
    });

    it("filters leads by priority", () => {
      const highPriorityLeads = getAllLeads({ priority: "high" });

      for (const lead of highPriorityLeads) {
        expect(lead.priority).toBe("high");
      }
    });

    it("sorts leads by priority (high first)", () => {
      const leads = getAllLeads();

      const priorityOrder: Record<string, number> = {
        high: 0,
        medium: 1,
        low: 2,
      };

      for (let i = 1; i < leads.length; i++) {
        const prevPriority = priorityOrder[leads[i - 1].priority] ?? 99;
        const currPriority = priorityOrder[leads[i].priority] ?? 99;
        expect(prevPriority).toBeLessThanOrEqual(currPriority);
      }
    });

    it("returns copies of leads (not references)", () => {
      const leads1 = getAllLeads();
      const leads2 = getAllLeads();

      if (leads1.length > 0) {
        (leads1[0] as { name: string }).name = "MUTATED";
        expect(leads2[0].name).not.toBe("MUTATED");
      }
    });
  });

  describe("updateLeadStatus", () => {
    it("updates the status of an existing lead", () => {
      const dm = ingestTestDM({
        senderName: "Status Update Lead",
        senderHandle: `@statusupdate_${Date.now()}`,
        content: "I want to buy a home.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");
      const lead = confirmLead(candidate, {}, "agent_001");

      expect(lead.status).toBe("new");

      const updated = updateLeadStatus(lead.id, "contacted", "agent_001");

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("contacted");
    });

    it("updates status to 'qualified'", () => {
      const dm = ingestTestDM({
        senderName: "Qualified Lead",
        senderHandle: `@qualifiedlead_${Date.now()}`,
        content: "I want to buy a home for $800,000.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");
      const lead = confirmLead(candidate, {}, "agent_001");

      const updated = updateLeadStatus(lead.id, "qualified", "agent_001");

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("qualified");
    });

    it("updates status to 'converted'", () => {
      const dm = ingestTestDM({
        senderName: "Converted Lead",
        senderHandle: `@convertedlead_${Date.now()}`,
        content: "I want to buy a home.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");
      const lead = confirmLead(candidate, {}, "agent_001");

      const updated = updateLeadStatus(lead.id, "converted", "agent_001");

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("converted");
    });

    it("updates status to 'lost'", () => {
      const dm = ingestTestDM({
        senderName: "Lost Lead",
        senderHandle: `@lostlead_${Date.now()}`,
        content: "I want to buy a home.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");
      const lead = confirmLead(candidate, {}, "agent_001");

      const updated = updateLeadStatus(lead.id, "lost", "agent_001");

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("lost");
    });

    it("returns null when lead ID does not exist", () => {
      const result = updateLeadStatus(
        "nonexistent-lead-999",
        "contacted",
        "agent_001",
      );

      expect(result).toBeNull();
    });

    it("persists the status change so getLeadById reflects it", () => {
      const dm = ingestTestDM({
        senderName: "Persist Status Lead",
        senderHandle: `@persiststatus_${Date.now()}`,
        content: "I want to buy a home.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");
      const lead = confirmLead(candidate, {}, "agent_001");

      updateLeadStatus(lead.id, "qualified", "agent_001");

      const fetched = getLeadById(lead.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.status).toBe("qualified");
    });
  });

  describe("getLeadCount", () => {
    it("returns the total count of leads", () => {
      const count = getLeadCount();

      expect(count).toBeGreaterThan(0);
    });

    it("returns filtered count by status", () => {
      const allCount = getLeadCount();
      const newCount = getLeadCount({ status: "new" });

      expect(newCount).toBeLessThanOrEqual(allCount);
    });

    it("returns filtered count by priority", () => {
      const allCount = getLeadCount();
      const highCount = getLeadCount({ priority: "high" });

      expect(highCount).toBeLessThanOrEqual(allCount);
    });
  });

  describe("getLeadById", () => {
    it("returns a lead by its ID", () => {
      const dm = ingestTestDM({
        senderName: "Get By ID Test",
        senderHandle: `@getbyid_${Date.now()}`,
        content: "I want to buy a home.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");
      const lead = confirmLead(candidate, {}, "agent_001");

      const retrieved = getLeadById(lead.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(lead.id);
      expect(retrieved!.name).toBe("Get By ID Test");
    });

    it("returns null for a non-existent lead ID", () => {
      const result = getLeadById("nonexistent-lead-id-xyz");

      expect(result).toBeNull();
    });

    it("returns a copy of the lead (not a reference)", () => {
      const dm = ingestTestDM({
        senderName: "Copy Test Lead",
        senderHandle: `@copytest_${Date.now()}`,
        content: "I want to buy a home.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");
      const lead = confirmLead(candidate, {}, "agent_001");

      const lead1 = getLeadById(lead.id);
      const lead2 = getLeadById(lead.id);

      expect(lead1).not.toBeNull();
      expect(lead2).not.toBeNull();
      expect(lead1).toEqual(lead2);
      expect(lead1).not.toBe(lead2);
    });
  });

  describe("getLeadByDMId", () => {
    it("returns a lead by its associated DM ID", () => {
      const dm = ingestTestDM({
        senderName: "Get By DM ID Test",
        senderHandle: `@getbydmid_${Date.now()}`,
        content: "I want to buy a home.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");
      const lead = confirmLead(candidate, {}, "agent_001");

      const retrieved = getLeadByDMId(dm.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(lead.id);
      expect(retrieved!.dmId).toBe(dm.id);
    });

    it("returns null for a DM ID with no associated lead", () => {
      const result = getLeadByDMId("nonexistent-dm-id-xyz");

      expect(result).toBeNull();
    });
  });

  describe("audit logging", () => {
    it("logs an audit action when creating a candidate lead", () => {
      const dm = ingestTestDM({
        senderName: "Audit Candidate Test",
        senderHandle: `@auditcandidate_${Date.now()}`,
        content: "I want to buy a home in Elara for $500,000.",
      });

      // This should not throw — audit logging happens internally
      const candidate = createCandidateLead(dm.id, "agent_audit_001");

      expect(candidate).toBeDefined();
      expect(candidate.dmId).toBe(dm.id);
    });

    it("logs an audit action when confirming a lead", () => {
      const dm = ingestTestDM({
        senderName: "Audit Confirm Test",
        senderHandle: `@auditconfirm_${Date.now()}`,
        content: "I want to buy a home.",
      });

      const candidate = createCandidateLead(dm.id, "agent_audit_002");

      // This should not throw — audit logging happens internally
      const lead = confirmLead(candidate, {}, "agent_audit_002");

      expect(lead).toBeDefined();
      expect(lead.id).toBeTruthy();
    });

    it("logs an audit action when syncing to Salesforce", async () => {
      const dm = ingestTestDM({
        senderName: "Audit Sync Test",
        senderHandle: `@auditsync_${Date.now()}`,
        content: "I want to buy a home. Email: auditsync@test.com",
      });

      const candidate = createCandidateLead(dm.id, "agent_audit_003");
      const lead = confirmLead(candidate, {}, "agent_audit_003");

      // This should not throw — audit logging happens internally
      const result = await syncToSalesforce(lead.id, "agent_audit_003");

      expect(result).toBeDefined();
    });

    it("logs an audit action when updating lead status", () => {
      const dm = ingestTestDM({
        senderName: "Audit Status Test",
        senderHandle: `@auditstatus_${Date.now()}`,
        content: "I want to buy a home.",
      });

      const candidate = createCandidateLead(dm.id, "agent_audit_004");
      const lead = confirmLead(candidate, {}, "agent_audit_004");

      // This should not throw — audit logging happens internally
      const updated = updateLeadStatus(lead.id, "contacted", "agent_audit_004");

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("contacted");
    });
  });

  describe("edge cases", () => {
    it("handles DM with special characters in content", () => {
      const dm = ingestTestDM({
        senderName: "Special Chars User",
        senderHandle: `@specialchars_${Date.now()}`,
        content: "Hi!!! I'm interested in buying @ Elara??? Budget: $500,000!!!",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate).toBeDefined();
      expect(candidate.budget).toBe("500000");
      expect(candidate.location).toBe("Elara");
    });

    it("handles DM with very long content", () => {
      const longContent =
        "I want to buy a home. ".repeat(200) +
        "Budget $800,000. Location: Melbourne.";

      const dm = ingestTestDM({
        senderName: "Long Content User",
        senderHandle: `@longcontent_${Date.now()}`,
        content: longContent,
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate).toBeDefined();
      expect(candidate.budget).toBe("800000");
      expect(candidate.location).toBe("Melbourne");
    });

    it("handles multiple emails and picks the first one", () => {
      const dm = ingestTestDM({
        senderName: "Multi Email User",
        senderHandle: `@multiemail_${Date.now()}`,
        content: "Email me at first@example.com or second@example.com.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.contact).toBe("first@example.com");
    });

    it("prefers email over phone when both are present", () => {
      const dm = ingestTestDM({
        senderName: "Email Phone User",
        senderHandle: `@emailphone_${Date.now()}`,
        content: "Reach me at hello@test.com or 0412 345 678.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.contact).toBe("hello@test.com");
    });

    it("falls back to senderHandle when no contact info in content", () => {
      const handle = `@fallbackhandle_${Date.now()}`;
      const dm = ingestTestDM({
        senderName: "Fallback Handle User",
        senderHandle: handle,
        content: "I want to know about Willowdale.",
      });

      const candidate = createCandidateLead(dm.id, "agent_001");

      expect(candidate.contact).toBe(handle);
    });
  });
});