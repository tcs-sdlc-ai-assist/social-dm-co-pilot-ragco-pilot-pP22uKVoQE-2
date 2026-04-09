"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/inbox");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleLogin = async (
    email: string,
    password: string,
    role: UserRole,
  ): Promise<void> => {
    await login(email, password, role);
    router.push("/inbox");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" label="Loading…" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" label="Redirecting to inbox…" />
      </div>
    );
  }

  return <LoginForm onLogin={handleLogin} />;
}