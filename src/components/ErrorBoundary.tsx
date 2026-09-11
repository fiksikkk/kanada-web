import { Component, type ErrorInfo, type ReactNode } from "react";
import "../pages/AuthPages.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="auth-screen">
          <div className="auth-card">
            <h2>Что-то пошло не так</h2>
            <p className="auth-error">
              Приложение столкнулось с ошибкой. Попробуйте обновить страницу.
            </p>
            <button
              type="button"
              className="auth-submit"
              onClick={() => window.location.reload()}
            >
              Обновить страницу
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
