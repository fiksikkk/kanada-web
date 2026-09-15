import { createContext } from "react";
import type { SessionUser } from "../api/client.ts";

export enum AuthStatus {
  Loading = "loading",
  Authenticated = "authenticated",
  Anonymous = "anonymous",
  Offline = "offline",
}

export interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
