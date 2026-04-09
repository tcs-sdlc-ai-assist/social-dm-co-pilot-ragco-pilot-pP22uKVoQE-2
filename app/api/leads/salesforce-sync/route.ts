import { NextRequest, NextResponse } from "next/server";

import type { APIResponse, Lead, AuthUser } from "@/types";
import { UserRole } from "@/types";
import { withAuth } from "@/lib/auth";
import { getLeadById, updateLeadStatus } from "@/services/lead-service";
import { createLead as salesforceCreateLead } from "@/services/salesforce-adapter";
import { logAction } from "@/services/audit-logger";
import { AUDIT_ACTIONS } from "@/constants";

// ─── Request Body Validation ─────────────────────────────────────────────────

interface SalesforceSyncRequestBody {
  leadId: string;
}

function validateRequestBody(
  body: unknown,
): { valid: boolean; parsed: SalesforceSyncRequestBody | null; error: string | null } {
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      parsed: null,
      error: "Request body is required and must be a JSON object.",
    };
  }

  const obj = body as Record<string, unknown>;

  if (!obj.leadId || typeof obj.leadId !== "string" || obj.leadId.trim().length === 0) {
    return {
      valid: false,
      parsed: null,
      error: "Field 'leadId' is required and must be a non-empty string.",
    };
  }

  return {
    valid: true,
    parsed: {
      leadId: obj.leadId.trim(),
    },
    error: null,
  };
}

// ─── POST /api/leads/salesforce-sync ─────────────────────────────────────────

type RouteHandlerContext = { params: Record<string, string>; user: AuthUser };

const handlePost = async (
  request: NextRequest,
  context: RouteHandlerContext,
): Promise<NextResponse> => {
  const { user } = context;

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      error: "Invalid JSON in request body.",
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(response, { status: 400 });
  }

  // Validate request body
  const validation = validateRequestBody(body);
  if (!validation.valid || !validation.parsed) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      error: validation.error ?? "Invalid request body.",
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(response, { status: 400 });
  }

  const { leadId } = validation.parsed;

  // Retrieve the lead
  const lead = getLeadById(leadId);
  if (!lead) {
    logAction(
      "salesforce_sync_not_found",
      user.id,
      {
        leadId,
        error: "Lead not found",
      },
      "lead",
      leadId,
    );

    const response: APIResponse<null> = {
      success: false,
      data: null,
      error: `Lead with ID "${leadId}" not found.`,
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(response, { status: 404 });
  }

  // Check if already synced to Salesforce
  if (lead.salesforceId) {
    logAction(
      "salesforce_sync_already_synced",
      user.id,
      {
        leadId,
        salesforceId: lead.salesforceId,
      },
      "lead",
      leadId,
    );

    const response: APIResponse<Lead> = {
      success: true,
      data: lead,
      error: null,
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(response, { status: 200 });
  }

  // Attempt Salesforce sync with retry logic
  const maxRetries = 3;
  let lastError: string | null = null;
  let syncResult: { salesforceId: string; success: boolean } | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await salesforceCreateLead(lead);

      if (result.success && result.salesforceId) {
        syncResult = result;
        break;
      }

      lastError = "Salesforce API returned unsuccessful response.";

      // If not the last attempt, wait before retrying with exponential backoff
      if (attempt < maxRetries - 1) {
        const delayMs = Math.pow(2, attempt) * 500;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (err: unknown) {
      lastError =
        err instanceof Error ? err.message : "Unknown error during Salesforce sync.";

      // If not the last attempt, wait before retrying
      if (attempt < maxRetries - 1) {
        const delayMs = Math.pow(2, attempt) * 500;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // Handle sync failure after all retries
  if (!syncResult || !syncResult.success) {
    logAction(
      AUDIT_ACTIONS.LEAD_UPDATED,
      user.id,
      {
        leadId,
        action: "salesforce_sync_failed",
        error: lastError,
        retries: maxRetries,
      },
      "lead",
      leadId,
    );

    const response: APIResponse<null> = {
      success: false,
      data: null,
      error: lastError ?? "Failed to sync lead to Salesforce after multiple attempts.",
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(response, { status: 502 });
  }

  // Update lead with Salesforce ID and status
  const updatedLead = updateLeadStatus(leadId, "contacted", user.id);

  // Manually set the salesforceId on the returned lead since updateLeadStatus
  // only changes status. We need to reflect the sync result.
  const leadWithSalesforceId: Lead = {
    ...(updatedLead ?? lead),
    salesforceId: syncResult.salesforceId,
    status: "contacted",
  };

  // Log successful sync
  logAction(
    AUDIT_ACTIONS.LEAD_UPDATED,
    user.id,
    {
      leadId,
      salesforceId: syncResult.salesforceId,
      action: "salesforce_sync_success",
      previousStatus: lead.status,
      newStatus: "contacted",
      syncedBy: user.email,
    },
    "lead",
    leadId,
  );

  const response: APIResponse<Lead> = {
    success: true,
    data: leadWithSalesforceId,
    error: null,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status: 200 });
};

// ─── Exported Route Handler ──────────────────────────────────────────────────

export const POST = withAuth(handlePost, [
  UserRole.ADMIN,
  UserRole.AGENT,
]);