import { NextRequest, NextResponse } from "next/server";

import type { APIResponse, PaginatedResponse, AuditLog } from "@/types";
import { UserRole } from "@/types";
import { withAuth } from "@/lib/auth";
import {
  getAuditLogs,
  getAuditLogCount,
  type AuditLogFilters,
} from "@/services/audit-logger";

// ─── GET /api/audit-logs ─────────────────────────────────────────────────────

export const GET = withAuth(
  async (
    request: NextRequest,
    context: { params: Record<string, string>; user: import("@/types").AuthUser },
  ): Promise<NextResponse> => {
    try {
      const { searchParams } = new URL(request.url);

      // ─── Parse Pagination ────────────────────────────────────────────
      const pageParam = searchParams.get("page");
      const pageSizeParam = searchParams.get("pageSize");

      const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
      const pageSize = pageSizeParam
        ? Math.max(1, Math.min(100, parseInt(pageSizeParam, 10) || 20))
        : 20;

      // ─── Parse Filters ───────────────────────────────────────────────
      const entityType = searchParams.get("entityType") ?? undefined;
      const entityId = searchParams.get("entityId") ?? undefined;
      const actor = searchParams.get("actor") ?? undefined;
      const dateFrom = searchParams.get("dateFrom") ?? undefined;
      const dateTo = searchParams.get("dateTo") ?? undefined;

      const filters: AuditLogFilters = {};

      if (entityType && entityType.trim().length > 0) {
        filters.entityType = entityType.trim();
      }

      if (entityId && entityId.trim().length > 0) {
        filters.entityId = entityId.trim();
      }

      if (actor && actor.trim().length > 0) {
        filters.actor = actor.trim();
      }

      if (dateFrom || dateTo) {
        filters.dateRange = {};

        if (dateFrom && dateFrom.trim().length > 0) {
          const fromDate = new Date(dateFrom.trim());
          if (!isNaN(fromDate.getTime())) {
            filters.dateRange.from = fromDate.toISOString();
          }
        }

        if (dateTo && dateTo.trim().length > 0) {
          const toDate = new Date(dateTo.trim());
          if (!isNaN(toDate.getTime())) {
            filters.dateRange.to = toDate.toISOString();
          }
        }

        // Remove dateRange if neither from nor to was valid
        if (!filters.dateRange.from && !filters.dateRange.to) {
          delete filters.dateRange;
        }
      }

      // ─── Fetch Audit Logs ────────────────────────────────────────────
      const allLogs = getAuditLogs(
        Object.keys(filters).length > 0 ? filters : undefined,
      );

      const totalItems = allLogs.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const clampedPage = Math.max(1, Math.min(page, totalPages));
      const startIndex = (clampedPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedLogs = allLogs.slice(startIndex, endIndex);

      // ─── Build Response ──────────────────────────────────────────────
      const response: PaginatedResponse<AuditLog> = {
        success: true,
        data: paginatedLogs,
        error: null,
        timestamp: new Date().toISOString(),
        pagination: {
          page: clampedPage,
          pageSize,
          totalItems,
          totalPages,
        },
      };

      return NextResponse.json(response, { status: 200 });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while fetching audit logs.";

      const errorResponse: APIResponse<null> = {
        success: false,
        data: null,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(errorResponse, { status: 500 });
    }
  },
  [UserRole.ADMIN, UserRole.REVIEWER],
);