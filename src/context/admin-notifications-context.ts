import { createContext } from "react";
import type { AdminNotification, NotificationSeverity } from "../api/client.ts";

export interface AdminNotificationToast {
  id: string;
  severity: NotificationSeverity;
  title: string;
  link?: string;
}

export interface AdminNotificationsContextValue {
  notifications: AdminNotification[];
  unreadCount: number;
  toasts: AdminNotificationToast[];
  hasMore: boolean;
  loadingMore: boolean;
  reload: () => void;
  loadMore: () => void;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismissToast: (id: string) => void;
}

export const AdminNotificationsContext =
  createContext<AdminNotificationsContextValue | null>(null);
