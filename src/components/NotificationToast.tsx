import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminNotifications } from "../context/useAdminNotifications.ts";
import type { AdminNotificationToast } from "../context/admin-notifications-context.ts";
import "./NotificationToast.css";

const TOAST_DURATION_MS = 6000;

function Toast({
  toast,
  onDismiss,
}: {
  toast: AdminNotificationToast;
  onDismiss: (id: string) => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const handleClick = () => {
    if (toast.link) navigate(toast.link);
    onDismiss(toast.id);
  };

  return (
    <div
      className={`notification-toast notification-toast-${toast.severity}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <span>{toast.title}</span>
      <button
        type="button"
        className="notification-toast-close"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        aria-label="Закрыть"
      >
        ×
      </button>
    </div>
  );
}

// Рендерится один раз в корне (main.tsx), поверх любой страницы - тосты не
// привязаны к конкретному маршруту.
export function NotificationToastStack() {
  const { toasts, dismissToast } = useAdminNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="notification-toast-stack">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
