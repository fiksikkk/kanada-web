import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { verifyRecoveryCode, verifyTwoFactor } from "../api/client.ts";
import { describeAuthError } from "../api/errors.ts";
import { useAuth } from "../context/useAuth.ts";
import { OfflineScreen } from "../components/OfflineScreen.tsx";
import "./AuthPages.css";

export function TwoFactorPage() {
  const navigate = useNavigate();
  const { status, refresh } = useAuth();
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === "totp") {
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

  if (status === "offline") {
    return <OfflineScreen onRetry={() => void refresh()} />;
  }

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={(event) => void handleSubmit(event)}>
        <h2>{mode === "totp" ? "Код из приложения" : "Резервный код"}</h2>
        {error && <p className="auth-error">{error}</p>}
        <div className="auth-field">
          <label htmlFor="code">
            {mode === "totp" ? "6-значный код" : "Резервный код"}
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode={mode === "totp" ? "numeric" : "text"}
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
              setMode(mode === "totp" ? "recovery" : "totp");
              setCode("");
              setError(null);
            }}
          >
            {mode === "totp"
              ? "Использовать резервный код"
              : "Использовать код из приложения"}
          </button>
        </p>
      </form>
    </main>
  );
}
