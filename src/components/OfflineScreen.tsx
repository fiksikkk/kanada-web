import "../pages/AuthPages.css";

export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="auth-screen">
      <div className="auth-card">
        <h2>Нет связи с сервером</h2>
        <p className="auth-error">
          Не удалось подключиться к серверу. Проверьте подключение и
          попробуйте снова.
        </p>
        <button type="button" className="auth-submit" onClick={onRetry}>
          Повторить
        </button>
      </div>
    </main>
  );
}
