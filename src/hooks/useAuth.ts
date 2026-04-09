"use client";

import { useState, useEffect, useCallback } from "react";
import type { AuthUser, APIResponse } from "@/types";
import { UserRole } from "@/types";
import { API_ROUTES } from "@/constants";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const TOKEN_STORAGE_KEY = "social_dm_copilot_token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage unavailable — silently ignore
  }
}

function removeStoredToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Storage unavailable — silently ignore
  }
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const validateToken = useCallback(async (token: string): Promise<void> => {
    try {
      const response = await fetch(API_ROUTES.AUTH_ME, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        removeStoredToken();
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
        return;
      }

      const body: APIResponse<AuthUser> = await response.json();

      if (body.success && body.data) {
        setState({
          user: body.data,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        removeStoredToken();
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    } catch {
      removeStoredToken();
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  // Auto-validate token on mount
  useEffect(() => {
    const storedToken = getStoredToken();
    if (storedToken) {
      validateToken(storedToken);
    } else {
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, [validateToken]);

  const login = useCallback(
    async (email: string, password: string, role: UserRole): Promise<void> => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        const response = await fetch(API_ROUTES.AUTH_LOGIN, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password, role }),
        });

        const body: APIResponse<{ user: AuthUser; token: string }> =
          await response.json();

        if (!response.ok || !body.success || !body.data) {
          const errorMessage =
            body.error ?? "Login failed. Please check your credentials.";
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: errorMessage,
          }));
          throw new Error(errorMessage);
        }

        const { user, token } = body.data;

        setStoredToken(token);

        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } catch (err: unknown) {
        if (err instanceof Error) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: prev.error ?? err.message,
          }));
          throw err;
        }
        const fallbackError = "An unexpected error occurred during login.";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: fallbackError,
        }));
        throw new Error(fallbackError);
      }
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    const currentToken = state.token ?? getStoredToken();

    try {
      if (currentToken) {
        await fetch(API_ROUTES.AUTH_LOGOUT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`,
            "Content-Type": "application/json",
          },
        });
      }
    } catch {
      // Logout API failure is non-critical — proceed with local cleanup
    } finally {
      removeStoredToken();
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, [state.token]);

  return {
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    login,
    logout,
  };
}

export default useAuth;