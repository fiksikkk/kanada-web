import { useState, type SubmitEvent } from "react";
import { Link } from "react-router-dom";
import type { AdminUser } from "../api/client.ts";
import { useAuth } from "../context/useAuth.ts";
import { useAdminUsers } from "./useAdminUsers.ts";
import "./AuthPages.css";

const ROLES: AdminUser["role"][] = ["admin", "user", "guest"];

function CreateUserForm({
  creating,
  createError,
  onCreate,
}: {
  creating: boolean;
  createError: string | null;
  onCreate: (input: {
    username: string;
    password: string;
    role: AdminUser["role"];
  }) => Promise<boolean>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("user");

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    const ok = await onCreate({ username, password, role });
    if (ok) {
      setUsername("");
      setPassword("");
      setRole("user");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-field">
      <h3>Новый пользователь</h3>
      {createError && <p className="auth-error">{createError}</p>}
      <input
        placeholder="Логин"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <input
        placeholder="Пароль (мин. 12 символов)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={12}
        required
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as AdminUser["role"])}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button type="submit" className="auth-submit" disabled={creating}>
        {creating ? "Создание…" : "Создать"}
      </button>
    </form>
  );
}

function ScopeAccessEditor({
  userId,
  scopeAccess,
  disabled,
  onSave,
}: {
  userId: number;
  scopeAccess: string[];
  disabled: boolean;
  onSave: (userId: number, scopeIds: string[]) => void;
}) {
  const [value, setValue] = useState(scopeAccess.join(", "));

  const handleSave = () => {
    const scopeIds = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onSave(userId, scopeIds);
  };

  return (
    <div>
      <label>
        Доступные зоны (id комнат/псевдозон через запятую, напр. "1, 2, street"):
        <input value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button
        type="button"
        className="auth-submit"
        disabled={disabled}
        onClick={handleSave}
      >
        Сохранить зоны
      </button>
    </div>
  );
}

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const {
    users,
    error,
    resettingId,
    resetError,
    reset,
    creating,
    createError,
    create,
    mutatingId,
    mutationError,
    updateRole,
    remove,
    setScopes,
  } = useAdminUsers();

  const handleReset = (userId: number) => {
    const isSelf = userId === currentUser?.id;
    const message = isSelf
      ? "Это ваш аккаунт — сброс отзовёт все сессии, включая текущую, и разлогинит вас. Продолжить?"
      : "Сбросить 2FA этому пользователю? Все его сессии будут завершены.";
    if (window.confirm(message)) {
      void reset(userId);
    }
  };

  const handleDelete = (userId: number, username: string) => {
    if (window.confirm(`Удалить пользователя "${username}"? Действие необратимо.`)) {
      void remove(userId);
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
        {mutationError && <p className="auth-error">{mutationError}</p>}

        <CreateUserForm creating={creating} createError={createError} onCreate={create} />

        {users?.map((user) => (
          <div key={user.id} className="auth-field">
            <div>
              {user.displayName ?? user.username} ({user.username}), 2FA:{" "}
              {user.totpEnabled ? "включена" : "выключена"}
              {!user.isActive && " — деактивирован"}
            </div>
            <select
              value={user.role}
              disabled={mutatingId === user.id}
              onChange={(e) =>
                void updateRole(
                  user.id,
                  e.target.value as AdminUser["role"],
                  user.isActive,
                )
              }
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <label>
              <input
                type="checkbox"
                checked={user.isActive}
                disabled={mutatingId === user.id}
                onChange={(e) =>
                  void updateRole(user.id, user.role, e.target.checked)
                }
              />
              активен
            </label>
            {user.role === "guest" && (
              <ScopeAccessEditor
                key={user.scopeAccess.join(",")}
                userId={user.id}
                scopeAccess={user.scopeAccess}
                disabled={mutatingId === user.id}
                onSave={(id, scopeIds) => void setScopes(id, scopeIds)}
              />
            )}
            <button
              type="button"
              className="auth-submit"
              disabled={!user.totpEnabled || resettingId === user.id}
              onClick={() => handleReset(user.id)}
            >
              {resettingId === user.id ? "Сброс…" : "Сбросить 2FA"}
            </button>
            <button
              type="button"
              className="auth-submit"
              disabled={mutatingId === user.id}
              onClick={() => handleDelete(user.id, user.username)}
            >
              Удалить
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
