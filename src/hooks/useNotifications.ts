"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Notification, PaginatedResponse, APIResponse } from "@/types";
import { API_ROUTES, POLLING_INTERVAL_MS } from "@/constants";

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const fetchNotifications = useCallback(async (isInitial: boolean = false) => {
    if (isInitial) {
      setIsLoading(true);
    }

    try {
      const response = await fetch(API_ROUTES.NOTIFICATIONS, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorBody: APIResponse<null> = await response.json().catch(() => ({
          success: false,
          data: null,
          error: `Request failed with status ${response.status}`,
          timestamp: new Date().toISOString(),
        }));
        throw new Error(errorBody.error ?? `Request failed with status ${response.status}`);
      }

      const result: PaginatedResponse<Notification> = await response.json();

      if (!isMountedRef.current) {
        return;
      }

      if (result.success) {
        setNotifications(result.data);
        setError(null);
      } else {
        throw new Error(result.error ?? "Failed to fetch notifications");
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) {
        return;
      }

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while fetching notifications.");
      }
    } finally {
      if (isMountedRef.current && isInitial) {
        setIsLoading(false);
      }
    }
  }, []);

  const markAsRead = useCallback(async (id: string): Promise<void> => {
    try {
      const response = await fetch(API_ROUTES.NOTIFICATION_BY_ID(id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "read" }),
      });

      if (!response.ok) {
        const errorBody: APIResponse<null> = await response.json().catch(() => ({
          success: false,
          data: null,
          error: `Request failed with status ${response.status}`,
          timestamp: new Date().toISOString(),
        }));
        throw new Error(errorBody.error ?? `Failed to mark notification as read`);
      }

      const result: APIResponse<Notification> = await response.json();

      if (!isMountedRef.current) {
        return;
      }

      if (result.success && result.data) {
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === id
              ? { ...notification, status: "read" as const }
              : notification
          )
        );
      } else {
        throw new Error(result.error ?? "Failed to mark notification as read");
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) {
        return;
      }

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while updating notification.");
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    fetchNotifications(true);

    intervalRef.current = setInterval(() => {
      fetchNotifications(false);
    }, POLLING_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(
    (notification) => notification.status !== "read"
  ).length;

  return {
    notifications,
    unreadCount,
    markAsRead,
    isLoading,
    error,
  };
}

export default useNotifications;