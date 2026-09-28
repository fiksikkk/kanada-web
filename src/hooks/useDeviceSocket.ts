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

export interface SceneSummary {
  number: number;
  name: string;
}

export interface SceneDeviceRecord {
  id: string;
  roomN: number;
  type: string;
  active: boolean;
  switchValue: boolean;
  brightnessValue?: number;
  positionValue?: number;
}

export type SceneDayField =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type SceneSchedule = { hour: number; minute: number } & Record<
  SceneDayField,
  boolean
>;

export interface SceneDetail {
  number: number;
  name: string;
  devices: SceneDeviceRecord[];
  schedule: SceneSchedule;
  clientRequestId?: string;
}

// Ровно тот набор полей, что и upsert-запись SceneWsBridge.js на сервере -
// поле пишется, только если оно вообще передано (undefined = "не трогать").
export interface SceneUpsertRecord {
  id: string;
  active?: boolean;
  switch?: boolean;
  brightness?: number;
  position?: number;
}

type WsMessage =
  | { type: "devices"; devices: Device[] }
  | { type: "roomStatus"; records: StatusRecord[] }
  | { type: "liveStatusPush"; record: StatusRecord }
  | { type: "iridiStatus"; connected: boolean }
  | { type: "scenes"; scenes: SceneSummary[] }
  | {
      type: "sceneDetail";
      number: number;
      name: string;
      devices: SceneDeviceRecord[];
      schedule: SceneSchedule;
      clientRequestId?: string;
    }
  | { type: "sceneDeleted"; number: number }
  | { type: "sceneSchedule"; number: number; schedule: SceneSchedule };

type OutgoingMessage =
  | { type: "getDevices" }
  | { type: "getRoomStatus"; room: number }
  | {
      type: "setDevice";
      id: string;
      field: "switch" | "brightness" | "move" | "stop" | "position";
      value: boolean | number;
    }
  | { type: "getScenes" }
  | { type: "getSceneDetail"; number: number }
  | {
      type: "saveScene";
      number: number | null;
      name: string;
      upsert: SceneUpsertRecord[];
      remove: string[];
      clientRequestId?: string;
    }
  | { type: "deleteScene"; number: number }
  | { type: "runScene"; number: number }
  | { type: "getSceneSchedule"; number: number }
  | {
      type: "setSceneSchedule";
      number: number;
      hour: number;
      minute: number;
      days: Partial<Record<SceneDayField, boolean>>;
    };

// Живое WS-соединение с устройствами и сценариями - общее для всех видов
// приложения (план этажа, список комнат, редактор сценариев), чтобы не
// открывать по сокету на каждый вид и не дублировать реконнект/optimistic-
// обновления. Инстанцируется один раз в DeviceSocketProvider - здесь только
// сама реализация. enabled=false (разлогинен) закрывает и не открывает
// сокет заново, как и isAdmin-гейт в AdminNotificationsProvider.
export function useDeviceSocket(enabled: boolean) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [statusById, setStatusById] = useState<Record<string, StatusRecord>>(
    {},
  );
  const [scenes, setScenes] = useState<SceneSummary[]>([]);
  // Последний полученный ответ sceneDetail/sceneSchedule - не кэш по
  // номерам (сценариев мало, редактор открыт с одним номером за раз),
  // просто "то, что последним прилетело" - страница-потребитель сверяет
  // number сама. Ответы приходят широковещательно всем браузерам (как и
  // остальной протокол, см. WsGatewayService.broadcastToBrowsers), не
  // только тому, кто запросил.
  const [sceneDetail, setSceneDetail] = useState<SceneDetail | null>(null);
  const [sceneSchedule, setSceneScheduleState] = useState<
    { number: number; schedule: SceneSchedule } | null
  >(null);
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
    if (!enabled) return undefined;

    let cancelled = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        ws.send(JSON.stringify({ type: "getDevices" }));
        ws.send(JSON.stringify({ type: "getScenes" }));
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
          } else if (msg.type === "scenes") {
            setScenes(msg.scenes);
          } else if (msg.type === "sceneDetail") {
            setSceneDetail({
              number: msg.number,
              name: msg.name,
              devices: msg.devices,
              schedule: msg.schedule,
              clientRequestId: msg.clientRequestId,
            });
          } else if (msg.type === "sceneDeleted") {
            setScenes((prev) => prev.filter((s) => s.number !== msg.number));
            setSceneDetail((prev) =>
              prev && prev.number === msg.number ? null : prev,
            );
          } else if (msg.type === "sceneSchedule") {
            setSceneScheduleState({ number: msg.number, schedule: msg.schedule });
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
  }, [enabled]);

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

  const requestSceneDetail = useCallback(
    (number: number) => send({ type: "getSceneDetail", number }),
    [send],
  );

  const saveScene = useCallback(
    (payload: {
      number: number | null;
      name: string;
      upsert: SceneUpsertRecord[];
      remove: string[];
      clientRequestId?: string;
    }) => send({ type: "saveScene", ...payload }),
    [send],
  );

  const deleteScene = useCallback(
    (number: number) => send({ type: "deleteScene", number }),
    [send],
  );

  const runScene = useCallback(
    (number: number) => send({ type: "runScene", number }),
    [send],
  );

  const requestSceneSchedule = useCallback(
    (number: number) => send({ type: "getSceneSchedule", number }),
    [send],
  );

  const saveSceneSchedule = useCallback(
    (payload: {
      number: number;
      hour: number;
      minute: number;
      days: Partial<Record<SceneDayField, boolean>>;
    }) => send({ type: "setSceneSchedule", ...payload }),
    [send],
  );

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
    scenes,
    sceneDetail,
    sceneSchedule,
    requestSceneDetail,
    saveScene,
    deleteScene,
    runScene,
    requestSceneSchedule,
    saveSceneSchedule,
  };
}
