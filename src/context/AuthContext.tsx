import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  getSession,
  logout as apiLogout,
  onUnauthorized,
  NetworkError,
} from "../api/client.ts";
import { AuthContext, type AuthStatus } from "./auth-context.ts";
import type { SessionUser } from "../api/client.ts";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const session = await getSession();
      if (session.authenticated && session.user) {
        setUser(session.user);
        setStatus("authenticated");
        return;
      }
    } catch (err) {
      console.error("Failed to fetch session", err);
      if (err instanceof NetworkError) {
        setUser(null);
        setStatus("offline");
        return;
      }
    }
    setUser(null);
    setStatus("anonymous");
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setStatus("anonymous");
  }, []);

  useEffect(() => {
    onUnauthorized(() => {
      setUser(null);
      setStatus("anonymous");
    });
    void refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ status, user, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
