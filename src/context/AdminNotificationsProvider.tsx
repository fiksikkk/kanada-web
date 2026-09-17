import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  listAdminNotifications,
  markAllNotificationsRead as apiMarkAllRead,
  markNotificationRead as apiMarkRead,
  Role,
  type AdminNotification,
} from "../api/client.ts";
import { getWsUrl } from "../ws/wsUrl.ts";
import {
  AdminNotificationsContext,
  type AdminNotificationToast,
} from "./admin-notifications-context.ts";
import { AuthStatus } from "./auth-context.ts";
import { useAuth } from "./useAuth.ts";

const WS_RECONNECT_DELAY_MS = 3000;

type IncomingMessage =
  | { type: "adminNotification"; notification: AdminNotification }
  | { type: "adminNotificationRead"; id: number }
  | { type: "adminNotificationsAllRead" }
  | { type: string };

let toastSeq = 0;

// Отдельный от устройств (App.tsx, только на "/") WS-сокет - открыт весь
// сеанс админа независимо от текущей страницы, чтобы живой пуш и бейдж
// работали и на /admin/users, и на /settings, а не только на карте.
export function AdminNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { status, user } = useAuth();
  const isAdmin = status === AuthStatus.Authenticated && user?.role === Role.Admin;

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<AdminNotificationToast[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const pushToast = useCallback((toast: Omit<AdminNotificationToast, "id">) => {
    toastSeq++;
    setToasts((prev) => [...prev, { ...toast, id: String(toastSeq) }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Идемпотентно - вызывается и оптимистично (клик "прочитано" в UI), и по
  // эху того же события с WS (см. ниже), поэтому unreadCount уменьшаем
  // только если запись реально была непрочитанной на момент вызова.
  const applyRead = useCallback((id: number) => {
    setNotifications((prev) => {
      let changed = false;
      const next = prev.map((n) => {
        if (n.id === id && !n.readAt) {
          changed = true;
          return { ...n, readAt: new Date().toISOString() };
        }
        return n;
      });
      if (changed) setUnreadCount((count) => Math.max(0, count - 1));
      return next;
    });
  }, []);

  const applyAllRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);
  }, []);

  const reload = useCallback(() => {
    if (!isAdmin) return;
    listAdminNotifications()
      .then((result) => {
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
        setHasMore(result.hasMore);
      })
      .catch((err: unknown) => {
        console.error("Failed to load admin notifications", err);
      });
  }, [isAdmin]);

  // Курсор - id самого старого уже загруженного уведомления (списки всегда
  // отсортированы по id DESC, и WS-пуш только добавляет новые сверху, не
  // трогая хвост), поэтому подгрузка следующей порции не пересекается с
  // уже показанными записями.
  const loadMore = useCallback(() => {
    if (!isAdmin || loadingMore || !hasMore) return;
    const oldest = notifications[notifications.length - 1];
    if (!oldest) return;
    setLoadingMore(true);
    listAdminNotifications(oldest.id)
      .then((result) => {
        setNotifications((prev) => [...prev, ...result.notifications]);
        setHasMore(result.hasMore);
      })
      .catch((err: unknown) => {
        console.error("Failed to load more admin notifications", err);
      })
      .finally(() => setLoadingMore(false));
  }, [isAdmin, loadingMore, hasMore, notifications]);

  // Начальная загрузка - WS-пуш ниже сообщает только о НОВЫХ событиях,
  // накопленное до открытия вкладки нужно достать REST'ом. Если уже есть
  // непрочитанные - сразу тост, а не только тихое обновление бейджа.
  useEffect(() => {
    if (!isAdmin) {
      setNotifications([]);
      setUnreadCount(0);
      setHasMore(false);
      return;
    }

    let cancelled = false;
    listAdminNotifications()
      .then((result) => {
        if (cancelled) return;
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
        setHasMore(result.hasMore);
        if (result.unreadCount > 0) {
          pushToast({
            severity: "warning",
            title: `Непрочитанных уведомлений: ${result.unreadCount}`,
            link: "/admin/notifications",
          });
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load admin notifications", err);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, pushToast]);

  useEffect(() => {
    if (!isAdmin) return undefined;

    let cancelled = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onmessage = (event: MessageEvent<string>) => {
        let msg: IncomingMessage;
        try {
          msg = JSON.parse(event.data) as IncomingMessage;
        } catch {
          return;
        }

        if (msg.type === "adminNotification") {
          const { notification } = msg as { notification: AdminNotification };
          setNotifications((prev) => [notification, ...prev]);
          setUnreadCount((count) => count + 1);
          pushToast({
            severity: notification.severity,
            title: notification.title,
            link: "/admin/notifications",
          });
        } else if (msg.type === "adminNotificationRead") {
          applyRead((msg as { id: number }).id);
        } else if (msg.type === "adminNotificationsAllRead") {
          applyAllRead();
        }
      };

      ws.onerror = () => ws.close();
      ws.onclose = () => {
        if (!cancelled) {
          reconnectTimer = window.setTimeout(connect, WS_RECONNECT_DELAY_MS);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [isAdmin, pushToast, applyRead, applyAllRead]);

  const markRead = useCallback(
    async (id: number) => {
      await apiMarkRead(id);
      applyRead(id);
    },
    [applyRead],
  );

  const markAllRead = useCallback(async () => {
    await apiMarkAllRead();
    applyAllRead();
  }, [applyAllRead]);

  return (
    <AdminNotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        toasts,
        hasMore,
        loadingMore,
        reload,
        loadMore,
        markRead,
        markAllRead,
        dismissToast,
      }}
    >
      {children}
    </AdminNotificationsContext.Provider>
  );
}
