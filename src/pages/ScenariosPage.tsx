import { Link } from "react-router-dom";
import { useDeviceSocketContext } from "../context/useDeviceSocketContext.ts";
import "./AuthPages.css";

export function ScenariosPage() {
  const { scenes, runScene, wsConnected, iridiConnected } =
    useDeviceSocketContext();
  const disabled = !wsConnected || !iridiConnected;

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <p className="auth-switch">
          <Link to="/">← Карта</Link>
        </p>
        <h2>Сценарии</h2>

        <Link to="/scenarios/new" className="auth-submit" role="button">
          + Новый сценарий
        </Link>

        {scenes.length === 0 && <p>Сценариев пока нет.</p>}

        {scenes.map((scene) => (
          <div key={scene.number} className="auth-field">
            <div>{scene.name}</div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="auth-submit"
                disabled={disabled}
                onClick={() => runScene(scene.number)}
              >
                Запустить
              </button>
              <Link
                to={`/scenarios/${scene.number}`}
                className="auth-submit"
                role="button"
              >
                Редактировать
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
