"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { AuthUser } from "@/types";
import { UserRole } from "@/types";

// ─── Context Type ────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
  } = useAuth();

  const hasRole = useMemo(() => {
    return (role: UserRole): boolean => {
      if (!user) {
        return false;
      }
      return user.role === role;
    };
  }, [user]);

  const hasAnyRole = useMemo(() => {
    return (roles: UserRole[]): boolean => {
      if (!user) {
        return false;
      }
      return roles.includes(user.role);
    };
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated,
      isLoading,
      error,
      login,
      logout,
      hasRole,
      hasAnyRole,
    }),
    [user, token, isAuthenticated, isLoading, error, login, logout, hasRole, hasAnyRole],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Consumer Hook ───────────────────────────────────────────────────────────

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error(
      "useAuthContext must be used within an AuthProvider. " +
        "Wrap your component tree with <AuthProvider>.",
    );
  }

  return context;
}

export default AuthProvider;