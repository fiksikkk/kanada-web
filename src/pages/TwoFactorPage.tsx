import { useState, type SubmitEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { verifyRecoveryCode, verifyTwoFactor } from "../api/client.ts";
import { describeAuthError } from "../api/errors.ts";
import { AuthStatus } from "../context/auth-context.ts";
import { useAuth } from "../context/useAuth.ts";
import { OfflineScreen } from "../components/OfflineScreen.tsx";
import "./AuthPages.css";

enum TwoFactorMode {
  Totp = "totp",
  Recovery = "recovery",
}

export function TwoFactorPage() {
  const navigate = useNavigate();
  const { status, refresh } = useAuth();
  const [mode, setMode] = useState<TwoFactorMode>(TwoFactorMode.Totp);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === TwoFactorMode.Totp) {
        await verifyTwoFactor(code);
      } else {
        await verifyRecoveryCode(code);
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
        <h2>{mode === TwoFactorMode.Totp ? "Код из приложения" : "Резервный код"}</h2>
        {error && <p className="auth-error">{error}</p>}
        <div className="auth-field">
          <label htmlFor="code">
            {mode === TwoFactorMode.Totp ? "6-значный код" : "Резервный код"}
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode={mode === TwoFactorMode.Totp ? "numeric" : "text"}
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
        </div>
        <button type="submit" className="auth-submit" disabled={isSubmitting}>
          Подтвердить
        </button>
        <p className="auth-switch">
          <button
            type="button"
            onClick={() => {
              setMode(
                mode === TwoFactorMode.Totp
                  ? TwoFactorMode.Recovery
                  : TwoFactorMode.Totp,
              );
              setCode("");
              setError(null);
            }}
          >
            {mode === TwoFactorMode.Totp
              ? "Использовать резервный код"
              : "Использовать код из приложения"}
          </button>
        </p>
      </form>
    </main>
  );
}
