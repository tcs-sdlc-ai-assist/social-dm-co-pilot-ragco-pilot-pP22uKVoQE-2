import { NextRequest, NextResponse } from "next/server";

import type { APIResponse, Draft, AuthUser } from "@/types";
import { UserRole } from "@/types";
import { withAuth } from "@/lib/auth";
import { getDM, updateDMStatusAction } from "@/services/dm-inbox-service";
import { generateDraft, getDraftByDMId } from "@/services/draft-service";
import { logAction } from "@/services/audit-logger";
import { AUDIT_ACTIONS } from "@/constants";

// ─── Request Body Validation ─────────────────────────────────────────────────

interface DraftGenerationRequestBody {
  regenerate?: boolean;
}

function validateRequestBody(
  body: unknown,
): { valid: boolean; parsed: DraftGenerationRequestBody; error: string | null } {
  // Body is optional for draft generation — defaults to { regenerate: false }
  if (!body || typeof body !== "object") {
    return {
      valid: true,
      parsed: { regenerate: false },
      error: null,
    };
  }

  const obj = body as Record<string, unknown>;

  let regenerate = false;
  if (obj.regenerate !== undefined) {
    if (typeof obj.regenerate !== "boolean") {
      return {
        valid: false,
        parsed: { regenerate: false },
        error: "Field 'regenerate' must be a boolean if provided.",
      };
    }
    regenerate = obj.regenerate;
  }

  return {
    valid: true,
    parsed: { regenerate },
    error: null,
  };
}

// ─── POST /api/dm/[dmId]/draft ───────────────────────────────────────────────

type RouteHandlerContext = { params: Record<string, string>; user: AuthUser };

const handlePost = async (
  request: NextRequest,
  context: RouteHandlerContext,
): Promise<NextResponse> => {
  const { user } = context;
  const dmId = context.params.dmId;

  // Validate dmId parameter
  if (!dmId || dmId.trim().length === 0) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      error: "DM ID is required.",
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(response, { status: 400 });
  }

  // Parse request body (optional)
  let body: unknown = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  // Validate request body
  const validation = validateRequestBody(body);
  if (!validation.valid) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      error: validation.error ?? "Invalid request body.",
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(response, { status: 400 });
  }

  const { regenerate } = validation.parsed;

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

    // Check for existing draft if not regenerating
    if (!regenerate) {
      const existingDraft = getDraftByDMId(dmId);
      if (existingDraft) {
        const response: APIResponse<Draft> = {
          success: true,
          data: existingDraft,
          error: null,
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 200 });
      }
    }

    // Generate draft via RAG+GPT pipeline
    const draft = await generateDraft(dmId, user.id, regenerate);

    // Update DM status to 'drafted' if currently 'new'
    if (dm.status === "new") {
      updateDMStatusAction(dmId, "drafted", user.id);
    }

    // Log the draft generation action
    logAction(
      AUDIT_ACTIONS.DRAFT_GENERATED,
      user.id,
      {
        dmId,
        draftId: draft.id,
        confidenceScore: draft.confidenceScore,
        referencedContextIds: draft.referencedContextIds,
        regenerated: regenerate,
        generatedBy: user.email,
        previousDMStatus: dm.status,
        newDMStatus: dm.status === "new" ? "drafted" : dm.status,
      },
      "draft",
      draft.id,
    );

    const response: APIResponse<Draft> = {
      success: true,
      data: draft,
      error: null,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred during draft generation.";

    logAction(
      "draft_generation_failed",
      user.id,
      {
        dmId,
        error: errorMessage,
        regenerate,
      },
      "draft",
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

// ─── GET /api/dm/[dmId]/draft ────────────────────────────────────────────────

const handleGet = async (
  request: NextRequest,
  context: RouteHandlerContext,
): Promise<NextResponse> => {
  const dmId = context.params.dmId;

  // Validate dmId parameter
  if (!dmId || dmId.trim().length === 0) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      error: "DM ID is required.",
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(response, { status: 400 });
  }

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

    // Retrieve existing draft for the DM
    const draft = getDraftByDMId(dmId);

    if (!draft) {
      const response: APIResponse<null> = {
        success: true,
        data: null,
        error: null,
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 200 });
    }

    const response: APIResponse<Draft> = {
      success: true,
      data: draft,
      error: null,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred while fetching the draft.";

    const response: APIResponse<null> = {
      success: false,
      data: null,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
};

// ─── Exported Route Handlers ─────────────────────────────────────────────────

export const POST = withAuth(handlePost, [
  UserRole.ADMIN,
  UserRole.AGENT,
  UserRole.REVIEWER,
]);

export const GET = withAuth(handleGet);