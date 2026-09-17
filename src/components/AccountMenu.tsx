import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Role } from "../api/client.ts";
import { useAdminNotifications } from "../context/useAdminNotifications.ts";
import { useAuth } from "../context/useAuth.ts";

export function AccountMenu() {
  const { user, logout } = useAuth();
  const { unreadCount } = useAdminNotifications();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-button"
        onClick={() => setOpen((prev) => !prev)}
      >
        {user?.displayName?.[0]?.toUpperCase() ??
          user?.username?.[0]?.toUpperCase() ??
          "?"}
        {user?.role === Role.Admin && unreadCount > 0 && (
          <span className="account-badge">{unreadCount}</span>
        )}
      </button>
      {open && (
        <div className="account-dropdown">
          <div className="account-name">
            {user?.displayName ?? user?.username}
          </div>
          <Link
            to="/settings"
            className="account-menu-item"
            onClick={() => setOpen(false)}
          >
            Настройки безопасности
          </Link>
          {user?.role === Role.Admin && (
            <Link
              to="/admin/users"
              className="account-menu-item"
              onClick={() => setOpen(false)}
            >
              Администрирование
            </Link>
          )}
          {user?.role === Role.Admin && (
            <Link
              to="/admin/backups"
              className="account-menu-item"
              onClick={() => setOpen(false)}
            >
              Бэкапы БД
            </Link>
          )}
          {user?.role === Role.Admin && (
            <Link
              to="/admin/notifications"
              className="account-menu-item"
              onClick={() => setOpen(false)}
            >
              Уведомления{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </Link>
          )}
          <button
            type="button"
            className="account-menu-item"
            onClick={() => void logout()}
          >
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}
