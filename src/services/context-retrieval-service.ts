import type { DM, KnowledgeBaseEntry } from "../types";
import { findRelevantContext, getEntryById } from "./knowledge-base-adapter";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ContextResult {
  entries: KnowledgeBaseEntry[];
  summary: string;
}

// ─── In-Memory Cache ─────────────────────────────────────────────────────────

const contextCache: Map<string, { result: ContextResult; cachedAt: number }> = new Map();

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function isCacheValid(cachedAt: number): boolean {
  return Date.now() - cachedAt < CACHE_TTL_MS;
}

// ─── Summary Generation ──────────────────────────────────────────────────────

function generateSummary(entries: KnowledgeBaseEntry[]): string {
  if (entries.length === 0) {
    return "No relevant knowledge base entries found for this message.";
  }

  const categories = Array.from(new Set(entries.map((e) => e.category)));
  const categoryLabels = categories.map((c) => c.charAt(0).toUpperCase() + c.slice(1));

  if (entries.length === 1) {
    return `Found 1 relevant entry in ${categoryLabels[0]}: "${entries[0].title}".`;
  }

  const categoryPart =
    categoryLabels.length === 1
      ? categoryLabels[0]
      : categoryLabels.slice(0, -1).join(", ") + " and " + categoryLabels[categoryLabels.length - 1];

  return `Found ${entries.length} relevant entries across ${categoryPart}.`;
}

// ─── Cache Management ────────────────────────────────────────────────────────

export function invalidateContextCache(dmId: string): void {
  contextCache.delete(dmId);
}

export function clearContextCache(): void {
  contextCache.clear();
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Retrieves relevant knowledge base context for a given DM.
 * Results are cached per DM ID for up to 10 minutes to avoid redundant lookups.
 */
export function getContextForDM(dm: DM): ContextResult {
  // Check cache first
  const cached = contextCache.get(dm.id);
  if (cached && isCacheValid(cached.cachedAt)) {
    return cached.result;
  }

  // Find relevant entries using the knowledge base adapter
  const entries = findRelevantContext(dm.content);

  // Generate a concise summary for UI display
  const summary = generateSummary(entries);

  const result: ContextResult = {
    entries,
    summary,
  };

  // Cache the result
  contextCache.set(dm.id, { result, cachedAt: Date.now() });

  return result;
}

/**
 * Retrieves context for a DM and resolves specific context IDs.
 * Useful when a draft references specific knowledge base entries.
 */
export function getContextByIds(contextIds: string[]): KnowledgeBaseEntry[] {
  if (contextIds.length === 0) {
    return [];
  }

  const entries: KnowledgeBaseEntry[] = [];
  for (const id of contextIds) {
    const entry = getEntryById(id);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}