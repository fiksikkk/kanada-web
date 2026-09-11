import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
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

  if (status === "loading") {
    return (
      <main className="auth-screen">
        <p>Загрузка…</p>
      </main>
    );
  }
  if (status === "offline") {
    return <OfflineScreen onRetry={() => void refresh()} />;
  }
  if (status === "anonymous") {
    return <Navigate to="/login" replace />;
  }
  if (adminOnly && user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return children;
}
