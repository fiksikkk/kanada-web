import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth.ts";
import { useTotpSetup } from "./useTotpSetup.ts";
import "./AuthPages.css";

export function SettingsPage() {
  const { user } = useAuth();
  const {
    step,
    setup,
    code,
    setCode,
    recoveryCodes,
    error,
    isSubmitting,
    startSetup,
    confirmCode,
    finish,
  } = useTotpSetup();

  const handleConfirm = (event: FormEvent) => {
    event.preventDefault();
    void confirmCode();
  };

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <p className="auth-switch">
          <Link to="/">← Карта</Link>
        </p>
        <h2>Настройки безопасности</h2>
        <p>Пользователь: {user?.displayName ?? user?.username}</p>

        {step === "idle" && (
          <>
            {user?.totpEnabled ? (
              <p>Двухфакторная аутентификация включена.</p>
            ) : (
              <>
                <p>Двухфакторная аутентификация выключена.</p>
                {error && <p className="auth-error">{error}</p>}
                <button
                  type="button"
                  className="auth-submit"
                  onClick={() => void startSetup()}
                  disabled={isSubmitting}
                >
                  Включить 2FA
                </button>
              </>
            )}
          </>
        )}

        {step === "confirm" && setup && (
          <form onSubmit={handleConfirm}>
            <p>Отсканируйте QR-код в приложении-аутентификаторе:</p>
            <img
              src={setup.qrCodeDataUrl}
              alt="QR-код для настройки двухфакторной аутентификации"
              width={200}
              height={200}
            />
            <p>Или введите секрет вручную: {setup.secret}</p>
            {error && <p className="auth-error">{error}</p>}
            <div className="auth-field">
              <label htmlFor="totp-code">6-значный код</label>
              <input
                id="totp-code"
                name="totp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
            </div>
            <button type="submit" className="auth-submit" disabled={isSubmitting}>
              Подтвердить
            </button>
          </form>
        )}

        {step === "codes" && (
          <>
            <p>
              Сохраните резервные коды в надёжном месте — повторно они
              показаны не будут:
            </p>
            <pre className="auth-recovery-codes">
              {recoveryCodes.join("\n")}
            </pre>
            <button
              type="button"
              className="auth-submit"
              onClick={() => void finish()}
            >
              Готово, я сохранил(а) коды
            </button>
          </>
        )}
      </div>
    </main>
  );
}
