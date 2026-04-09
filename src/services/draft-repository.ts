import { Draft, DraftStatus } from "../types";

// ─── Draft Edit History (Audit Trail) ────────────────────────────────────────

export interface DraftEditRecord {
  editId: string;
  draftId: string;
  editedBy: string | null;
  previousText: string;
  newText: string;
  previousStatus: DraftStatus;
  newStatus: DraftStatus;
  editedAt: string;
}

// ─── In-Memory Storage ───────────────────────────────────────────────────────

const drafts: Map<string, Draft> = new Map();
const editHistory: DraftEditRecord[] = [];
let editIdCounter = 0;

// ─── Seed Data ───────────────────────────────────────────────────────────────

const seedDrafts: Draft[] = [
  {
    id: "draft_001",
    dmId: "dm_001",
    generatedText:
      "Hi Sarah! Thanks for reaching out about Willowdale. We have several lots available in Stage 12 starting from $450,000. Would you like to schedule a visit to our display village this weekend?",
    editedText: null,
    confidenceScore: 0.92,
    referencedContextIds: ["kb_001", "kb_003"],
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
  },
  {
    id: "draft_002",
    dmId: "dm_002",
    generatedText:
      "Hello! Thank you for your interest in our Leppington community. First home buyer grants may apply depending on your eligibility. I'd love to connect you with our sales team to discuss your options. Would Tuesday or Wednesday work for a call?",
    editedText:
      "Hello! Thank you for your interest in our Leppington community. First home buyer grants of up to $10,000 may apply depending on your eligibility. I'd love to connect you with our sales team to discuss your options. Would Tuesday or Wednesday work for a call?",
    confidenceScore: 0.85,
    referencedContextIds: ["kb_002", "kb_005"],
    status: "approved",
    reviewedBy: "officer_001",
    reviewedAt: "2024-06-01T14:30:00Z",
  },
  {
    id: "draft_003",
    dmId: "dm_003",
    generatedText:
      "Hi there! Thanks for your message. Our Aura community in Caloundra South has house and land packages starting from $580,000. I can send you a brochure with all the details. Would you like that?",
    editedText: null,
    confidenceScore: 0.78,
    referencedContextIds: ["kb_004"],
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
  },
];

function initializeSeedData(): void {
  if (drafts.size === 0) {
    for (const draft of seedDrafts) {
      drafts.set(draft.id, { ...draft });
    }
  }
}

initializeSeedData();

// ─── Repository Functions ────────────────────────────────────────────────────

export function getDraftByDMId(dmId: string): Draft | null {
  for (const draft of drafts.values()) {
    if (draft.dmId === dmId) {
      return { ...draft };
    }
  }
  return null;
}

export function getDraftById(id: string): Draft | null {
  const draft = drafts.get(id);
  if (!draft) {
    return null;
  }
  return { ...draft };
}

export function saveDraft(draft: Draft): Draft {
  const saved: Draft = { ...draft };
  drafts.set(saved.id, saved);
  return { ...saved };
}

export function updateDraft(
  id: string,
  updates: Partial<Draft>
): Draft | null {
  const existing = drafts.get(id);
  if (!existing) {
    return null;
  }

  const previousText = existing.editedText ?? existing.generatedText;
  const previousStatus = existing.status;

  const updated: Draft = {
    ...existing,
    ...updates,
    id: existing.id,
    dmId: existing.dmId,
  };

  drafts.set(id, updated);

  const newText = updated.editedText ?? updated.generatedText;
  const newStatus = updated.status;

  if (previousText !== newText || previousStatus !== newStatus) {
    editIdCounter += 1;
    const editRecord: DraftEditRecord = {
      editId: `edit_${String(editIdCounter).padStart(3, "0")}`,
      draftId: id,
      editedBy: updates.reviewedBy ?? existing.reviewedBy,
      previousText,
      newText,
      previousStatus,
      newStatus,
      editedAt: new Date().toISOString(),
    };
    editHistory.push(editRecord);
  }

  return { ...updated };
}

export function getAllDrafts(): Draft[] {
  return Array.from(drafts.values()).map((draft) => ({ ...draft }));
}

// ─── Audit Trail Functions ───────────────────────────────────────────────────

export function getEditHistoryByDraftId(draftId: string): DraftEditRecord[] {
  return editHistory
    .filter((record) => record.draftId === draftId)
    .map((record) => ({ ...record }));
}

export function getAllEditHistory(): DraftEditRecord[] {
  return editHistory.map((record) => ({ ...record }));
}