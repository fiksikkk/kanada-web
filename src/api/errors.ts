import { ApiError } from "./client.ts";

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Неверный логин или пароль",
  account_locked: "Аккаунт временно заблокирован из-за неудачных попыток входа",
  account_inactive: "Аккаунт отключён",
  too_many_requests: "Слишком много попыток, попробуйте позже",
  challenge_expired: "Время входа истекло, попробуйте снова",
  too_many_attempts: "Слишком много неверных попыток, войдите заново",
  invalid_code: "Неверный код",
  invalid_request: "Некорректный запрос",
};

export function describeAuthError(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? "Что-то пошло не так, попробуйте ещё раз";
  }
  return "Не удалось связаться с сервером";
}
