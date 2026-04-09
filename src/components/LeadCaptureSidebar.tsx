"use client";

import { useState, useEffect, useCallback } from "react";
import type { CandidateLead, Lead } from "@/types";
import { useLeads } from "@/hooks/useLeads";
import StatusBadge from "@/components/StatusBadge";
import LoadingSpinner from "@/components/LoadingSpinner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LeadCaptureSidebarProps {
  dmId: string;
}

interface EditableField {
  value: string;
  confidence: number;
  isEdited: boolean;
}

interface EditableFields {
  name: EditableField;
  contact: EditableField;
  budget: EditableField;
  location: EditableField;
  intent: EditableField;
}

// ─── Confidence Helpers ──────────────────────────────────────────────────────

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) {
    return "text-green-600 dark:text-green-400";
  }
  if (confidence >= 0.5) {
    return "text-yellow-600 dark:text-yellow-400";
  }
  return "text-red-600 dark:text-red-400";
}

function getConfidenceDotColor(confidence: number): string {
  if (confidence >= 0.8) {
    return "bg-green-500";
  }
  if (confidence >= 0.5) {
    return "bg-yellow-500";
  }
  return "bg-red-500";
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) {
    return "High";
  }
  if (confidence >= 0.5) {
    return "Medium";
  }
  return "Low";
}

function estimateFieldConfidence(fieldName: string, value: string | null): number {
  if (!value || value.trim().length === 0) {
    return 0;
  }

  switch (fieldName) {
    case "name":
      if (value === "Unknown") return 0.1;
      if (value.includes(" ") && value.length > 3) return 0.9;
      return 0.5;
    case "contact":
      if (value.includes("@") && value.includes(".")) return 0.95;
      if (/^\+?\d[\d\s-]{7,}$/.test(value.replace(/\s/g, ""))) return 0.85;
      if (value.startsWith("@")) return 0.4;
      return 0.3;
    case "budget":
      if (/^\d+$/.test(value) && parseInt(value, 10) > 0) return 0.9;
      return 0.5;
    case "location":
      return value.length > 2 ? 0.85 : 0.3;
    case "intent":
      if (value.toLowerCase().includes("general inquiry")) return 0.3;
      return 0.7;
    default:
      return 0.5;
  }
}

// ─── Sync Status Icon ────────────────────────────────────────────────────────

function SyncStatusIndicator({ lead }: { lead: Lead | null }) {
  if (!lead) {
    return null;
  }

  if (lead.salesforceId) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <svg
          className="h-3.5 w-3.5"
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
        Synced to Salesforce
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      <svg
        className="h-3.5 w-3.5"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
          clipRule="evenodd"
        />
      </svg>
      Not synced
    </div>
  );
}

// ─── Priority Display ────────────────────────────────────────────────────────

function PriorityDisplay({ priority }: { priority: string }) {
  const priorityColorMap: Record<string, string> = {
    high: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
    low: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  };

  const colorClass =
    priorityColorMap[priority.toLowerCase()] ??
    "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${colorClass}`}>
      <svg
        className="h-4 w-4 flex-shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"
          clipRule="evenodd"
        />
      </svg>
      <span className="text-sm font-semibold capitalize">{priority} Priority</span>
    </div>
  );
}

// ─── Editable Field Component ────────────────────────────────────────────────

interface EditableFieldRowProps {
  label: string;
  field: EditableField;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}

function EditableFieldRow({
  label,
  field,
  onChange,
  placeholder = "",
  type = "text",
}: EditableFieldRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
        </label>
        <div className="flex items-center gap-1">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${getConfidenceDotColor(field.confidence)}`}
            aria-hidden="true"
          />
          <span className={`text-2xs font-medium ${getConfidenceColor(field.confidence)}`}>
            {getConfidenceLabel(field.confidence)}
          </span>
          {field.isEdited && (
            <span className="text-2xs text-blue-500 dark:text-blue-400">(edited)</span>
          )}
        </div>
      </div>
      <input
        type={type}
        value={field.value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
      />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function LeadCaptureSidebar({ dmId }: LeadCaptureSidebarProps) {
  const {
    candidateLead,
    lead,
    extractLead,
    confirmLead,
    syncToSalesforce,
    isExtracting,
    isConfirming,
    isSyncing,
    error,
  } = useLeads(dmId);

  const [fields, setFields] = useState<EditableFields | null>(null);
  const [flagForFollowUp, setFlagForFollowUp] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);

  // Populate editable fields when candidateLead changes
  useEffect(() => {
    if (candidateLead) {
      setFields({
        name: {
          value: candidateLead.name,
          confidence: estimateFieldConfidence("name", candidateLead.name),
          isEdited: false,
        },
        contact: {
          value: candidateLead.contact,
          confidence: estimateFieldConfidence("contact", candidateLead.contact),
          isEdited: false,
        },
        budget: {
          value: candidateLead.budget ?? "",
          confidence: estimateFieldConfidence("budget", candidateLead.budget),
          isEdited: false,
        },
        location: {
          value: candidateLead.location ?? "",
          confidence: estimateFieldConfidence("location", candidateLead.location),
          isEdited: false,
        },
        intent: {
          value: candidateLead.intent,
          confidence: estimateFieldConfidence("intent", candidateLead.intent),
          isEdited: false,
        },
      });
    }
  }, [candidateLead]);

  const handleFieldChange = useCallback(
    (fieldName: keyof EditableFields) => (value: string) => {
      setFields((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [fieldName]: {
            value,
            confidence: prev[fieldName].confidence,
            isEdited: true,
          },
        };
      });
    },
    [],
  );

  const handleExtract = useCallback(async () => {
    await extractLead();
    setHasExtracted(true);
  }, [extractLead]);

  const handleCreateLead = useCallback(async () => {
    if (!fields || !candidateLead) return;

    const updatedCandidate: CandidateLead = {
      dmId: candidateLead.dmId,
      name: fields.name.value || candidateLead.name,
      contact: fields.contact.value || candidateLead.contact,
      budget: fields.budget.value.trim().length > 0 ? fields.budget.value.trim() : null,
      location: fields.location.value.trim().length > 0 ? fields.location.value.trim() : null,
      intent: fields.intent.value || candidateLead.intent,
      priority: candidateLead.priority,
    };

    await confirmLead(updatedCandidate);
  }, [fields, candidateLead, confirmLead]);

  const handleSyncToSalesforce = useCallback(async () => {
    if (!lead) return;
    await syncToSalesforce(lead.id);
  }, [lead, syncToSalesforce]);

  // ─── Render: Initial State (No Extraction Yet) ────────────────────────────

  if (!hasExtracted && !candidateLead && !lead) {
    return (
      <aside className="card space-y-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Lead Capture
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Extract lead information from this DM to create a qualified lead.
        </p>
        <button
          type="button"
          onClick={handleExtract}
          disabled={isExtracting}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-400"
        >
          {isExtracting ? (
            <>
              <LoadingSpinner size="sm" />
              Extracting…
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.238a1 1 0 000 1.962l1.192.238a1 1 0 01.785.785l.238 1.192a1 1 0 001.962 0l.238-1.192a1 1 0 01.785-.785l1.192-.238a1 1 0 000-1.962l-1.192-.238a1 1 0 01-.785-.785l-.238-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.684a1 1 0 01.633.632l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.95 5.684zM13.949 13.684a1 1 0 00-1.898 0l-.184.551a1 1 0 01-.632.633l-.551.183a1 1 0 000 1.898l.551.183a1 1 0 01.633.633l.183.551a1 1 0 001.898 0l.184-.551a1 1 0 01.632-.633l.551-.183a1 1 0 000-1.898l-.551-.184a1 1 0 01-.633-.632l-.183-.551z" />
              </svg>
              Extract Lead Data
            </>
          )}
        </button>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
      </aside>
    );
  }

  // ─── Render: Extracting State ──────────────────────────────────────────────

  if (isExtracting) {
    return (
      <aside className="card flex flex-col items-center justify-center space-y-3 py-8">
        <LoadingSpinner size="md" label="Extracting lead data…" />
      </aside>
    );
  }

  // ─── Render: Lead Already Created ──────────────────────────────────────────

  if (lead) {
    return (
      <aside className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Lead Created
          </h2>
          <StatusBadge status={lead.status} size="sm" />
        </div>

        <PriorityDisplay priority={lead.priority} />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Name</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{lead.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Contact</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">{lead.contact}</span>
          </div>
          {lead.budget && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Budget</span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                ${parseInt(lead.budget, 10).toLocaleString()}
              </span>
            </div>
          )}
          {lead.location && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Location</span>
              <span className="text-sm text-gray-700 dark:text-gray-300">{lead.location}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Intent</span>
            <span className="text-sm text-gray-700 dark:text-gray-300 text-right max-w-[60%]">
              {lead.intent}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
          <SyncStatusIndicator lead={lead} />
        </div>

        {!lead.salesforceId && (
          <button
            type="button"
            onClick={handleSyncToSalesforce}
            disabled={isSyncing}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {isSyncing ? (
              <>
                <LoadingSpinner size="sm" />
                Syncing…
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.06-.179zm-9.624-2.848a5.5 5.5 0 019.201-2.466l.312.311H12.77a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V3.537a.75.75 0 00-1.5 0v2.033l-.312-.311A7 7 0 003.63 8.397a.75.75 0 001.06.179z"
                    clipRule="evenodd"
                  />
                </svg>
                Sync to Salesforce
              </>
            )}
          </button>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
      </aside>
    );
  }

  // ─── Render: Candidate Lead (Editable Fields) ─────────────────────────────

  if (!fields || !candidateLead) {
    return (
      <aside className="card space-y-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Lead Capture
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No lead data could be extracted from this message.
        </p>
        <button
          type="button"
          onClick={handleExtract}
          disabled={isExtracting}
          className="btn-secondary w-full text-sm"
        >
          Retry Extraction
        </button>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Lead Capture
        </h2>
        <button
          type="button"
          onClick={handleExtract}
          disabled={isExtracting}
          className="text-xs text-blue-600 hover:text-blue-800 transition-colors focus:outline-none dark:text-blue-400 dark:hover:text-blue-300"
          aria-label="Re-extract lead data"
        >
          Re-extract
        </button>
      </div>

      <PriorityDisplay priority={candidateLead.priority} />

      <div className="space-y-3">
        <EditableFieldRow
          label="Name"
          field={fields.name}
          onChange={handleFieldChange("name")}
          placeholder="Contact name"
        />
        <EditableFieldRow
          label="Contact"
          field={fields.contact}
          onChange={handleFieldChange("contact")}
          placeholder="Email or phone"
        />
        <EditableFieldRow
          label="Budget"
          field={fields.budget}
          onChange={handleFieldChange("budget")}
          placeholder="e.g. 500000"
        />
        <EditableFieldRow
          label="Location"
          field={fields.location}
          onChange={handleFieldChange("location")}
          placeholder="Preferred location"
        />
        <EditableFieldRow
          label="Intent"
          field={fields.intent}
          onChange={handleFieldChange("intent")}
          placeholder="Buyer intent"
        />
      </div>

      {/* Flag for Sales Follow-Up Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Flag for Sales Follow-Up
          </span>
          <span className="text-2xs text-gray-500 dark:text-gray-400">
            Notify sales team immediately
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={flagForFollowUp}
          onClick={() => setFlagForFollowUp((prev) => !prev)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            flagForFollowUp
              ? "bg-emerald-600"
              : "bg-gray-200 dark:bg-gray-600"
          }`}
        >
          <span className="sr-only">Flag for sales follow-up</span>
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              flagForFollowUp ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Create Lead Button */}
      <button
        type="button"
        onClick={handleCreateLead}
        disabled={isConfirming}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-400"
      >
        {isConfirming ? (
          <>
            <LoadingSpinner size="sm" />
            Creating Lead…
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Create Lead in Salesforce
          </>
        )}
      </button>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}
    </aside>
  );
}