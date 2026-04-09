import { NextRequest, NextResponse } from "next/server";

import type { DM, PaginatedResponse } from "@/types";
import { withAuth } from "@/lib/auth";
import type { AuthUser } from "@/types";
import { getInbox } from "@/services/dm-inbox-service";
import type { InboxFilterParams, PaginationParams } from "@/services/dm-inbox-service";
import type { DMStatus } from "@/types";

const VALID_STATUSES: Set<string> = new Set<DMStatus>([
  "new",
  "drafted",
  "sent",
  "escalated",
]);

function isValidDMStatus(value: string): value is DMStatus {
  return VALID_STATUSES.has(value);
}

function parsePageParam(value: string | null, defaultValue: number): number {
  if (value === null || value.trim().length === 0) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 1) {
    return defaultValue;
  }
  return parsed;
}

function parseLimitParam(value: string | null, defaultValue: number): number {
  if (value === null || value.trim().length === 0) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 1) {
    return defaultValue;
  }
  // Cap at 100 to prevent excessive payloads
  return Math.min(parsed, 100);
}

export const GET = withAuth(
  async (
    request: NextRequest,
    context: { params: Record<string, string>; user: AuthUser },
  ): Promise<NextResponse> => {
    try {
      const { searchParams } = request.nextUrl;

      // Parse pagination params
      const page = parsePageParam(searchParams.get("page"), 1);
      const limit = parseLimitParam(
        searchParams.get("limit") ?? searchParams.get("pageSize"),
        20,
      );

      // Parse filter params
      const statusParam = searchParams.get("status");
      const platformParam = searchParams.get("platform");
      const searchParam =
        searchParams.get("q") ?? searchParams.get("search");

      // Validate status if provided
      if (statusParam !== null && statusParam.trim().length > 0) {
        if (!isValidDMStatus(statusParam)) {
          const errorResponse: PaginatedResponse<DM> = {
            success: false,
            data: [],
            error: `Invalid status filter: "${statusParam}". Must be one of: new, drafted, sent, escalated.`,
            timestamp: new Date().toISOString(),
            pagination: {
              page: 1,
              pageSize: limit,
              totalItems: 0,
              totalPages: 0,
            },
          };
          return NextResponse.json(errorResponse, { status: 400 });
        }
      }

      // Build filter params
      const filters: InboxFilterParams = {};

      if (statusParam && statusParam.trim().length > 0 && isValidDMStatus(statusParam)) {
        filters.status = statusParam;
      }

      if (platformParam && platformParam.trim().length > 0 && platformParam !== "all") {
        filters.platform = platformParam;
      }

      if (searchParam && searchParam.trim().length > 0) {
        filters.search = searchParam.trim();
      }

      // Build pagination params
      const pagination: PaginationParams = {
        page,
        limit,
      };

      // Fetch inbox data from service
      const result = getInbox(filters, pagination);

      return NextResponse.json(result, { status: 200 });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while fetching the inbox.";

      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          message: "Inbox API error",
          error: errorMessage,
          userId: context.user.id,
        }),
      );

      const errorResponse: PaginatedResponse<DM> = {
        success: false,
        data: [],
        error: errorMessage,
        timestamp: new Date().toISOString(),
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 0,
          totalPages: 0,
        },
      };

      return NextResponse.json(errorResponse, { status: 500 });
    }
  },
);