import { NextRequest, NextResponse } from "next/server";

import type { APIResponse, Lead, CandidateLead, AuthUser } from "@/types";
import { UserRole } from "@/types";
import { withAuth } from "@/lib/auth";
import { confirmLead, getCandidateLeadByDMId } from "@/services/lead-service";
import { logAction } from "@/services/audit-logger";
import { AUDIT_ACTIONS } from "@/constants";

// ─── Request Body Validation ─────────────────────────────────────────────────

interface ConfirmLeadRequestBody {
  candidateLead?: CandidateLead;
  candidateLeadId?: string;
  dmId?: string;
  edits?: Partial<Lead>;
}

function validateRequestBody(
  body: unknown,
): { valid: boolean; parsed: ConfirmLeadRequestBody | null; error: string | null } {
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      parsed: null,
      error: "Request body is required and must be a JSON object.",
    };
  }

  const obj = body as Record<string, unknown>;

  // Must provide either candidateLead object or a dmId/candidateLeadId to look up
  const hasCandidateLead =
    obj.candidateLead &&
    typeof obj.candidateLead === "object" &&
    !Array.isArray(obj.candidateLead);

  const hasDmId =
    obj.dmId && typeof obj.dmId === "string" && obj.dmId.trim().length > 0;

  const hasCandidateLeadId =
    obj.candidateLeadId &&
    typeof obj.candidateLeadId === "string" &&
    obj.candidateLeadId.trim().length > 0;

  if (!hasCandidateLead && !hasDmId && !hasCandidateLeadId) {
    return {
      valid: false,
      parsed: null,
      error:
        "Either 'candidateLead' object, 'dmId', or 'candidateLeadId' is required to confirm a lead.",
    };
  }

  // Validate candidateLead structure if provided
  if (hasCandidateLead) {
    const candidate = obj.candidateLead as Record<string, unknown>;

    if (!candidate.dmId || typeof candidate.dmId !== "string" || candidate.dmId.trim().length === 0) {
      return {
        valid: false,
        parsed: null,
        error: "Field 'candidateLead.dmId' is required and must be a non-empty string.",
      };
    }

    if (!candidate.name || typeof candidate.name !== "string" || candidate.name.trim().length === 0) {
      return {
        valid: false,
        parsed: null,
        error: "Field 'candidateLead.name' is required and must be a non-empty string.",
      };
    }

    if (
      !candidate.contact ||
      typeof candidate.contact !== "string" ||
      candidate.contact.trim().length === 0
    ) {
      return {
        valid: false,
        parsed: null,
        error: "Field 'candidateLead.contact' is required and must be a non-empty string.",
      };
    }

    if (!candidate.intent || typeof candidate.intent !== "string" || candidate.intent.trim().length === 0) {
      return {
        valid: false,
        parsed: null,
        error: "Field 'candidateLead.intent' is required and must be a non-empty string.",
      };
    }

    if (!candidate.priority || typeof candidate.priority !== "string") {
      return {
        valid: false,
        parsed: null,
        error: "Field 'candidateLead.priority' is required and must be one of: high, medium, low.",
      };
    }

    const validPriorities = ["high", "medium", "low"];
    if (!validPriorities.includes(candidate.priority as string)) {
      return {
        valid: false,
        parsed: null,
        error: `Invalid priority: '${candidate.priority as string}'. Must be one of: ${validPriorities.join(", ")}.`,
      };
    }
  }

  // Validate edits if provided
  if (obj.edits !== undefined && obj.edits !== null) {
    if (typeof obj.edits !== "object" || Array.isArray(obj.edits)) {
      return {
        valid: false,
        parsed: null,
        error: "Field 'edits' must be a JSON object if provided.",
      };
    }

    const edits = obj.edits as Record<string, unknown>;

    // Validate budget if provided in edits
    if (edits.budget !== undefined && edits.budget !== null) {
      if (typeof edits.budget !== "string") {
        return {
          valid: false,
          parsed: null,
          error: "Field 'edits.budget' must be a string if provided.",
        };
      }
      const budgetNum = parseInt(edits.budget, 10);
      if (isNaN(budgetNum) || budgetNum <= 0) {
        return {
          valid: false,
          parsed: null,
          error: "Field 'edits.budget' must be a positive number string if provided.",
        };
      }
    }

    // Validate priority if provided in edits
    if (edits.priority !== undefined && edits.priority !== null) {
      const validPriorities = ["high", "medium", "low"];
      if (typeof edits.priority !== "string" || !validPriorities.includes(edits.priority)) {
        return {
          valid: false,
          parsed: null,
          error: `Invalid 'edits.priority': Must be one of: ${validPriorities.join(", ")}.`,
        };
      }
    }

    // Validate status if provided in edits
    if (edits.status !== undefined && edits.status !== null) {
      const validStatuses = ["new", "contacted", "qualified", "converted", "lost"];
      if (typeof edits.status !== "string" || !validStatuses.includes(edits.status)) {
        return {
          valid: false,
          parsed: null,
          error: `Invalid 'edits.status': Must be one of: ${validStatuses.join(", ")}.`,
        };
      }
    }
  }

  const parsed: ConfirmLeadRequestBody = {};

  if (hasCandidateLead) {
    const candidate = obj.candidateLead as Record<string, unknown>;
    parsed.candidateLead = {
      dmId: (candidate.dmId as string).trim(),
      name: (candidate.name as string).trim(),
      contact: (candidate.contact as string).trim(),
      budget:
        candidate.budget && typeof candidate.budget === "string" && candidate.budget.trim().length > 0
          ? candidate.budget.trim()
          : null,
      location:
        candidate.location && typeof candidate.location === "string" && candidate.location.trim().length > 0
          ? candidate.location.trim()
          : null,
      intent: (candidate.intent as string).trim(),
      priority: candidate.priority as CandidateLead["priority"],
    };
  }

  if (hasDmId) {
    parsed.dmId = (obj.dmId as string).trim();
  }

  if (hasCandidateLeadId) {
    parsed.candidateLeadId = (obj.candidateLeadId as string).trim();
  }

  if (obj.edits && typeof obj.edits === "object" && !Array.isArray(obj.edits)) {
    parsed.edits = obj.edits as Partial<Lead>;
  }

  return { valid: true, parsed, error: null };
}

// ─── POST /api/leads/confirm ─────────────────────────────────────────────────

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

  const { candidateLead: providedCandidate, dmId, edits } = validation.parsed;

  try {
    // Resolve the candidate lead
    let candidateLead: CandidateLead | null = providedCandidate ?? null;

    // If no candidate lead provided directly, try to look up by dmId
    if (!candidateLead && dmId) {
      candidateLead = getCandidateLeadByDMId(dmId);
      if (!candidateLead) {
        const response: APIResponse<null> = {
          success: false,
          data: null,
          error: `No candidate lead found for DM ID: "${dmId}". Extract a lead first before confirming.`,
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 404 });
      }
    }

    if (!candidateLead) {
      const response: APIResponse<null> = {
        success: false,
        data: null,
        error: "Could not resolve candidate lead. Provide a candidateLead object or a valid dmId.",
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Confirm the lead with optional edits
    const confirmedLead = confirmLead(
      candidateLead,
      edits ?? {},
      user.id,
    );

    // Log the confirmation action
    logAction(
      AUDIT_ACTIONS.LEAD_CREATED,
      user.id,
      {
        leadId: confirmedLead.id,
        dmId: confirmedLead.dmId,
        name: confirmedLead.name,
        contact: confirmedLead.contact,
        budget: confirmedLead.budget,
        location: confirmedLead.location,
        intent: confirmedLead.intent,
        priority: confirmedLead.priority,
        status: confirmedLead.status,
        confirmedBy: user.email,
        hasEdits: edits !== undefined && edits !== null && Object.keys(edits).length > 0,
        stage: "confirmed_via_api",
      },
      "lead",
      confirmedLead.id,
    );

    const response: APIResponse<Lead> = {
      success: true,
      data: confirmedLead,
      error: null,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred while confirming the lead.";

    logAction(
      "lead_confirm_failed",
      user.id,
      {
        dmId: dmId ?? providedCandidate?.dmId ?? "unknown",
        error: errorMessage,
      },
      "lead",
      "unknown",
    );

    // Determine appropriate status code
    let statusCode = 500;
    if (errorMessage.includes("not found") || errorMessage.includes("Not found")) {
      statusCode = 404;
    } else if (
      errorMessage.includes("required") ||
      errorMessage.includes("invalid") ||
      errorMessage.includes("Invalid")
    ) {
      statusCode = 400;
    }

    const response: APIResponse<null> = {
      success: false,
      data: null,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: statusCode });
  }
};

// ─── Exported Route Handler ──────────────────────────────────────────────────

export const POST = withAuth(handlePost, [
  UserRole.ADMIN,
  UserRole.AGENT,
  UserRole.REVIEWER,
]);