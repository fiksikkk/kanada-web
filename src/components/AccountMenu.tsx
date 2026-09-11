import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth.ts";

export function AccountMenu() {
  const { user, logout } = useAuth();
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
