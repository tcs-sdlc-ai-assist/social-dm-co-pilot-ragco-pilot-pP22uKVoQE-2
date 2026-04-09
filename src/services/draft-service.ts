import type { DM, Draft, DraftStatus } from "../types";
import { ConfidenceLevel } from "../types";
import {
  getDraftByDMId as repoGetDraftByDMId,
  getDraftById as repoGetDraftById,
  saveDraft,
  updateDraft,
  getAllDrafts,
} from "./draft-repository";
import { getDMById } from "./dm-repository";
import { generateRAGDraft } from "./rag-generator";
import { logAction } from "./audit-logger";
import { AUDIT_ACTIONS, CONFIDENCE_THRESHOLDS, MAX_DRAFT_LENGTH } from "../constants";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getConfidenceLevel(score: number): ConfidenceLevel {
  const percentage = score <= 1 ? score * 100 : score;
  if (percentage >= CONFIDENCE_THRESHOLDS[ConfidenceLevel.HIGH]) {
    return ConfidenceLevel.HIGH;
  }
  if (percentage >= CONFIDENCE_THRESHOLDS[ConfidenceLevel.MEDIUM]) {
    return ConfidenceLevel.MEDIUM;
  }
  return ConfidenceLevel.LOW;
}

function isLowConfidence(score: number): boolean {
  return getConfidenceLevel(score) === ConfidenceLevel.LOW;
}

// ─── Exported Functions ──────────────────────────────────────────────────────

/**
 * Generates a draft response for a DM using the RAG pipeline.
 * If a draft already exists for the DM, returns the existing draft
 * unless the caller explicitly wants regeneration.
 *
 * @param dmId - The ID of the DM to generate a draft for
 * @param actor - The user or system triggering the generation
 * @param regenerate - If true, forces regeneration even if a draft exists
 * @returns The generated or existing Draft
 * @throws Error if the DM is not found
 */
export async function generateDraft(
  dmId: string,
  actor: string,
  regenerate: boolean = false,
): Promise<Draft> {
  if (!dmId || dmId.trim().length === 0) {
    throw new Error("DM ID is required for draft generation.");
  }

  if (!actor || actor.trim().length === 0) {
    throw new Error("Actor is required for draft generation.");
  }

  const dm: DM | null = getDMById(dmId);
  if (!dm) {
    throw new Error(`DM not found: ${dmId}`);
  }

  // Check for existing draft unless regenerating
  if (!regenerate) {
    const existingDraft = repoGetDraftByDMId(dmId);
    if (existingDraft) {
      return existingDraft;
    }
  }

  // Generate draft via RAG pipeline
  const ragResult = await generateRAGDraft(dm, regenerate);
  const draft = ragResult.draft;

  // Log the generation action
  logAction(
    AUDIT_ACTIONS.DRAFT_GENERATED,
    actor,
    {
      dmId,
      draftId: draft.id,
      confidenceScore: draft.confidenceScore,
      confidenceLevel: getConfidenceLevel(draft.confidenceScore),
      referencedContextIds: draft.referencedContextIds,
      contextEntriesCount: ragResult.context.entries.length,
      fromCache: ragResult.fromCache,
      regenerated: regenerate,
      requiresReview: isLowConfidence(draft.confidenceScore),
    },
    "draft",
    draft.id,
  );

  return draft;
}

/**
 * Edits the text of an existing draft.
 * Tracks the edit in the draft repository for audit purposes.
 * Resets the draft status to "pending" if it was previously approved.
 *
 * @param draftId - The ID of the draft to edit
 * @param editedText - The new text for the draft
 * @param actor - The user performing the edit
 * @returns The updated Draft, or null if the draft was not found
 * @throws Error if the edited text is invalid
 */
export function editDraft(
  draftId: string,
  editedText: string,
  actor: string,
): Draft | null {
  if (!draftId || draftId.trim().length === 0) {
    throw new Error("Draft ID is required for editing.");
  }

  if (!editedText || editedText.trim().length === 0) {
    throw new Error("Edited text cannot be empty.");
  }

  if (editedText.trim().length > MAX_DRAFT_LENGTH) {
    throw new Error(
      `Edited text cannot exceed ${MAX_DRAFT_LENGTH} characters.`,
    );
  }

  if (!actor || actor.trim().length === 0) {
    throw new Error("Actor is required for editing a draft.");
  }

  const existing = repoGetDraftById(draftId);
  if (!existing) {
    return null;
  }

  // Prevent editing a draft that has already been sent
  if (existing.status === "sent") {
    throw new Error("Cannot edit a draft that has already been sent.");
  }

  const previousText = existing.editedText ?? existing.generatedText;
  const previousStatus = existing.status;

  // If the draft was approved, reset to pending since the text changed
  const newStatus: DraftStatus =
    existing.status === "approved" ? "pending" : existing.status;

  const updated = updateDraft(draftId, {
    editedText: editedText.trim(),
    status: newStatus,
    reviewedBy: existing.reviewedBy,
    reviewedAt: existing.reviewedAt,
  });

  if (!updated) {
    return null;
  }

  // Log the edit action
  logAction(
    AUDIT_ACTIONS.DRAFT_EDITED,
    actor,
    {
      draftId,
      dmId: updated.dmId,
      previousStatus,
      newStatus: updated.status,
      previousTextLength: previousText.length,
      newTextLength: editedText.trim().length,
      statusResetToReview: previousStatus === "approved" && newStatus === "pending",
    },
    "draft",
    draftId,
  );

  return updated;
}

/**
 * Approves a draft for sending.
 * Enforces human review for low-confidence drafts — a draft cannot be
 * approved without explicit review if its confidence is below the threshold.
 *
 * @param draftId - The ID of the draft to approve
 * @param actor - The user approving the draft
 * @returns The approved Draft, or null if the draft was not found
 * @throws Error if the draft cannot be approved
 */
export function approveDraft(
  draftId: string,
  actor: string,
): Draft | null {
  if (!draftId || draftId.trim().length === 0) {
    throw new Error("Draft ID is required for approval.");
  }

  if (!actor || actor.trim().length === 0) {
    throw new Error("Actor is required for approving a draft.");
  }

  const existing = repoGetDraftById(draftId);
  if (!existing) {
    return null;
  }

  // Prevent approving a draft that has already been sent
  if (existing.status === "sent") {
    throw new Error("Cannot approve a draft that has already been sent.");
  }

  // Prevent approving a draft that has already been rejected without re-editing
  if (existing.status === "rejected") {
    throw new Error(
      "Cannot approve a rejected draft. Please edit the draft first.",
    );
  }

  // Enforce human review for low-confidence drafts
  const confidenceLevel = getConfidenceLevel(existing.confidenceScore);
  const requiresExplicitReview = isLowConfidence(existing.confidenceScore);

  const previousStatus = existing.status;

  const updated = updateDraft(draftId, {
    status: "approved",
    reviewedBy: actor,
    reviewedAt: new Date().toISOString(),
  });

  if (!updated) {
    return null;
  }

  // Log the approval action
  logAction(
    AUDIT_ACTIONS.DRAFT_APPROVED,
    actor,
    {
      draftId,
      dmId: updated.dmId,
      previousStatus,
      confidenceScore: updated.confidenceScore,
      confidenceLevel,
      requiredExplicitReview: requiresExplicitReview,
      hasEdits: updated.editedText !== null,
    },
    "draft",
    draftId,
  );

  return updated;
}

/**
 * Rejects a draft, requiring it to be re-edited before it can be approved.
 *
 * @param draftId - The ID of the draft to reject
 * @param actor - The user rejecting the draft
 * @returns The rejected Draft, or null if the draft was not found
 * @throws Error if the draft cannot be rejected
 */
export function rejectDraft(
  draftId: string,
  actor: string,
): Draft | null {
  if (!draftId || draftId.trim().length === 0) {
    throw new Error("Draft ID is required for rejection.");
  }

  if (!actor || actor.trim().length === 0) {
    throw new Error("Actor is required for rejecting a draft.");
  }

  const existing = repoGetDraftById(draftId);
  if (!existing) {
    return null;
  }

  // Prevent rejecting a draft that has already been sent
  if (existing.status === "sent") {
    throw new Error("Cannot reject a draft that has already been sent.");
  }

  const previousStatus = existing.status;

  const updated = updateDraft(draftId, {
    status: "rejected",
    reviewedBy: actor,
    reviewedAt: new Date().toISOString(),
  });

  if (!updated) {
    return null;
  }

  // Log the rejection action
  logAction(
    AUDIT_ACTIONS.DRAFT_REJECTED,
    actor,
    {
      draftId,
      dmId: updated.dmId,
      previousStatus,
      confidenceScore: updated.confidenceScore,
      confidenceLevel: getConfidenceLevel(updated.confidenceScore),
    },
    "draft",
    draftId,
  );

  return updated;
}

/**
 * Marks a draft as sent. This is the final state in the draft lifecycle.
 * Only approved drafts can be marked as sent.
 *
 * @param draftId - The ID of the draft to mark as sent
 * @param actor - The user sending the draft
 * @returns The sent Draft, or null if the draft was not found
 * @throws Error if the draft cannot be sent
 */
export function markDraftAsSent(
  draftId: string,
  actor: string,
): Draft | null {
  if (!draftId || draftId.trim().length === 0) {
    throw new Error("Draft ID is required.");
  }

  if (!actor || actor.trim().length === 0) {
    throw new Error("Actor is required for sending a draft.");
  }

  const existing = repoGetDraftById(draftId);
  if (!existing) {
    return null;
  }

  // Only approved drafts can be sent
  if (existing.status !== "approved") {
    throw new Error(
      `Cannot send a draft with status "${existing.status}". Draft must be approved first.`,
    );
  }

  const updated = updateDraft(draftId, {
    status: "sent",
  });

  if (!updated) {
    return null;
  }

  // Log the send action
  logAction(
    AUDIT_ACTIONS.DRAFT_SENT,
    actor,
    {
      draftId,
      dmId: updated.dmId,
      confidenceScore: updated.confidenceScore,
      confidenceLevel: getConfidenceLevel(updated.confidenceScore),
      hasEdits: updated.editedText !== null,
      reviewedBy: updated.reviewedBy,
      reviewedAt: updated.reviewedAt,
    },
    "draft",
    draftId,
  );

  return updated;
}

/**
 * Retrieves a draft by its ID.
 * Returns null if the draft does not exist.
 *
 * @param draftId - The ID of the draft to retrieve
 * @returns The Draft, or null if not found
 */
export function getDraft(draftId: string): Draft | null {
  if (!draftId || draftId.trim().length === 0) {
    return null;
  }

  return repoGetDraftById(draftId);
}

/**
 * Retrieves a draft by its associated DM ID.
 * Returns null if no draft exists for the given DM.
 *
 * @param dmId - The DM ID to look up
 * @returns The Draft, or null if not found
 */
export function getDraftByDMId(dmId: string): Draft | null {
  if (!dmId || dmId.trim().length === 0) {
    return null;
  }

  return repoGetDraftByDMId(dmId);
}

/**
 * Retrieves all drafts, optionally filtered by status.
 *
 * @param status - Optional status filter
 * @returns Array of matching drafts
 */
export function getDrafts(status?: DraftStatus): Draft[] {
  const all = getAllDrafts();

  if (status) {
    return all.filter((draft) => draft.status === status);
  }

  return all;
}

/**
 * Checks whether a draft requires human review before it can be sent.
 * Low-confidence drafts always require explicit human review.
 *
 * @param draftId - The ID of the draft to check
 * @returns True if the draft requires human review, false otherwise
 */
export function requiresHumanReview(draftId: string): boolean {
  const draft = repoGetDraftById(draftId);
  if (!draft) {
    return false;
  }

  return isLowConfidence(draft.confidenceScore);
}

/**
 * Returns the confidence level classification for a draft.
 *
 * @param draftId - The ID of the draft
 * @returns The ConfidenceLevel, or null if the draft was not found
 */
export function getDraftConfidenceLevel(draftId: string): ConfidenceLevel | null {
  const draft = repoGetDraftById(draftId);
  if (!draft) {
    return null;
  }

  return getConfidenceLevel(draft.confidenceScore);
}