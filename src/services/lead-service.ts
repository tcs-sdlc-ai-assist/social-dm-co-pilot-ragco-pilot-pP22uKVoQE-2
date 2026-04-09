import { v4 as uuidv4 } from "uuid";
import type { CandidateLead, Lead, LeadPriority, LeadStatus } from "../types";
import { extractLeadData } from "./lead-extractor";
import { getDMById } from "./dm-repository";
import { createLead as salesforceCreateLead } from "./salesforce-adapter";
import { logAction } from "./audit-logger";
import { AUDIT_ACTIONS } from "../constants";

// ─── In-Memory Lead Store ────────────────────────────────────────────────────

const leadStore: Map<string, Lead> = new Map();
const candidateLeadStore: Map<string, CandidateLead> = new Map();

// ─── Seed Data ───────────────────────────────────────────────────────────────

const seedLeads: Lead[] = [
  {
    id: "lead_001",
    dmId: "ig_200003",
    name: "Priya Sharma",
    contact: "@priyasharma_au",
    budget: "750000",
    location: "Elara",
    intent: "Interested in purchasing property",
    priority: "high",
    status: "new",
    salesforceId: null,
  },
  {
    id: "lead_002",
    dmId: "fb_100002",
    name: "Michael Chen",
    contact: "@michaelchen",
    budget: null,
    location: null,
    intent: "Requesting property information",
    priority: "medium",
    status: "contacted",
    salesforceId: "00QABC123456789DE",
  },
];

function initializeSeedData(): void {
  if (leadStore.size === 0) {
    for (const lead of seedLeads) {
      leadStore.set(lead.id, { ...lead });
    }
  }
}

initializeSeedData();

// ─── Priority Scoring ────────────────────────────────────────────────────────

/**
 * Applies rule-based priority scoring to a candidate lead.
 * Rules:
 * - High: has budget AND (buying intent OR tour intent) AND has contact info
 * - Medium: has at least 2 of: budget, location, specific intent
 * - Low: everything else
 */
function computePriority(candidate: CandidateLead): LeadPriority {
  const intentLower = candidate.intent.toLowerCase();
  const hasBudget = candidate.budget !== null && candidate.budget.trim().length > 0;
  const hasLocation = candidate.location !== null && candidate.location.trim().length > 0;
  const hasContact =
    candidate.contact.length > 0 &&
    candidate.contact !== "@unknown" &&
    candidate.contact !== "Unknown";

  const isBuyingIntent =
    intentLower.includes("purchasing") || intentLower.includes("buying");
  const isTourIntent =
    intentLower.includes("tour") || intentLower.includes("inspection");
  const isSpecificIntent =
    isBuyingIntent ||
    isTourIntent ||
    intentLower.includes("renting") ||
    intentLower.includes("information");

  // High priority: budget + (buying or tour intent) + contact
  if (hasBudget && (isBuyingIntent || isTourIntent) && hasContact) {
    return "high";
  }

  // High priority: budget >= 500k and buying intent
  if (hasBudget && isBuyingIntent) {
    const budgetNum = parseInt(candidate.budget!, 10);
    if (!isNaN(budgetNum) && budgetNum >= 500000) {
      return "high";
    }
  }

  // Medium priority: at least 2 of budget, location, specific intent
  let signalCount = 0;
  if (hasBudget) signalCount++;
  if (hasLocation) signalCount++;
  if (isSpecificIntent) signalCount++;

  if (signalCount >= 2) {
    return "medium";
  }

  // Medium priority: has contact and specific intent
  if (hasContact && isSpecificIntent) {
    return "medium";
  }

  return "low";
}

// ─── Exported Functions ──────────────────────────────────────────────────────

/**
 * Extracts a candidate lead from a DM by ID.
 * Uses the LeadExtractor to parse DM content and extract structured lead data.
 * Applies rule-based priority scoring and logs the action.
 *
 * @param dmId - The ID of the DM to extract lead data from
 * @param actor - The user or system performing the extraction
 * @returns The extracted CandidateLead
 * @throws Error if the DM is not found
 */
export function createCandidateLead(dmId: string, actor: string): CandidateLead {
  if (!dmId || dmId.trim().length === 0) {
    throw new Error("DM ID is required for lead extraction.");
  }

  const dm = getDMById(dmId);
  if (!dm) {
    throw new Error(`DM not found: ${dmId}`);
  }

  // Extract lead data using the lead extractor
  const extracted = extractLeadData(dm);

  // Apply rule-based priority scoring
  const priority = computePriority(extracted);

  const candidateLead: CandidateLead = {
    ...extracted,
    priority,
  };

  // Store the candidate lead for later confirmation
  candidateLeadStore.set(dmId, candidateLead);

  // Audit log
  logAction(
    AUDIT_ACTIONS.LEAD_CREATED,
    actor,
    {
      dmId,
      name: candidateLead.name,
      contact: candidateLead.contact,
      budget: candidateLead.budget,
      location: candidateLead.location,
      intent: candidateLead.intent,
      priority: candidateLead.priority,
      stage: "candidate",
    },
    "lead",
    dmId,
  );

  return candidateLead;
}

/**
 * Confirms a candidate lead, applying any human edits, and stores it as a confirmed lead.
 * This is the human-in-the-loop step where an officer can review and adjust extracted data.
 *
 * @param candidateLead - The candidate lead to confirm
 * @param edits - Optional partial overrides for lead fields
 * @param actor - The user confirming the lead
 * @returns The confirmed Lead
 */
export function confirmLead(
  candidateLead: CandidateLead,
  edits: Partial<Lead>,
  actor: string,
): Lead {
  if (!candidateLead) {
    throw new Error("Candidate lead is required for confirmation.");
  }

  if (!candidateLead.dmId || candidateLead.dmId.trim().length === 0) {
    throw new Error("Candidate lead must have a valid DM ID.");
  }

  // Check for duplicate — if a lead already exists for this DM, return it
  for (const existingLead of leadStore.values()) {
    if (existingLead.dmId === candidateLead.dmId) {
      return { ...existingLead };
    }
  }

  const leadId = `lead_${uuidv4().replace(/-/g, "").substring(0, 12)}`;

  // Merge candidate data with any human edits
  const name = edits.name?.trim() || candidateLead.name;
  const contact = edits.contact?.trim() || candidateLead.contact;
  const budget =
    edits.budget !== undefined
      ? edits.budget
      : candidateLead.budget;
  const location =
    edits.location !== undefined
      ? edits.location
      : candidateLead.location;
  const intent = edits.intent?.trim() || candidateLead.intent;
  const priority = edits.priority || candidateLead.priority;
  const status: LeadStatus = edits.status || "new";

  const lead: Lead = {
    id: leadId,
    dmId: candidateLead.dmId,
    name,
    contact,
    budget,
    location,
    intent,
    priority,
    status,
    salesforceId: null,
  };

  // Recompute priority if fields were edited
  if (edits.name || edits.contact || edits.budget || edits.location || edits.intent) {
    const recomputedCandidate: CandidateLead = {
      dmId: lead.dmId,
      name: lead.name,
      contact: lead.contact,
      budget: lead.budget,
      location: lead.location,
      intent: lead.intent,
      priority: lead.priority,
    };
    lead.priority = edits.priority || computePriority(recomputedCandidate);
  }

  leadStore.set(leadId, lead);

  // Audit log
  logAction(
    AUDIT_ACTIONS.LEAD_CREATED,
    actor,
    {
      leadId,
      dmId: lead.dmId,
      name: lead.name,
      priority: lead.priority,
      status: lead.status,
      hasEdits: !!(edits.name || edits.contact || edits.budget || edits.location || edits.intent),
      stage: "confirmed",
    },
    "lead",
    leadId,
  );

  return { ...lead };
}

/**
 * Syncs a confirmed lead to Salesforce CRM.
 * Uses the SalesforceAdapter to create the lead in Salesforce.
 * Updates the lead record with the Salesforce ID on success.
 *
 * @param leadId - The ID of the lead to sync
 * @param actor - The user or system triggering the sync
 * @returns Object with success status and optional Salesforce ID
 */
export async function syncToSalesforce(
  leadId: string,
  actor: string,
): Promise<{ success: boolean; salesforceId?: string }> {
  if (!leadId || leadId.trim().length === 0) {
    throw new Error("Lead ID is required for Salesforce sync.");
  }

  const lead = leadStore.get(leadId);
  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  // Check if already synced
  if (lead.salesforceId) {
    return { success: true, salesforceId: lead.salesforceId };
  }

  try {
    const result = await salesforceCreateLead(lead);

    if (result.success && result.salesforceId) {
      // Update lead with Salesforce ID
      lead.salesforceId = result.salesforceId;
      lead.status = "contacted";
      leadStore.set(leadId, lead);

      // Audit log for successful sync
      logAction(
        AUDIT_ACTIONS.LEAD_UPDATED,
        actor,
        {
          leadId,
          salesforceId: result.salesforceId,
          action: "salesforce_sync_success",
          previousStatus: "new",
          newStatus: "contacted",
        },
        "lead",
        leadId,
      );

      return { success: true, salesforceId: result.salesforceId };
    }

    // Sync failed
    logAction(
      AUDIT_ACTIONS.LEAD_UPDATED,
      actor,
      {
        leadId,
        action: "salesforce_sync_failed",
        reason: "Salesforce API returned unsuccessful response",
      },
      "lead",
      leadId,
    );

    return { success: false };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error during Salesforce sync";

    logAction(
      AUDIT_ACTIONS.LEAD_UPDATED,
      actor,
      {
        leadId,
        action: "salesforce_sync_error",
        error: errorMessage,
      },
      "lead",
      leadId,
    );

    return { success: false };
  }
}

// ─── Additional Utility Functions ────────────────────────────────────────────

/**
 * Retrieves a lead by its ID.
 * Returns null if not found.
 */
export function getLeadById(leadId: string): Lead | null {
  const lead = leadStore.get(leadId);
  return lead ? { ...lead } : null;
}

/**
 * Retrieves a lead by its associated DM ID.
 * Returns null if not found.
 */
export function getLeadByDMId(dmId: string): Lead | null {
  for (const lead of leadStore.values()) {
    if (lead.dmId === dmId) {
      return { ...lead };
    }
  }
  return null;
}

/**
 * Retrieves a stored candidate lead by DM ID.
 * Returns null if not found.
 */
export function getCandidateLeadByDMId(dmId: string): CandidateLead | null {
  const candidate = candidateLeadStore.get(dmId);
  return candidate ? { ...candidate } : null;
}

/**
 * Retrieves all confirmed leads, optionally filtered by status or priority.
 */
export function getAllLeads(filters?: {
  status?: LeadStatus;
  priority?: LeadPriority;
}): Lead[] {
  let results = Array.from(leadStore.values());

  if (filters?.status) {
    const status = filters.status;
    results = results.filter((lead) => lead.status === status);
  }

  if (filters?.priority) {
    const priority = filters.priority;
    results = results.filter((lead) => lead.priority === priority);
  }

  // Sort by priority (high first), then by ID
  const priorityOrder: Record<LeadPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  results.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return a.id.localeCompare(b.id);
  });

  return results.map((lead) => ({ ...lead }));
}

/**
 * Updates a lead's status and logs the action.
 * Returns the updated lead or null if not found.
 */
export function updateLeadStatus(
  leadId: string,
  status: LeadStatus,
  actor: string,
): Lead | null {
  const lead = leadStore.get(leadId);
  if (!lead) {
    return null;
  }

  const previousStatus = lead.status;
  lead.status = status;
  leadStore.set(leadId, lead);

  const auditAction =
    status === "converted"
      ? AUDIT_ACTIONS.LEAD_CONVERTED
      : status === "lost"
        ? AUDIT_ACTIONS.LEAD_LOST
        : AUDIT_ACTIONS.LEAD_UPDATED;

  logAction(
    auditAction,
    actor,
    {
      leadId,
      previousStatus,
      newStatus: status,
    },
    "lead",
    leadId,
  );

  return { ...lead };
}

/**
 * Returns the total count of leads, optionally filtered.
 */
export function getLeadCount(filters?: {
  status?: LeadStatus;
  priority?: LeadPriority;
}): number {
  return getAllLeads(filters).length;
}