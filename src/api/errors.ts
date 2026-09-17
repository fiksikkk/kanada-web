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
  "2fa_already_enabled": "Двухфакторная аутентификация уже включена",
  no_pending_secret: "Сначала запросите новый QR-код",
  unauthorized: "Сессия истекла, войдите заново",
  csrf_mismatch: "Не удалось подтвердить запрос, обновите страницу",
  user_not_found: "Пользователь не найден",
  forbidden: "Недостаточно прав",
  backup_failed: "Не удалось сделать бэкап (сервер недоступен?)",
  restore_failed: "Не удалось восстановить бэкап (сервер недоступен?)",
  backup_not_found: "Бэкап не найден",
  invalid_backup_file_name: "Некорректное имя файла бэкапа",
};

export function describeAuthError(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? "Что-то пошло не так, попробуйте ещё раз";
  }
  return "Не удалось связаться с сервером";
}
