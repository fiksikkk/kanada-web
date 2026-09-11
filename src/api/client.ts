const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface SessionUser {
  id: number;
  username: string;
  displayName: string | null;
  role: "admin" | "user";
  totpEnabled: boolean;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: SessionUser;
}

export interface LoginResponse {
  authenticated: boolean;
  requires2fa: boolean;
}

export interface TwoFactorResponse {
  authenticated: boolean;
}

export interface TotpSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface TotpConfirmResponse {
  enabled: boolean;
  recoveryCodes: string[];
}

export interface AdminUser {
  id: number;
  username: string;
  displayName: string | null;
  role: "admin" | "user";
  totpEnabled: boolean;
  isActive: boolean;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

// Вызывается при 401 от защищённого эндпоинта (сессия протухла/отозвана
// посреди работы) - AuthContext подписывается на это, чтобы сбросить
// локальное состояние без жёсткой перезагрузки страницы.
let unauthorizedHandler: (() => void) | null = null;

export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

function readCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

async function apiFetch<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {};
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (method !== "GET") {
    const csrfToken = readCookie("kanada_csrf");
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (res.status === 401) {
    unauthorizedHandler?.();
  }

  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: unknown }).error)
        : "unknown_error";
    throw new ApiError(res.status, code);
  }

  return data as T;
}

export function getSession(): Promise<SessionResponse> {
  return apiFetch<SessionResponse>("/auth/session");
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: { username, password },
  });
}

export function verifyTwoFactor(code: string): Promise<TwoFactorResponse> {
  return apiFetch<TwoFactorResponse>("/auth/2fa/verify", {
    method: "POST",
    body: { code },
  });
}

export function verifyRecoveryCode(code: string): Promise<TwoFactorResponse> {
  return apiFetch<TwoFactorResponse>("/auth/2fa/recovery", {
    method: "POST",
    body: { code },
  });
}

export function logout(): Promise<TwoFactorResponse> {
  return apiFetch<TwoFactorResponse>("/auth/logout", { method: "POST" });
}

export function setupTotp(): Promise<TotpSetupResponse> {
  return apiFetch<TotpSetupResponse>("/auth/2fa/setup", { method: "POST" });
}

export function confirmTotp(code: string): Promise<TotpConfirmResponse> {
  return apiFetch<TotpConfirmResponse>("/auth/2fa/confirm", {
    method: "POST",
    body: { code },
  });
}

export function getAdminUsers(): Promise<{ users: AdminUser[] }> {
  return apiFetch<{ users: AdminUser[] }>("/admin/users");
}

export function resetUserTotp(userId: number): Promise<{ reset: boolean }> {
  return apiFetch<{ reset: boolean }>(`/admin/users/${userId}/2fa/reset`, {
    method: "POST",
  });
}
