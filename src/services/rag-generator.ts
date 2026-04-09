import { v4 as uuidv4 } from "uuid";
import type { DM, Draft, KnowledgeBaseEntry } from "../types";
import { getContextForDM, type ContextResult } from "./context-retrieval-service";
import { generateDraftResponse, type DraftResponse } from "./gpt-adapter";
import { getDraftByDMId, saveDraft } from "./draft-repository";
import { logAction } from "./audit-logger";
import { AUDIT_ACTIONS } from "../constants";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RAGDraftResult {
  draft: Draft;
  context: ContextResult;
  fromCache: boolean;
}

// ─── In-Memory Draft Cache ───────────────────────────────────────────────────

interface CachedDraft {
  result: RAGDraftResult;
  cachedAt: number;
}

const draftCache: Map<string, CachedDraft> = new Map();

const DRAFT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function isCacheValid(cachedAt: number): boolean {
  return Date.now() - cachedAt < DRAFT_CACHE_TTL_MS;
}

// ─── Cache Management ────────────────────────────────────────────────────────

/**
 * Invalidates the cached draft for a specific DM.
 */
export function invalidateDraftCache(dmId: string): void {
  draftCache.delete(dmId);
}

/**
 * Clears the entire draft cache.
 */
export function clearDraftCache(): void {
  draftCache.clear();
}

// ─── Confidence Score Computation ────────────────────────────────────────────

/**
 * Computes a composite confidence score by combining the GPT adapter's
 * confidence with context quality signals.
 *
 * Factors:
 * - Base confidence from GPT adapter (weight: 0.6)
 * - Number of context entries found (weight: 0.2)
 * - Category diversity of context entries (weight: 0.1)
 * - Keyword coverage between DM content and context (weight: 0.1)
 */
function computeCompositeConfidence(
  gptConfidence: number,
  contextEntries: KnowledgeBaseEntry[],
  dmContent: string,
): number {
  // Factor 1: GPT adapter confidence (already 0-1 range)
  const gptScore = Math.max(0, Math.min(1, gptConfidence));

  // Factor 2: Context entry count score (more entries = higher confidence, up to 5)
  const entryCountScore = Math.min(contextEntries.length / 5, 1.0);

  // Factor 3: Category diversity (more diverse categories = broader coverage)
  const uniqueCategories = new Set(contextEntries.map((e) => e.category));
  const categoryDiversityScore =
    contextEntries.length > 0
      ? Math.min(uniqueCategories.size / 3, 1.0)
      : 0;

  // Factor 4: Keyword coverage between DM and context
  const dmTokens = dmContent
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  let keywordMatchCount = 0;
  let totalKeywords = 0;

  for (const entry of contextEntries) {
    for (const keyword of entry.keywords) {
      totalKeywords++;
      const keywordLower = keyword.toLowerCase();
      const matched = dmTokens.some(
        (token) => token.includes(keywordLower) || keywordLower.includes(token),
      );
      if (matched) {
        keywordMatchCount++;
      }
    }
  }

  const keywordCoverageScore =
    totalKeywords > 0 ? keywordMatchCount / totalKeywords : 0;

  // Weighted combination
  const compositeScore =
    gptScore * 0.6 +
    entryCountScore * 0.2 +
    categoryDiversityScore * 0.1 +
    keywordCoverageScore * 0.1;

  // Clamp to [0, 1] and round to 2 decimal places
  return Math.round(Math.max(0, Math.min(1, compositeScore)) * 100) / 100;
}

// ─── Referenced Context ID Selection ─────────────────────────────────────────

/**
 * Selects the most relevant context entry IDs to reference in the draft.
 * Returns up to maxIds entry IDs, prioritizing entries with higher keyword overlap.
 */
function selectReferencedContextIds(
  contextEntries: KnowledgeBaseEntry[],
  dmContent: string,
  maxIds: number = 5,
): string[] {
  if (contextEntries.length === 0) {
    return [];
  }

  const dmTokens = dmContent
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const scored: Array<{ id: string; score: number }> = [];

  for (const entry of contextEntries) {
    let matchCount = 0;
    for (const keyword of entry.keywords) {
      const keywordLower = keyword.toLowerCase();
      const matched = dmTokens.some(
        (token) => token.includes(keywordLower) || keywordLower.includes(token),
      );
      if (matched) {
        matchCount++;
      }
    }
    scored.push({ id: entry.id, score: matchCount });
  }

  // Sort by score descending, then take top N
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxIds).map((s) => s.id);
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Generates a draft response for a DM using the RAG pipeline:
 * 1. Checks for an existing draft in the repository
 * 2. Checks the in-memory cache for a recently generated draft
 * 3. Retrieves relevant context from the knowledge base
 * 4. Generates a draft response via the GPT adapter with context
 * 5. Computes a composite confidence score
 * 6. Creates and persists a Draft object with all metadata
 *
 * Results are cached per DM ID for up to 10 minutes.
 *
 * @param dm - The DM to generate a draft for
 * @param regenerate - If true, bypasses cache and repository to force regeneration
 * @returns RAGDraftResult containing the draft, context, and cache status
 */
export async function generateRAGDraft(
  dm: DM,
  regenerate: boolean = false,
): Promise<RAGDraftResult> {
  // Step 1: Check repository for existing draft (unless regenerating)
  if (!regenerate) {
    const existingDraft = getDraftByDMId(dm.id);
    if (existingDraft) {
      const context = getContextForDM(dm);
      const result: RAGDraftResult = {
        draft: existingDraft,
        context,
        fromCache: true,
      };
      return result;
    }
  }

  // Step 2: Check in-memory cache (unless regenerating)
  if (!regenerate) {
    const cached = draftCache.get(dm.id);
    if (cached && isCacheValid(cached.cachedAt)) {
      return cached.result;
    }
  }

  // Step 3: Retrieve context from knowledge base
  const contextResult: ContextResult = getContextForDM(dm);
  const contextEntries = contextResult.entries;

  // Step 4: Generate draft via GPT adapter
  let draftResponse: DraftResponse;
  try {
    draftResponse = await generateDraftResponse(
      dm.content,
      contextEntries,
      dm.senderName,
    );
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error during draft generation";

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: "RAG draft generation failed",
        dmId: dm.id,
        error: errorMessage,
      }),
    );

    // Create a fallback draft with low confidence
    const fallbackDraft: Draft = {
      id: `draft_${uuidv4().replace(/-/g, "").substring(0, 12)}`,
      dmId: dm.id,
      generatedText:
        `Hi ${dm.senderName.split(" ")[0] || "there"}! Thank you for reaching out to Stockland. We appreciate your interest and would love to help you further. One of our sales consultants will be in touch with you shortly. In the meantime, feel free to explore our communities at stockland.com.au or call us on 13 52 63.`,
      editedText: null,
      confidenceScore: 0.3,
      referencedContextIds: [],
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
    };

    const savedFallback = saveDraft(fallbackDraft);

    logAction(
      AUDIT_ACTIONS.DRAFT_GENERATED,
      "system",
      {
        dmId: dm.id,
        draftId: savedFallback.id,
        confidenceScore: savedFallback.confidenceScore,
        contextEntriesCount: 0,
        fallback: true,
        error: errorMessage,
      },
      "draft",
      savedFallback.id,
    );

    const fallbackResult: RAGDraftResult = {
      draft: savedFallback,
      context: contextResult,
      fromCache: false,
    };

    return fallbackResult;
  }

  // Step 5: Compute composite confidence score
  const compositeConfidence = computeCompositeConfidence(
    draftResponse.confidenceScore,
    contextEntries,
    dm.content,
  );

  // Step 6: Select referenced context IDs
  const referencedContextIds = selectReferencedContextIds(
    contextEntries,
    dm.content,
  );

  // Step 7: Create and persist Draft object
  const draft: Draft = {
    id: `draft_${uuidv4().replace(/-/g, "").substring(0, 12)}`,
    dmId: dm.id,
    generatedText: draftResponse.text,
    editedText: null,
    confidenceScore: compositeConfidence,
    referencedContextIds,
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
  };

  const savedDraft = saveDraft(draft);

  // Step 8: Log the draft generation action
  logAction(
    AUDIT_ACTIONS.DRAFT_GENERATED,
    "system",
    {
      dmId: dm.id,
      draftId: savedDraft.id,
      confidenceScore: savedDraft.confidenceScore,
      gptConfidence: draftResponse.confidenceScore,
      contextEntriesCount: contextEntries.length,
      referencedContextIds,
      regenerated: regenerate,
    },
    "draft",
    savedDraft.id,
  );

  // Step 9: Cache the result
  const ragResult: RAGDraftResult = {
    draft: savedDraft,
    context: contextResult,
    fromCache: false,
  };

  draftCache.set(dm.id, {
    result: ragResult,
    cachedAt: Date.now(),
  });

  return ragResult;
}

/**
 * Retrieves a previously generated draft for a DM without triggering generation.
 * Checks the repository first, then the in-memory cache.
 * Returns null if no draft exists.
 */
export function getExistingDraft(dmId: string): Draft | null {
  // Check repository first
  const repoDraft = getDraftByDMId(dmId);
  if (repoDraft) {
    return repoDraft;
  }

  // Check cache
  const cached = draftCache.get(dmId);
  if (cached && isCacheValid(cached.cachedAt)) {
    return cached.result.draft;
  }

  return null;
}