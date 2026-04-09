import { NextRequest, NextResponse } from "next/server";

import type { APIResponse, DM, Draft, KnowledgeBaseEntry, AuthUser } from "@/types";
import { withAuth } from "@/lib/auth";
import { getDM } from "@/services/dm-inbox-service";
import { getContextForDM } from "@/services/context-retrieval-service";
import { getDraftByDMId } from "@/services/draft-service";

// ─── Response Type ───────────────────────────────────────────────────────────

interface DMDetailResponse {
  dm: DM;
  context: KnowledgeBaseEntry[];
  draft: Draft | null;
  contextSummary: string;
}

// ─── GET /api/dm/[dmId] ──────────────────────────────────────────────────────

type RouteHandlerContext = { params: Record<string, string>; user: AuthUser };

const handleGet = async (
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

  try {
    // Fetch the DM from the inbox service
    const dm = getDM(dmId.trim());

    if (!dm) {
      const response: APIResponse<null> = {
        success: false,
        data: null,
        error: `DM not found: ${dmId}`,
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Retrieve relevant knowledge base context for the DM
    let contextEntries: KnowledgeBaseEntry[] = [];
    let contextSummary = "No relevant knowledge base entries found for this message.";

    try {
      const contextResult = getContextForDM(dm);
      contextEntries = contextResult.entries;
      contextSummary = contextResult.summary;
    } catch (contextErr: unknown) {
      // Context retrieval failure is non-critical — proceed with empty context
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "warn",
          message: "Context retrieval failed for DM",
          dmId: dm.id,
          error:
            contextErr instanceof Error
              ? contextErr.message
              : "Unknown context retrieval error",
          userId: user.id,
        }),
      );
    }

    // Fetch existing draft for the DM (if any)
    let draft: Draft | null = null;

    try {
      draft = getDraftByDMId(dm.id);
    } catch (draftErr: unknown) {
      // Draft retrieval failure is non-critical — proceed without draft
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "warn",
          message: "Draft retrieval failed for DM",
          dmId: dm.id,
          error:
            draftErr instanceof Error
              ? draftErr.message
              : "Unknown draft retrieval error",
          userId: user.id,
        }),
      );
    }

    // Build the comprehensive DM detail response
    const detailResponse: DMDetailResponse = {
      dm,
      context: contextEntries,
      draft,
      contextSummary,
    };

    const response: APIResponse<DMDetailResponse> = {
      success: true,
      data: detailResponse,
      error: null,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred while fetching DM details.";

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: "DM detail API error",
        dmId,
        error: errorMessage,
        userId: user.id,
      }),
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

export const GET = withAuth(handleGet);