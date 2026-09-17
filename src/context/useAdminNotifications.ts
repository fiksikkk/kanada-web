import { useContext } from "react";
import {
  AdminNotificationsContext,
  type AdminNotificationsContextValue,
} from "./admin-notifications-context.ts";

export function useAdminNotifications(): AdminNotificationsContextValue {
  const ctx = useContext(AdminNotificationsContext);
  if (!ctx) {
    throw new Error(
      "useAdminNotifications must be used within an AdminNotificationsProvider",
    );
  }
  return ctx;
}
