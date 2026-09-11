import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth.ts";

export function ProtectedRoute({
  children,
  adminOnly,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const { status, user } = useAuth();

  if (status === "loading") {
    return null;
  }
  if (status === "anonymous") {
    return <Navigate to="/login" replace />;
  }
  if (adminOnly && user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return children;
}
