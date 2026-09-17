import { Link } from "react-router-dom";
import { useAdminBackups } from "./useAdminBackups.ts";
import "./AuthPages.css";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} КБ`;
  return `${(kb / 1024).toFixed(1)} МБ`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU");
}

export function AdminBackupsPage() {
  const {
    backups,
    error,
    creating,
    createError,
    create,
    restoringFile,
    restoreError,
    restore,
  } = useAdminBackups();

  const handleRestore = (file: string) => {
    if (
      window.confirm(
        `Восстановить бэкап от ${formatDate(
          backups?.find((b) => b.file === file)?.createdAt ?? "",
        )}? Текущие данные в БД будут заменены. Действие необратимо.`,
      )
    ) {
      void restore(file);
    }
  };

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <p className="auth-switch">
          <Link to="/">← Карта</Link>
        </p>
        <h2>Бэкапы БД</h2>
        {error && <p className="auth-error">{error}</p>}
        {createError && <p className="auth-error">{createError}</p>}
        {restoreError && <p className="auth-error">{restoreError}</p>}

        <button
          type="button"
          className="auth-submit"
          disabled={creating}
          onClick={() => void create()}
        >
          {creating ? "Создание…" : "Сделать бэкап сейчас"}
        </button>

        {backups?.length === 0 && <p>Бэкапов пока нет.</p>}

        {backups?.map((backup) => (
          <div key={backup.file} className="auth-field">
            <div>
              {formatDate(backup.createdAt)} — {formatSize(backup.sizeBytes)}
            </div>
            <button
              type="button"
              className="auth-submit"
              disabled={restoringFile === backup.file}
              onClick={() => handleRestore(backup.file)}
            >
              {restoringFile === backup.file ? "Восстановление…" : "Восстановить"}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
