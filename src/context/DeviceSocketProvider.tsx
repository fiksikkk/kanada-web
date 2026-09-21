import type { ReactNode } from "react";
import { useDeviceSocket } from "../hooks/useDeviceSocket.ts";
import { DeviceSocketContext } from "./device-socket-context.ts";
import { AuthStatus } from "./auth-context.ts";
import { useAuth } from "./useAuth.ts";

// Один сокет на весь сеанс (устройства + сценарии), общий для App.tsx и
// страниц сценариев (ScenariosPage/ScenarioEditorPage) - раньше жил только
// внутри App.tsx, но сценариям он нужен и вне "/", поэтому поднят сюда, по
// образцу AdminNotificationsProvider. Гейт по isAuthenticated (не только
// isAdmin) - сценарии, как и сами устройства, доступны любому пользователю.
export function DeviceSocketProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const value = useDeviceSocket(status === AuthStatus.Authenticated);

  return (
    <DeviceSocketContext.Provider value={value}>
      {children}
    </DeviceSocketContext.Provider>
  );
}
