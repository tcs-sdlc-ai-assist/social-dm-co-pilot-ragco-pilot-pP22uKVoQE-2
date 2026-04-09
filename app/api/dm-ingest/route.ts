import { NextRequest, NextResponse } from "next/server";
import type { APIResponse, DM } from "@/types";
import { UserRole } from "@/types";
import { withAuth } from "@/lib/auth";
import type { AuthUser } from "@/types";
import { ingestDM } from "@/services/dm-inbox-service";
import { logAction } from "@/services/audit-logger";
import { AUDIT_ACTIONS } from "@/constants";

// ─── Webhook Signature Validation (Simulated) ────────────────────────────────

function validateWebhookSignature(
  request: NextRequest,
  body: unknown,
): { valid: boolean; error: string | null } {
  // In production, this would verify HMAC-SHA256 signatures from Facebook/Instagram
  // For the pilot, we simulate validation by checking for a header or accepting all
  const signature = request.headers.get("x-webhook-signature");

  // If a signature header is present, validate its format (simulated)
  if (signature !== null && signature.trim().length > 0) {
    // Simulated: accept any non-empty signature
    if (signature.length < 4) {
      return { valid: false, error: "Invalid webhook signature format" };
    }
    return { valid: true, error: null };
  }

  // If no signature header, allow authenticated requests through (auth is handled by withAuth)
  return { valid: true, error: null };
}

// ─── Request Body Validation ─────────────────────────────────────────────────

interface IngestRequestBody {
  platform: string;
  data: Record<string, unknown>;
}

function validateRequestBody(
  body: unknown,
): { valid: boolean; parsed: IngestRequestBody | null; error: string | null } {
  if (!body || typeof body !== "object") {
    return { valid: false, parsed: null, error: "Request body is required and must be a JSON object." };
  }

  const obj = body as Record<string, unknown>;

  // Validate platform
  if (!obj.platform || typeof obj.platform !== "string" || obj.platform.trim().length === 0) {
    return {
      valid: false,
      parsed: null,
      error: "Field 'platform' is required and must be a non-empty string.",
    };
  }

  const normalizedPlatform = obj.platform.trim().toLowerCase();
  const supportedPlatforms = ["facebook", "fb", "instagram", "ig", "twitter", "x", "linkedin"];

  if (!supportedPlatforms.includes(normalizedPlatform)) {
    return {
      valid: false,
      parsed: null,
      error: `Unsupported platform: '${obj.platform}'. Supported platforms: facebook, instagram, twitter, linkedin.`,
    };
  }

  // Validate data payload
  if (!obj.data || typeof obj.data !== "object" || Array.isArray(obj.data)) {
    return {
      valid: false,
      parsed: null,
      error: "Field 'data' is required and must be a JSON object containing the DM payload.",
    };
  }

  return {
    valid: true,
    parsed: {
      platform: normalizedPlatform,
      data: obj.data as Record<string, unknown>,
    },
    error: null,
  };
}

// ─── POST Handler ────────────────────────────────────────────────────────────

type RouteHandlerContext = { params: Record<string, string>; user: AuthUser };

const handlePost = async (
  request: NextRequest,
  context: RouteHandlerContext,
): Promise<NextResponse> => {
  const { user } = context;

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

  // Validate webhook signature (simulated)
  const signatureResult = validateWebhookSignature(request, body);
  if (!signatureResult.valid) {
    logAction(
      "dm_ingest_signature_failed",
      user.id,
      {
        error: signatureResult.error,
        ip: request.headers.get("x-forwarded-for") ?? "unknown",
      },
      "dm",
      "unknown",
    );

    const response: APIResponse<null> = {
      success: false,
      data: null,
      error: signatureResult.error ?? "Webhook signature validation failed.",
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(response, { status: 401 });
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

  const { platform, data } = validation.parsed;

  try {
    // Ingest the DM via the inbox service (normalizes, deduplicates, stores, and logs)
    const dm: DM = ingestDM(data, platform);

    // Log the ingestion action with the authenticated user as actor
    logAction(
      AUDIT_ACTIONS.DM_RECEIVED,
      user.id,
      {
        dmId: dm.id,
        platform: dm.platform,
        senderHandle: dm.senderHandle,
        senderName: dm.senderName,
        ingestedBy: user.email,
        contentPreview:
          dm.content.length > 100
            ? dm.content.substring(0, 100) + "…"
            : dm.content,
      },
      "dm",
      dm.id,
    );

    const response: APIResponse<DM> = {
      success: true,
      data: dm,
      error: null,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "An unexpected error occurred during DM ingestion.";

    logAction(
      "dm_ingest_failed",
      user.id,
      {
        platform,
        error: errorMessage,
      },
      "dm",
      "unknown",
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
]);