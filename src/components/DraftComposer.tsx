"use client";

import { useState, useCallback, useEffect } from "react";
import ConfidenceMeter from "@/components/ConfidenceMeter";
import { useDraft } from "@/hooks/useDraft";
import { ConfidenceLevel } from "@/types";
import { CONFIDENCE_THRESHOLDS, MAX_DRAFT_LENGTH } from "@/constants";
import type { KnowledgeBaseEntry } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DraftComposerProps {
  dmId: string;
  contextEntries?: KnowledgeBaseEntry[];
  onSend?: (text: string) => void;
  onEscalate?: () => void;
}

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

function buildPropertyInfoSnippet(entries: KnowledgeBaseEntry[]): string {
  if (entries.length === 0) {
    return "";
  }

  const propertyEntries = entries.filter(
    (e) =>
      e.category.toLowerCase() === "property" ||
      e.category.toLowerCase() === "community" ||
      e.category.toLowerCase() === "pricing"
  );

  const target = propertyEntries.length > 0 ? propertyEntries : entries;
  const entry = target[0];

  const snippet = entry.content.length > 200
    ? entry.content.slice(0, 200).trimEnd() + "…"
    : entry.content;

  return `\n\n${snippet}`;
}

function buildNextStepSuggestion(confidenceLevel: ConfidenceLevel): string {
  switch (confidenceLevel) {
    case ConfidenceLevel.HIGH:
      return "\n\nWould you like to schedule a consultation with one of our sales consultants? We can arrange a phone call, video call, or in-person meeting at your convenience.";
    case ConfidenceLevel.MEDIUM:
      return "\n\nI'd love to help you further. Could you share a bit more about what you're looking for — such as your preferred location, budget, or timeline? That way I can provide the most relevant options.";
    case ConfidenceLevel.LOW:
      return "\n\nThank you for reaching out! Let me connect you with one of our experienced sales consultants who can provide personalised assistance. What's the best way to reach you?";
    default:
      return "\n\nIs there anything else I can help you with?";
  }
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function ReferencedContextList({ entries }: { entries: KnowledgeBaseEntry[] }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Referenced Context
      </h4>
      <ul className="space-y-1.5">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-2xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {entry.category}
            </span>
            <span className="truncate text-xs text-gray-700 dark:text-gray-300">
              {entry.title}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewBanner({ isLowConfidence, isReviewed }: { isLowConfidence: boolean; isReviewed: boolean }) {
  if (!isLowConfidence) {
    return null;
  }

  if (isReviewed) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 dark:border-green-800 dark:bg-green-900/30">
        <svg
          className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-xs font-medium text-green-800 dark:text-green-300">
          Draft reviewed and approved for sending
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-900/30">
      <svg
        className="h-4 w-4 flex-shrink-0 text-red-500"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      <span className="text-xs font-medium text-red-800 dark:text-red-300">
        Low confidence — human review required before sending
      </span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DraftComposer({
  dmId,
  contextEntries = [],
  onSend,
  onEscalate,
}: DraftComposerProps) {
  const {
    draft,
    generateDraft,
    editDraft,
    approveDraft,
    isGenerating,
    isSaving,
    error,
  } = useDraft(dmId);

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [hasBeenReviewed, setHasBeenReviewed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Sync edit text when draft changes
  useEffect(() => {
    if (draft) {
      setEditText(draft.editedText ?? draft.generatedText);
    }
  }, [draft]);

  // Track review status from draft
  useEffect(() => {
    if (draft && (draft.status === "approved" || draft.status === "sent")) {
      setHasBeenReviewed(true);
    }
  }, [draft]);

  const currentText = draft
    ? (draft.editedText ?? draft.generatedText)
    : "";

  const confidenceScore = draft?.confidenceScore ?? 0;
  const confidenceLevel = getConfidenceLevel(confidenceScore);
  const isLowConfidence = confidenceLevel === ConfidenceLevel.LOW;
  const canSend = draft !== null && (!isLowConfidence || hasBeenReviewed) && !isEditing && !isSaving;

  const referencedEntries = contextEntries.filter(
    (entry) => draft?.referencedContextIds.includes(entry.id)
  );

  const displayedEntries = referencedEntries.length > 0 ? referencedEntries : contextEntries.slice(0, 3);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setLocalError(null);
    setHasBeenReviewed(false);
    try {
      await generateDraft();
    } catch {
      // Error is handled by useDraft hook
    }
  }, [generateDraft]);

  const handleToggleEdit = useCallback(() => {
    if (isEditing && draft) {
      // Save edits
      const trimmed = editText.trim();
      if (trimmed.length === 0) {
        setLocalError("Draft text cannot be empty.");
        return;
      }
      if (trimmed.length > MAX_DRAFT_LENGTH) {
        setLocalError(`Draft text cannot exceed ${MAX_DRAFT_LENGTH} characters.`);
        return;
      }
      setLocalError(null);
      editDraft(trimmed);
      setIsEditing(false);
    } else {
      setLocalError(null);
      setIsEditing(true);
    }
  }, [isEditing, draft, editText, editDraft]);

  const handleCancelEdit = useCallback(() => {
    if (draft) {
      setEditText(draft.editedText ?? draft.generatedText);
    }
    setLocalError(null);
    setIsEditing(false);
  }, [draft]);

  const handleInsertPropertyInfo = useCallback(() => {
    const snippet = buildPropertyInfoSnippet(contextEntries);
    if (snippet.length === 0) {
      setLocalError("No property information available to insert.");
      return;
    }
    setLocalError(null);
    setEditText((prev) => prev + snippet);
    if (!isEditing) {
      setIsEditing(true);
    }
  }, [contextEntries, isEditing]);

  const handleSuggestNextStep = useCallback(() => {
    const suggestion = buildNextStepSuggestion(confidenceLevel);
    setLocalError(null);
    setEditText((prev) => prev + suggestion);
    if (!isEditing) {
      setIsEditing(true);
    }
  }, [confidenceLevel, isEditing]);

  const handleApproveAndSend = useCallback(async () => {
    if (!draft) {
      return;
    }

    setLocalError(null);

    try {
      if (draft.status === "pending") {
        await approveDraft();
        setHasBeenReviewed(true);
      }

      const textToSend = draft.editedText ?? draft.generatedText;
      onSend?.(textToSend);
    } catch {
      // Error is handled by useDraft hook
    }
  }, [draft, approveDraft, onSend]);

  const handleEscalate = useCallback(() => {
    setLocalError(null);
    onEscalate?.();
  }, [onEscalate]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= MAX_DRAFT_LENGTH) {
        setEditText(value);
        setLocalError(null);
      }
    },
    []
  );

  // ─── Render: No Draft State ──────────────────────────────────────────────

  if (!draft && !isGenerating) {
    return (
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Draft Response
          </h3>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-10 text-center dark:border-gray-600">
          <svg
            className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
            />
          </svg>
          <h4 className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
            No draft generated yet
          </h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Generate an AI-powered draft response for this message.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            className="btn-primary mt-4"
          >
            Generate Draft
          </button>
        </div>

        {(error || localError) && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3" role="alert">
            <p className="text-sm text-red-800">{localError ?? error}</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Generating State ────────────────────────────────────────────

  if (isGenerating) {
    return (
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Draft Response
          </h3>
        </div>

        <div className="flex flex-col items-center justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-gray-300 border-t-blue-600" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Generating AI draft…
          </p>
        </div>
      </div>
    );
  }

  // ─── Render: Draft Available ─────────────────────────────────────────────

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Draft Response
        </h3>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            draft?.status === "approved"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : draft?.status === "rejected"
                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                : draft?.status === "sent"
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
          }`}>
            {draft?.status === "approved"
              ? "Approved"
              : draft?.status === "rejected"
                ? "Rejected"
                : draft?.status === "sent"
                  ? "Sent"
                  : "Pending Review"}
          </span>
        </div>
      </div>

      {/* Confidence Meter */}
      <ConfidenceMeter
        score={confidenceScore}
        showLabel={true}
        showTooltip={true}
        size="md"
      />

      {/* Review Banner */}
      <ReviewBanner isLowConfidence={isLowConfidence} isReviewed={hasBeenReviewed} />

      {/* Draft Text Area */}
      <div className="relative">
        <label htmlFor="draft-text" className="sr-only">
          Draft response text
        </label>
        <textarea
          id="draft-text"
          value={isEditing ? editText : currentText}
          onChange={handleTextChange}
          readOnly={!isEditing}
          rows={6}
          className={`block w-full resize-y rounded-md border px-3 py-2 text-sm transition-colors ${
            isEditing
              ? "border-blue-400 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-blue-600 dark:bg-gray-800"
              : "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300"
          }`}
          placeholder="Draft response will appear here…"
          aria-label="Draft response text"
        />
        {isEditing && (
          <div className="absolute bottom-2 right-2 text-xs text-gray-400 dark:text-gray-500">
            {editText.length}/{MAX_DRAFT_LENGTH}
          </div>
        )}
      </div>

      {/* Referenced Context */}
      <ReferencedContextList entries={displayedEntries} />

      {/* Error Display */}
      {(error || localError) && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3" role="alert">
          <p className="text-sm text-red-800 dark:text-red-300">{localError ?? error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Insert & Suggest Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleInsertPropertyInfo}
            disabled={isSaving || contextEntries.length === 0}
            className="btn-secondary text-xs"
            title={contextEntries.length === 0 ? "No context entries available" : "Insert property information from knowledge base"}
          >
            <svg
              className="mr-1.5 h-3.5 w-3.5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Insert Property Info
          </button>
          <button
            type="button"
            onClick={handleSuggestNextStep}
            disabled={isSaving}
            className="btn-secondary text-xs"
            title="Suggest a next step based on confidence level"
          >
            <svg
              className="mr-1.5 h-3.5 w-3.5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                clipRule="evenodd"
              />
            </svg>
            Suggest Next Step
          </button>
        </div>

        {/* Right: Edit, Escalate, Send Buttons */}
        <div className="flex items-center gap-2">
          {/* Edit / Save Toggle */}
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleEdit}
                disabled={isSaving}
                className="btn-secondary text-xs"
              >
                {isSaving ? (
                  <span className="flex items-center">
                    <svg
                      className="-ml-0.5 mr-1.5 h-3.5 w-3.5 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Saving…
                  </span>
                ) : (
                  "Save Edits"
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleToggleEdit}
              disabled={isSaving || draft?.status === "sent"}
              className="btn-secondary text-xs"
            >
              <svg
                className="mr-1.5 h-3.5 w-3.5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
              </svg>
              Edit Draft
            </button>
          )}

          {/* Escalate */}
          <button
            type="button"
            onClick={handleEscalate}
            disabled={isSaving || draft?.status === "sent"}
            className="inline-flex items-center justify-center rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700 shadow-sm transition-colors hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50"
          >
            <svg
              className="mr-1.5 h-3.5 w-3.5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
                clipRule="evenodd"
              />
            </svg>
            Escalate to Sales
          </button>

          {/* Send Reply */}
          <button
            type="button"
            onClick={handleApproveAndSend}
            disabled={!canSend}
            className="btn-primary text-xs"
            title={
              isLowConfidence && !hasBeenReviewed
                ? "Low confidence draft requires human review before sending"
                : isEditing
                  ? "Save your edits before sending"
                  : "Send this reply"
            }
          >
            {isSaving ? (
              <span className="flex items-center">
                <svg
                  className="-ml-0.5 mr-1.5 h-3.5 w-3.5 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Sending…
              </span>
            ) : (
              <>
                <svg
                  className="mr-1.5 h-3.5 w-3.5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                </svg>
                Send Reply
              </>
            )}
          </button>
        </div>
      </div>

      {/* Regenerate Option */}
      <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || isSaving}
          className="text-xs font-medium text-gray-500 transition-colors hover:text-gray-700 focus:outline-none focus:underline dark:text-gray-400 dark:hover:text-gray-200"
        >
          ↻ Regenerate draft
        </button>
      </div>
    </div>
  );
}