import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Role } from "../api/client.ts";
import { AuthStatus } from "../context/auth-context.ts";
import { useAuth } from "../context/useAuth.ts";
import { OfflineScreen } from "./OfflineScreen.tsx";
import "../pages/AuthPages.css";

export function ProtectedRoute({
  children,
  adminOnly,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const { status, user, refresh } = useAuth();

  if (status === AuthStatus.Loading) {
    return (
      <main className="auth-screen">
        <p>Загрузка…</p>
      </main>
    );
  }
  if (status === AuthStatus.Offline) {
    return <OfflineScreen onRetry={() => void refresh()} />;
  }
  if (status === AuthStatus.Anonymous) {
    return <Navigate to="/login" replace />;
  }
  if (adminOnly && user?.role !== Role.Admin) {
    return <Navigate to="/" replace />;
  }
  return children;
}
