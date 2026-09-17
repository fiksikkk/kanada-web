import { useCallback, useEffect, useRef, useState } from "react";
import { getWsUrl } from "../ws/wsUrl.ts";

const WS_URL = getWsUrl();

export interface Device {
  id: string;
  roomN: number;
  name: string;
  type: string;
}

export interface StatusRecord {
  id: string;
  s?: number;
  b?: number;
  p?: number;
}

type WsMessage =
  | { type: "devices"; devices: Device[] }
  | { type: "roomStatus"; records: StatusRecord[] }
  | { type: "liveStatusPush"; record: StatusRecord }
  | { type: "iridiStatus"; connected: boolean };

type OutgoingMessage =
  | { type: "getDevices" }
  | { type: "getRoomStatus"; room: number }
  | {
      type: "setDevice";
      id: string;
      field: "switch" | "brightness" | "move" | "stop" | "position";
      value: boolean | number;
    };

// Живое WS-соединение с устройствами - общее для всех видов приложения
// (план этажа, список комнат), чтобы не открывать по сокету на каждый вид
// и не дублировать реконнект/optimistic-обновления.
export function useDeviceSocket() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [statusById, setStatusById] = useState<Record<string, StatusRecord>>(
    {},
  );
  const [wsConnected, setWsConnected] = useState(false);
  // Соединение браузер<->Node может быть открыто, а сам Node при этом не
  // достучаться до iRidium (см. WsGatewayService/broadcastIridiStatus) -
  // отдельный флаг, чтобы не путать эти два разных "не работает".
  const [iridiConnected, setIridiConnected] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // Реконнект с фиксированной паузой (без бэкоффа - это локальная сеть
  // умного дома, а не публичный интернет, где нужно щадить сервер) -
  // onclose планирует новый connect(), onerror просто закрывает сокет и
  // даёт onclose разрулить переподключение (одна точка реконнекта вместо
  // дублирования логики в обоих обработчиках).
  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        ws.send(JSON.stringify({ type: "getDevices" }));
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(event.data) as WsMessage;
          if (msg.type === "devices") {
            setDevices(msg.devices);
          } else if (msg.type === "roomStatus") {
            setStatusById((prev) => {
              const next = { ...prev };
              for (const record of msg.records) {
                next[record.id] = record;
              }
              return next;
            });
          } else if (msg.type === "liveStatusPush") {
            setStatusById((prev) => ({
              ...prev,
              [msg.record.id]: { ...prev[msg.record.id], ...msg.record },
            }));
          } else if (msg.type === "iridiStatus") {
            setIridiConnected(msg.connected);
          }
        } catch (err) {
          console.error("Bad WS message", err);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!cancelled) {
          reconnectTimer = window.setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((payload: OutgoingMessage) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify(payload));
  }, []);

  // Стабильная ссылка (не зависит от стейта) - используется как зависимость
  // эффекта "запросить статус при смене выбранной комнаты" в App.tsx.
  const requestRoomStatus = useCallback(
    (roomN: number) => send({ type: "getRoomStatus", room: roomN }),
    [send],
  );

  // Optimistic-обновление: тумблер/слайдер должны отозваться сразу по
  // клику, не дожидаясь liveStatusPush с реальной шины (которого может не
  // быть вовсе, если провод ещё не подключен, либо он просто медленнее
  // тапа пальцем). Реальный фидбек, когда придёт, всё равно перезапишет
  // это значение как авторитетное (см. ws.onmessage) - здесь это просто
  // "предположение, что команда сработает".
  const toggleSwitch = (deviceId: string) => {
    const current = statusById[deviceId];
    const nextS = current?.s ? 0 : 1;
    setStatusById((prev) => ({
      ...prev,
      [deviceId]: { ...prev[deviceId], id: deviceId, s: nextS },
    }));
    send({
      type: "setDevice",
      id: deviceId,
      field: "switch",
      value: Boolean(nextS),
    });
  };

  // Слайдер обновляет локальное состояние на каждый тик драга (плавный
  // визуал), но setDevice шлём только по отпусканию/клавише - как в
  // иридиум-панели. Иначе на драге летит сообщение на каждый pixel move,
  // а с несколькими браузерами на одном слайдере это ещё и дёргает чужой
  // ползунок посреди чужого драга.
  const previewBrightness = (deviceId: string, value: number) => {
    setStatusById((prev) => ({
      ...prev,
      [deviceId]: { ...prev[deviceId], id: deviceId, b: value },
    }));
  };

  const commitBrightness = (deviceId: string, value: number) => {
    send({ type: "setDevice", id: deviceId, field: "brightness", value });
  };

  // move: 0 - открыть (Up), 1 - закрыть (Down) - см. KnxApplyLiveCommand на
  // стороне iRidium. Без optimistic-обновления - в отличие от тумблера/
  // слайдера, у шторы нет мгновенного целевого состояния, реальную позицию
  // отдаст liveStatusPush по мере движения мотора.
  const moveShutter = (deviceId: string, direction: 0 | 1) => {
    send({ type: "setDevice", id: deviceId, field: "move", value: direction });
  };

  const stopShutter = (deviceId: string) => {
    send({ type: "setDevice", id: deviceId, field: "stop", value: 1 });
  };

  const previewShutterPosition = (deviceId: string, value: number) => {
    setStatusById((prev) => ({
      ...prev,
      [deviceId]: { ...prev[deviceId], id: deviceId, p: value },
    }));
  };

  const commitShutterPosition = (deviceId: string, value: number) => {
    send({ type: "setDevice", id: deviceId, field: "position", value });
  };

  return {
    devices,
    statusById,
    wsConnected,
    iridiConnected,
    requestRoomStatus,
    toggleSwitch,
    previewBrightness,
    commitBrightness,
    moveShutter,
    stopShutter,
    previewShutterPosition,
    commitShutterPosition,
  };
}
