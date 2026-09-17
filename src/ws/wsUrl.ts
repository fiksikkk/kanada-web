// Общий адрес WS-шлюза (backend/, WsGatewayService) - переиспользуется и
// живым сокетом устройств (App.tsx), и AdminNotificationsProvider.
// VITE_WS_URL - для дева, где backend и web-client на разных портах; в
// проде (за Caddy, один origin) можно оставить пустым - соберётся из
// текущего location.
export function getWsUrl(): string {
  return (
    import.meta.env.VITE_WS_URL ||
    `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
  );
}
