import { useState, type SubmitEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { login } from "../api/client.ts";
import { describeAuthError } from "../api/errors.ts";
import { AuthStatus } from "../context/auth-context.ts";
import { useAuth } from "../context/useAuth.ts";
import { OfflineScreen } from "../components/OfflineScreen.tsx";
import "./AuthPages.css";

export function LoginPage() {
  const navigate = useNavigate();
  const { status, refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await login(username, password);
      if (result.requires2fa) {
        navigate("/login/2fa");
        return;
      }
      await refresh();
      navigate("/");
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === AuthStatus.Offline) {
    return <OfflineScreen onRetry={() => void refresh()} />;
  }
  if (status === AuthStatus.Authenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={(event) => void handleSubmit(event)}>
        <h2>Вход</h2>
        {error && <p className="auth-error">{error}</p>}
        <div className="auth-field">
          <label htmlFor="username">Логин</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </div>
        <div className="auth-field">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <button type="submit" className="auth-submit" disabled={isSubmitting}>
          Войти
        </button>
      </form>
    </main>
  );
}
