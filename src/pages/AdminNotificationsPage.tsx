import { Link } from "react-router-dom";
import { useAdminNotifications } from "../context/useAdminNotifications.ts";
import "./AuthPages.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU");
}

const SEVERITY_LABELS: Record<string, string> = {
  info: "Инфо",
  warning: "Внимание",
  error: "Ошибка",
};

export function AdminNotificationsPage() {
  const { notifications, unreadCount, hasMore, loadingMore, markRead, markAllRead, loadMore } =
    useAdminNotifications();

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <p className="auth-switch">
          <Link to="/">← Карта</Link>
        </p>
        <h2>Уведомления {unreadCount > 0 && `(непрочитанных: ${unreadCount})`}</h2>

        <button
          type="button"
          className="auth-submit"
          disabled={unreadCount === 0}
          onClick={() => void markAllRead()}
        >
          Отметить всё прочитанным
        </button>

        {notifications.length === 0 && <p>Уведомлений пока нет.</p>}

        {notifications.map((n) => (
          <div
            key={n.id}
            className="auth-field"
            style={{ opacity: n.readAt ? 0.6 : 1 }}
          >
            <div>
              [{SEVERITY_LABELS[n.severity] ?? n.severity}] {n.title}
            </div>
            <div style={{ fontSize: 13 }}>{formatDate(n.createdAt)}</div>
            {!n.readAt && (
              <button
                type="button"
                className="auth-submit"
                onClick={() => void markRead(n.id)}
              >
                Отметить прочитанным
              </button>
            )}
          </div>
        ))}

        {hasMore && (
          <button
            type="button"
            className="auth-submit"
            disabled={loadingMore}
            onClick={loadMore}
          >
            {loadingMore ? "Загрузка…" : "Показать ещё"}
          </button>
        )}
      </div>
    </main>
  );
}
