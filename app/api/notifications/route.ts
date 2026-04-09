import { NextRequest, NextResponse } from "next/server";
import type { APIResponse, PaginatedResponse, Notification } from "@/types";
import { withAuth } from "@/lib/auth";
import type { AuthUser } from "@/types";
import { UserRole } from "@/types";
import {
  triggerNotification,
  getNotifications,
  markAsRead,
  getNotificationById,
} from "@/services/notification-service";

// ─── GET /api/notifications ──────────────────────────────────────────────────

export const GET = withAuth(
  async (
    request: NextRequest,
    context: { params: Record<string, string>; user: AuthUser },
  ): Promise<NextResponse> => {
    const { user } = context;

    try {
      const { searchParams } = new URL(request.url);
      const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
      const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") ?? "50", 10) || 50));

      // Retrieve notifications for the authenticated user
      // Admins and reviewers can see all notifications; agents see their own + system
      let notifications: Notification[];

      if (user.role === UserRole.ADMIN || user.role === UserRole.REVIEWER) {
        notifications = getNotifications();
      } else {
        const allNotifications = getNotifications();
        notifications = allNotifications.filter(
          (n) =>
            n.recipientId === user.id ||
            n.recipientId === "system" ||
            n.recipientId === user.role,
        );
      }

      // Apply optional type filter
      const typeFilter = searchParams.get("type");
      if (typeFilter && typeFilter !== "all") {
        notifications = notifications.filter((n) => n.type === typeFilter);
      }

      // Apply optional status filter
      const statusFilter = searchParams.get("status");
      if (statusFilter && statusFilter !== "all") {
        notifications = notifications.filter((n) => n.status === statusFilter);
      }

      // Paginate
      const totalItems = notifications.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const clampedPage = Math.max(1, Math.min(page, totalPages));
      const startIndex = (clampedPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedNotifications = notifications.slice(startIndex, endIndex);

      const response: PaginatedResponse<Notification> = {
        success: true,
        data: paginatedNotifications,
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
        err instanceof Error ? err.message : "Failed to fetch notifications";

      const response: APIResponse<null> = {
        success: false,
        data: null,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 500 });
    }
  },
);

// ─── POST /api/notifications ─────────────────────────────────────────────────

export const POST = withAuth(
  async (
    request: NextRequest,
    context: { params: Record<string, string>; user: AuthUser },
  ): Promise<NextResponse> => {
    const { user } = context;

    // Only admins, agents, and reviewers can trigger notifications
    if (user.role === UserRole.READONLY) {
      const response: APIResponse<null> = {
        success: false,
        data: null,
        error: "Access denied. Read-only users cannot trigger notifications.",
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 403 });
    }

    try {
      const body = await request.json();

      const {
        type,
        recipientId,
        channel,
        message,
        relatedLeadId,
      } = body as {
        type?: string;
        recipientId?: string;
        channel?: string;
        message?: string;
        relatedLeadId?: string;
      };

      // Validate required fields
      if (!type || typeof type !== "string" || type.trim().length === 0) {
        const response: APIResponse<null> = {
          success: false,
          data: null,
          error: "Notification type is required. Must be one of: lead_created, draft_ready, escalation, review_needed.",
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }

      const validTypes = ["lead_created", "draft_ready", "escalation", "review_needed"];
      if (!validTypes.includes(type)) {
        const response: APIResponse<null> = {
          success: false,
          data: null,
          error: `Invalid notification type: "${type}". Must be one of: ${validTypes.join(", ")}.`,
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }

      if (!recipientId || typeof recipientId !== "string" || recipientId.trim().length === 0) {
        const response: APIResponse<null> = {
          success: false,
          data: null,
          error: "Recipient ID is required.",
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }

      const validChannels = ["email", "sms", "in_app", "slack"];
      const resolvedChannel = channel && validChannels.includes(channel) ? channel : "in_app";

      if (!message || typeof message !== "string" || message.trim().length === 0) {
        const response: APIResponse<null> = {
          success: false,
          data: null,
          error: "Notification message is required.",
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }

      const notification = triggerNotification(
        type,
        recipientId.trim(),
        resolvedChannel,
        message.trim(),
        relatedLeadId ?? undefined,
      );

      const response: APIResponse<Notification> = {
        success: true,
        data: notification,
        error: null,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 201 });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to trigger notification";

      const response: APIResponse<null> = {
        success: false,
        data: null,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 500 });
    }
  },
  [UserRole.ADMIN, UserRole.AGENT, UserRole.REVIEWER],
);

// ─── PATCH /api/notifications ────────────────────────────────────────────────

export const PATCH = withAuth(
  async (
    request: NextRequest,
    context: { params: Record<string, string>; user: AuthUser },
  ): Promise<NextResponse> => {
    try {
      const body = await request.json();

      const { id, status } = body as {
        id?: string;
        status?: string;
      };

      if (!id || typeof id !== "string" || id.trim().length === 0) {
        const response: APIResponse<null> = {
          success: false,
          data: null,
          error: "Notification ID is required.",
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }

      if (status !== "read") {
        const response: APIResponse<null> = {
          success: false,
          data: null,
          error: 'Invalid status. Only "read" is supported for PATCH.',
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // Verify notification exists
      const existing = getNotificationById(id.trim());
      if (!existing) {
        const response: APIResponse<null> = {
          success: false,
          data: null,
          error: `Notification with ID "${id}" not found.`,
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 404 });
      }

      const success = markAsRead(id.trim());

      if (!success) {
        const response: APIResponse<null> = {
          success: false,
          data: null,
          error: "Failed to mark notification as read.",
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 500 });
      }

      // Retrieve the updated notification
      const updated = getNotificationById(id.trim());

      const response: APIResponse<Notification> = {
        success: true,
        data: updated,
        error: null,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 200 });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update notification";

      const response: APIResponse<null> = {
        success: false,
        data: null,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 500 });
    }
  },
);