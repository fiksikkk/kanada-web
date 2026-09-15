import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  getSession,
  logout as apiLogout,
  onUnauthorized,
  NetworkError,
} from "../api/client.ts";
import { AuthContext, AuthStatus } from "./auth-context.ts";
import type { SessionUser } from "../api/client.ts";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(AuthStatus.Loading);
  const [user, setUser] = useState<SessionUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const session = await getSession();
      if (session.authenticated && session.user) {
        setUser(session.user);
        setStatus(AuthStatus.Authenticated);
        return;
      }
    } catch (err) {
      console.error("Failed to fetch session", err);
      if (err instanceof NetworkError) {
        setUser(null);
        setStatus(AuthStatus.Offline);
        return;
      }
    }
    setUser(null);
    setStatus(AuthStatus.Anonymous);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (err) {
      console.error("Failed to log out", err);
    } finally {
      setUser(null);
      setStatus(AuthStatus.Anonymous);
    }
  }, []);

  useEffect(() => {
    onUnauthorized(() => {
      setUser(null);
      setStatus(AuthStatus.Anonymous);
    });
    void refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ status, user, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
