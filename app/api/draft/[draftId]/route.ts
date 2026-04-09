import { NextRequest, NextResponse } from "next/server";

import type { APIResponse, Draft, AuthUser } from "@/types";
import { UserRole } from "@/types";
import { withAuth } from "@/lib/auth";
import {
  editDraft,
  approveDraft,
  rejectDraft,
  getDraft,
  markDraftAsSent,
  requiresHumanReview,
} from "@/services/draft-service";
import { updateDMStatusAction } from "@/services/dm-inbox-service";
import { logAction } from "@/services/audit-logger";
import { AUDIT_ACTIONS } from "@/constants";

// ─── Request Body Validation ─────────────────────────────────────────────────

interface EditDraftRequestBody {
  editedText: string;
}

function validateEditBody(
  body: unknown,
): { valid: boolean; parsed: EditDraftRequestBody | null; error: string | null } {
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      parsed: null,
      error: "Request body is required and must be a JSON object.",
    };
  }

  const obj = body as Record<string, unknown>;

  if (
    !obj.editedText ||
    typeof obj.editedText !== "string" ||
    obj.editedText.trim().length === 0
  ) {
    return {
      valid: false,
      parsed: null,
      error: "Field 'editedText' is required and must be a non-empty string.",
    };
  }

  if (obj.editedText.trim().length > 2000) {
    return {
      valid: false,
      parsed: null,
      error: "Field 'editedText' cannot exceed 2000 characters.",
    };
  }

  return {
    valid: true,
    parsed: {
      editedText: obj.editedText.trim(),
    },
    error: null,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function errorResponse(
  message: string,
  status: number,
): NextResponse<APIResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}

function successResponse<T>(data: T, status: number = 200): NextResponse<APIResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      error: null,
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}

function extractDraftId(params: Record<string, string>): string | null {
  const draftId = params.draftId;
  if (!draftId || typeof draftId !== "string" || draftId.trim().length === 0) {
    return null;
  }
  return draftId.trim();
}

// ─── Route Handler Context Type ──────────────────────────────────────────────

type RouteHandlerContext = { params: Record<string, string>; user: AuthUser };

// ─── GET /api/draft/[draftId] — Retrieve a single draft ─────────────────────

const handleGet = async (
  _request: NextRequest,
  context: RouteHandlerContext,
): Promise<NextResponse> => {
  const draftId = extractDraftId(context.params);
  if (!draftId) {
    return errorResponse("Draft ID is required.", 400);
  }

  try {
    const draft = getDraft(draftId);
    if (!draft) {
      return errorResponse(`Draft with ID "${draftId}" not found.`, 404);
    }

    return successResponse<Draft>(draft);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred while fetching the draft.";

    return errorResponse(errorMessage, 500);
  }
};

export const GET = withAuth(handleGet, [
  UserRole.ADMIN,
  UserRole.AGENT,
  UserRole.REVIEWER,
  UserRole.READONLY,
]);

// ─── PUT /api/draft/[draftId] — Edit draft text ─────────────────────────────

const handlePut = async (
  request: NextRequest,
  context: RouteHandlerContext,
): Promise<NextResponse> => {
  const { user } = context;
  const draftId = extractDraftId(context.params);

  if (!draftId) {
    return errorResponse("Draft ID is required.", 400);
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON in request body.", 400);
  }

  // Validate request body
  const validation = validateEditBody(body);
  if (!validation.valid || !validation.parsed) {
    return errorResponse(validation.error ?? "Invalid request body.", 400);
  }

  const { editedText } = validation.parsed;

  try {
    // Verify draft exists before editing
    const existingDraft = getDraft(draftId);
    if (!existingDraft) {
      return errorResponse(`Draft with ID "${draftId}" not found.`, 404);
    }

    // Attempt to edit the draft
    const updatedDraft = editDraft(draftId, editedText, user.id);

    if (!updatedDraft) {
      return errorResponse(`Draft with ID "${draftId}" not found.`, 404);
    }

    // Log the edit action
    logAction(
      AUDIT_ACTIONS.DRAFT_EDITED,
      user.id,
      {
        draftId,
        dmId: updatedDraft.dmId,
        editedBy: user.email,
        previousStatus: existingDraft.status,
        newStatus: updatedDraft.status,
        editedTextLength: editedText.length,
      },
      "draft",
      draftId,
    );

    return successResponse<Draft>(updatedDraft);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred while editing the draft.";

    logAction(
      "draft_edit_failed",
      user.id,
      {
        draftId,
        error: errorMessage,
      },
      "draft",
      draftId,
    );

    // Determine appropriate status code
    let statusCode = 500;
    if (errorMessage.includes("not found") || errorMessage.includes("Not found")) {
      statusCode = 404;
    } else if (
      errorMessage.includes("empty") ||
      errorMessage.includes("exceed") ||
      errorMessage.includes("Cannot edit")
    ) {
      statusCode = 400;
    } else if (errorMessage.includes("already been sent")) {
      statusCode = 409;
    }

    return errorResponse(errorMessage, statusCode);
  }
};

export const PUT = withAuth(handlePut, [
  UserRole.ADMIN,
  UserRole.AGENT,
  UserRole.REVIEWER,
]);

// ─── POST /api/draft/[draftId] — Approve or reject a draft ──────────────────

const handlePost = async (
  request: NextRequest,
  context: RouteHandlerContext,
): Promise<NextResponse> => {
  const { user } = context;
  const draftId = extractDraftId(context.params);

  if (!draftId) {
    return errorResponse("Draft ID is required.", 400);
  }

  // Parse request body to determine action
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Body is optional for approve action — default to approve
  }

  const action =
    typeof body.action === "string" ? body.action.trim().toLowerCase() : "approve";

  try {
    // Verify draft exists
    const existingDraft = getDraft(draftId);
    if (!existingDraft) {
      return errorResponse(`Draft with ID "${draftId}" not found.`, 404);
    }

    if (action === "reject") {
      // ─── Reject Draft ──────────────────────────────────────────────
      const rejectedDraft = rejectDraft(draftId, user.id);

      if (!rejectedDraft) {
        return errorResponse(`Draft with ID "${draftId}" not found.`, 404);
      }

      logAction(
        AUDIT_ACTIONS.DRAFT_REJECTED,
        user.id,
        {
          draftId,
          dmId: rejectedDraft.dmId,
          rejectedBy: user.email,
          confidenceScore: rejectedDraft.confidenceScore,
          previousStatus: existingDraft.status,
        },
        "draft",
        draftId,
      );

      return successResponse<Draft>(rejectedDraft);
    }

    if (action === "send") {
      // ─── Approve and Send Draft ────────────────────────────────────
      // First approve if not already approved
      let draftToSend = existingDraft;

      if (existingDraft.status === "pending") {
        // Enforce human-in-the-loop for low-confidence drafts
        const needsReview = requiresHumanReview(draftId);
        if (needsReview) {
          logAction(
            "draft_low_confidence_review",
            user.id,
            {
              draftId,
              dmId: existingDraft.dmId,
              confidenceScore: existingDraft.confidenceScore,
              reviewedBy: user.email,
              action: "explicit_approval_for_low_confidence",
            },
            "draft",
            draftId,
          );
        }

        const approved = approveDraft(draftId, user.id);
        if (!approved) {
          return errorResponse(`Failed to approve draft "${draftId}".`, 500);
        }
        draftToSend = approved;
      }

      if (draftToSend.status !== "approved") {
        return errorResponse(
          `Cannot send a draft with status "${draftToSend.status}". Draft must be approved first.`,
          400,
        );
      }

      // Mark draft as sent
      const sentDraft = markDraftAsSent(draftId, user.id);
      if (!sentDraft) {
        return errorResponse(`Failed to mark draft "${draftId}" as sent.`, 500);
      }

      // Update the associated DM status to 'sent'
      updateDMStatusAction(sentDraft.dmId, "sent", user.id);

      logAction(
        AUDIT_ACTIONS.DRAFT_SENT,
        user.id,
        {
          draftId,
          dmId: sentDraft.dmId,
          sentBy: user.email,
          confidenceScore: sentDraft.confidenceScore,
          hasEdits: sentDraft.editedText !== null,
        },
        "draft",
        draftId,
      );

      return successResponse<Draft>(sentDraft);
    }

    // ─── Default: Approve Draft ────────────────────────────────────────
    // Enforce human-in-the-loop for low-confidence drafts
    const needsReview = requiresHumanReview(draftId);
    if (needsReview) {
      logAction(
        "draft_low_confidence_review",
        user.id,
        {
          draftId,
          dmId: existingDraft.dmId,
          confidenceScore: existingDraft.confidenceScore,
          reviewedBy: user.email,
          action: "explicit_approval_for_low_confidence",
        },
        "draft",
        draftId,
      );
    }

    const approvedDraft = approveDraft(draftId, user.id);

    if (!approvedDraft) {
      return errorResponse(`Draft with ID "${draftId}" not found.`, 404);
    }

    logAction(
      AUDIT_ACTIONS.DRAFT_APPROVED,
      user.id,
      {
        draftId,
        dmId: approvedDraft.dmId,
        approvedBy: user.email,
        confidenceScore: approvedDraft.confidenceScore,
        previousStatus: existingDraft.status,
        requiredExplicitReview: needsReview,
        hasEdits: approvedDraft.editedText !== null,
      },
      "draft",
      draftId,
    );

    return successResponse<Draft>(approvedDraft);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred during draft review.";

    logAction(
      "draft_review_failed",
      user.id,
      {
        draftId,
        action,
        error: errorMessage,
      },
      "draft",
      draftId,
    );

    // Determine appropriate status code
    let statusCode = 500;
    if (errorMessage.includes("not found") || errorMessage.includes("Not found")) {
      statusCode = 404;
    } else if (
      errorMessage.includes("Cannot approve") ||
      errorMessage.includes("Cannot reject") ||
      errorMessage.includes("Cannot send") ||
      errorMessage.includes("must be approved")
    ) {
      statusCode = 400;
    } else if (errorMessage.includes("already been sent")) {
      statusCode = 409;
    }

    return errorResponse(errorMessage, statusCode);
  }
};

export const POST = withAuth(handlePost, [
  UserRole.ADMIN,
  UserRole.AGENT,
  UserRole.REVIEWER,
]);

// ─── PATCH /api/draft/[draftId] — Partial update (edit text or status) ───────

const handlePatch = async (
  request: NextRequest,
  context: RouteHandlerContext,
): Promise<NextResponse> => {
  const { user } = context;
  const draftId = extractDraftId(context.params);

  if (!draftId) {
    return errorResponse("Draft ID is required.", 400);
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON in request body.", 400);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("Request body is required and must be a JSON object.", 400);
  }

  const obj = body as Record<string, unknown>;

  try {
    // Verify draft exists
    const existingDraft = getDraft(draftId);
    if (!existingDraft) {
      return errorResponse(`Draft with ID "${draftId}" not found.`, 404);
    }

    // Handle editedText update
    if (obj.editedText !== undefined) {
      if (typeof obj.editedText !== "string" || obj.editedText.trim().length === 0) {
        return errorResponse("Field 'editedText' must be a non-empty string.", 400);
      }

      if (obj.editedText.trim().length > 2000) {
        return errorResponse("Field 'editedText' cannot exceed 2000 characters.", 400);
      }

      const updatedDraft = editDraft(draftId, obj.editedText.trim(), user.id);

      if (!updatedDraft) {
        return errorResponse(`Draft with ID "${draftId}" not found.`, 404);
      }

      logAction(
        AUDIT_ACTIONS.DRAFT_EDITED,
        user.id,
        {
          draftId,
          dmId: updatedDraft.dmId,
          editedBy: user.email,
          method: "PATCH",
        },
        "draft",
        draftId,
      );

      return successResponse<Draft>(updatedDraft);
    }

    // Handle status update
    if (obj.status !== undefined) {
      if (typeof obj.status !== "string") {
        return errorResponse("Field 'status' must be a string.", 400);
      }

      const validStatuses = ["approved", "rejected"];
      if (!validStatuses.includes(obj.status)) {
        return errorResponse(
          `Invalid status: "${obj.status}". Must be one of: ${validStatuses.join(", ")}.`,
          400,
        );
      }

      if (obj.status === "approved") {
        const approved = approveDraft(draftId, user.id);
        if (!approved) {
          return errorResponse(`Draft with ID "${draftId}" not found.`, 404);
        }

        logAction(
          AUDIT_ACTIONS.DRAFT_APPROVED,
          user.id,
          {
            draftId,
            dmId: approved.dmId,
            approvedBy: user.email,
            method: "PATCH",
          },
          "draft",
          draftId,
        );

        return successResponse<Draft>(approved);
      }

      if (obj.status === "rejected") {
        const rejected = rejectDraft(draftId, user.id);
        if (!rejected) {
          return errorResponse(`Draft with ID "${draftId}" not found.`, 404);
        }

        logAction(
          AUDIT_ACTIONS.DRAFT_REJECTED,
          user.id,
          {
            draftId,
            dmId: rejected.dmId,
            rejectedBy: user.email,
            method: "PATCH",
          },
          "draft",
          draftId,
        );

        return successResponse<Draft>(rejected);
      }
    }

    return errorResponse(
      "No valid update fields provided. Provide 'editedText' or 'status'.",
      400,
    );
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred while updating the draft.";

    logAction(
      "draft_patch_failed",
      user.id,
      {
        draftId,
        error: errorMessage,
      },
      "draft",
      draftId,
    );

    let statusCode = 500;
    if (errorMessage.includes("not found") || errorMessage.includes("Not found")) {
      statusCode = 404;
    } else if (
      errorMessage.includes("Cannot") ||
      errorMessage.includes("empty") ||
      errorMessage.includes("exceed")
    ) {
      statusCode = 400;
    } else if (errorMessage.includes("already been sent")) {
      statusCode = 409;
    }

    return errorResponse(errorMessage, statusCode);
  }
};

export const PATCH = withAuth(handlePatch, [
  UserRole.ADMIN,
  UserRole.AGENT,
  UserRole.REVIEWER,
]);