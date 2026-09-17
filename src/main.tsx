import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { AppRouter } from "./AppRouter.tsx";
import { AdminNotificationsProvider } from "./context/AdminNotificationsProvider.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { NotificationToastStack } from "./components/NotificationToast.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AdminNotificationsProvider>
            <AppRouter />
            <NotificationToastStack />
          </AdminNotificationsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
