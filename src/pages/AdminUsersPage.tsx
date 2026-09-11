import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth.ts";
import { useAdminUsers } from "./useAdminUsers.ts";
import "./AuthPages.css";

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { users, error, resettingId, resetError, reset } = useAdminUsers();

  const handleReset = (userId: number) => {
    const isSelf = userId === currentUser?.id;
    const message = isSelf
      ? "Это ваш аккаунт — сброс отзовёт все сессии, включая текущую, и разлогинит вас. Продолжить?"
      : "Сбросить 2FA этому пользователю? Все его сессии будут завершены.";
    if (window.confirm(message)) {
      void reset(userId);
    }
  };

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <p className="auth-switch">
          <Link to="/">← Карта</Link>
        </p>
        <h2>Пользователи</h2>
        {error && <p className="auth-error">{error}</p>}
        {resetError && <p className="auth-error">{resetError}</p>}
        {users?.map((user) => (
          <div key={user.id} className="auth-field">
            <div>
              {user.displayName ?? user.username} ({user.username}),{" "}
              {user.role}, 2FA: {user.totpEnabled ? "включена" : "выключена"}
            </div>
            <button
              type="button"
              className="auth-submit"
              disabled={!user.totpEnabled || resettingId === user.id}
              onClick={() => handleReset(user.id)}
            >
              {resettingId === user.id ? "Сброс…" : "Сбросить 2FA"}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
