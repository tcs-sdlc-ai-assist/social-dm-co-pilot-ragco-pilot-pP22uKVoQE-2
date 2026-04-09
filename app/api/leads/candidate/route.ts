import { NextRequest, NextResponse } from "next/server";

import type { APIResponse, CandidateLead, AuthUser } from "@/types";
import { UserRole } from "@/types";
import { withAuth } from "@/lib/auth";
import { createCandidateLead, getCandidateLeadByDMId } from "@/services/lead-service";
import { getDM } from "@/services/dm-inbox-service";
import { logAction } from "@/services/audit-logger";
import { AUDIT_ACTIONS } from "@/constants";

// ─── Request Body Validation ─────────────────────────────────────────────────

interface CandidateLeadRequestBody {
  dmId: string;
}

function validateRequestBody(
  body: unknown,
): { valid: boolean; parsed: CandidateLeadRequestBody | null; error: string | null } {
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      parsed: null,
      error: "Request body is required and must be a JSON object.",
    };
  }

  const obj = body as Record<string, unknown>;

  if (!obj.dmId || typeof obj.dmId !== "string" || obj.dmId.trim().length === 0) {
    return {
      valid: false,
      parsed: null,
      error: "Field 'dmId' is required and must be a non-empty string.",
    };
  }

  return {
    valid: true,
    parsed: {
      dmId: obj.dmId.trim(),
    },
    error: null,
  };
}

// ─── Per-Field Confidence Computation ────────────────────────────────────────

interface FieldConfidence {
  name: number;
  contact: number;
  budget: number;
  location: number;
  intent: number;
  overall: number;
}

function computeFieldConfidence(candidate: CandidateLead): FieldConfidence {
  // Name confidence
  let nameConfidence = 0.1;
  if (candidate.name && candidate.name !== "Unknown") {
    if (candidate.name.includes(" ") && candidate.name.length > 3) {
      nameConfidence = 0.9;
    } else if (candidate.name.startsWith("@")) {
      nameConfidence = 0.4;
    } else {
      nameConfidence = 0.6;
    }
  }

  // Contact confidence
  let contactConfidence = 0.1;
  if (candidate.contact) {
    if (candidate.contact.includes("@") && candidate.contact.includes(".") && !candidate.contact.startsWith("@")) {
      contactConfidence = 0.95;
    } else if (/^\+?\d[\d\s-]{7,}$/.test(candidate.contact.replace(/\s/g, ""))) {
      contactConfidence = 0.85;
    } else if (candidate.contact.startsWith("@") && candidate.contact !== "@unknown") {
      contactConfidence = 0.4;
    } else if (candidate.contact === "@unknown" || candidate.contact === "Unknown") {
      contactConfidence = 0.1;
    } else {
      contactConfidence = 0.3;
    }
  }

  // Budget confidence
  let budgetConfidence = 0;
  if (candidate.budget !== null && candidate.budget.trim().length > 0) {
    const budgetNum = parseInt(candidate.budget, 10);
    if (!isNaN(budgetNum) && budgetNum > 0) {
      budgetConfidence = 0.9;
    } else {
      budgetConfidence = 0.5;
    }
  }

  // Location confidence
  let locationConfidence = 0;
  if (candidate.location !== null && candidate.location.trim().length > 0) {
    locationConfidence = candidate.location.length > 2 ? 0.85 : 0.3;
  }

  // Intent confidence
  let intentConfidence = 0.3;
  if (candidate.intent) {
    const intentLower = candidate.intent.toLowerCase();
    if (intentLower.includes("general inquiry")) {
      intentConfidence = 0.3;
    } else if (
      intentLower.includes("purchasing") ||
      intentLower.includes("tour") ||
      intentLower.includes("renting")
    ) {
      intentConfidence = 0.8;
    } else if (intentLower.includes("information")) {
      intentConfidence = 0.7;
    } else {
      intentConfidence = 0.5;
    }
  }

  // Overall confidence (weighted average)
  const weights = {
    name: 0.15,
    contact: 0.25,
    budget: 0.2,
    location: 0.15,
    intent: 0.25,
  };

  const overall =
    nameConfidence * weights.name +
    contactConfidence * weights.contact +
    budgetConfidence * weights.budget +
    locationConfidence * weights.location +
    intentConfidence * weights.intent;

  return {
    name: Math.round(nameConfidence * 100) / 100,
    contact: Math.round(contactConfidence * 100) / 100,
    budget: Math.round(budgetConfidence * 100) / 100,
    location: Math.round(locationConfidence * 100) / 100,
    intent: Math.round(intentConfidence * 100) / 100,
    overall: Math.round(overall * 100) / 100,
  };
}

// ─── Response Type ───────────────────────────────────────────────────────────

interface CandidateLeadResponse {
  candidateLead: CandidateLead;
  fieldConfidence: FieldConfidence;
  status: "pending_review";
}

// ─── POST Handler ────────────────────────────────────────────────────────────

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

  const { dmId } = validation.parsed;

  try {
    // Verify the DM exists
    const dm = getDM(dmId);
    if (!dm) {
      const response: APIResponse<null> = {
        success: false,
        data: null,
        error: `DM not found: ${dmId}`,
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Check if a candidate lead already exists for this DM
    const existingCandidate = getCandidateLeadByDMId(dmId);
    if (existingCandidate) {
      const fieldConfidence = computeFieldConfidence(existingCandidate);

      const responseData: CandidateLeadResponse = {
        candidateLead: existingCandidate,
        fieldConfidence,
        status: "pending_review",
      };

      const response: APIResponse<CandidateLeadResponse> = {
        success: true,
        data: responseData,
        error: null,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 200 });
    }

    // Extract candidate lead data from the DM
    const candidateLead = createCandidateLead(dmId, user.id);

    // Compute per-field confidence scores
    const fieldConfidence = computeFieldConfidence(candidateLead);

    // Log the extraction action
    logAction(
      AUDIT_ACTIONS.LEAD_CREATED,
      user.id,
      {
        dmId,
        candidateLeadName: candidateLead.name,
        candidateLeadPriority: candidateLead.priority,
        candidateLeadIntent: candidateLead.intent,
        overallConfidence: fieldConfidence.overall,
        extractedBy: user.email,
        stage: "candidate_extraction",
      },
      "lead",
      dmId,
    );

    const responseData: CandidateLeadResponse = {
      candidateLead,
      fieldConfidence,
      status: "pending_review",
    };

    const response: APIResponse<CandidateLeadResponse> = {
      success: true,
      data: responseData,
      error: null,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred during lead extraction.";

    logAction(
      "lead_extraction_failed",
      user.id,
      {
        dmId,
        error: errorMessage,
      },
      "lead",
      dmId,
    );

    const response: APIResponse<null> = {
      success: false,
      data: null,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
};

// ─── Exported Route Handler ──────────────────────────────────────────────────

export const POST = withAuth(handlePost, [
  UserRole.ADMIN,
  UserRole.AGENT,
  UserRole.REVIEWER,
]);