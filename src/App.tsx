import { useEffect, useRef, useState } from "react";
import "./App.css";
import planImage from "./assets/floor-plan.png";
import { AccountMenu } from "./components/AccountMenu.tsx";

// Раньше указывал прямо на тестовый мост iRidium-сервера
// (ws://10.10.10.172:8090) - теперь ходит через auth-шлюз (backend/),
// который сам проверяет сессию/Origin на апгрейде и релеит сообщения
// туда (см. WsGatewayService). VITE_WS_URL - для дева, где backend и
// web-client на разных портах; в проде (за Caddy, один origin) можно
// оставить пустым - соберётся из текущего location.
const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

interface Hotspot {
  roomN: number;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

// Картинка - 761x1013 (см. PLAN_IMAGE_RATIO в App.css). Координаты
// подобраны на глаз по floor-plan.png - только roomN:1 (Гостиная)
// привязан к реальной комнате в тестовой БД (seed_test.sql,
// room_number=1, fixture "Тест Дали"), остальные пока открывают пустую
// панель (в БД для них нет фикстур) - это уже разметка под реальные
// комнаты плана, но данные под них ещё не заведены.
const ROOM_HOTSPOTS: Hotspot[] = [
  { roomN: 1, label: "Гостиная", left: 47, top: 19, width: 29, height: 32 },
  { roomN: 2, label: "Столовая", left: 76, top: 19, width: 17, height: 35.5 },
  { roomN: 3, label: "Кухня", left: 11, top: 19, width: 36, height: 32 },
  { roomN: 4, label: "Терраса", left: 12.5, top: 4, width: 33, height: 15 },
  { roomN: 5, label: "Холл", left: 42, top: 51, width: 32.5, height: 23 },
  { roomN: 6, label: "Кабинет", left: 19, top: 67, width: 30, height: 25 },
  { roomN: 7, label: "Постирночная", left: 15, top: 56, width: 27, height: 11 },
  { roomN: 8, label: "Прихожая", left: 49, top: 74, width: 25.5, height: 9 },
  {
    roomN: 9,
    label: "Санузел",
    left: 74.5,
    top: 54.5,
    width: 19,
    height: 10.5,
  },
  {
    roomN: 10,
    label: "Гостевая спальня",
    left: 74.5,
    top: 65,
    width: 19,
    height: 18,
  },
  {
    roomN: 11,
    label: "Гардеробная",
    left: 69,
    top: 83,
    width: 12,
    height: 9,
  },
  {
    roomN: 12,
    label: "Санузел",
    left: 81,
    top: 83,
    width: 12,
    height: 14,
  },
];

const IMAGE_WIDTH = 761;
const IMAGE_HEIGHT = 1013;
const ROOM_ZOOM_SCALE = 1.6;
const MIN_SCALE = 0.5;
const MAX_SCALE = 6;
const DRAG_THRESHOLD_PX = 4;

interface FitSize {
  width: number;
  height: number;
}

interface Camera {
  x: number;
  y: number;
  scale: number;
}

interface Fixture {
  id: string;
  roomN: number;
  name: string;
  type: string;
}

interface StatusRecord {
  id: string;
  s?: number;
  b?: number;
  p?: number;
}

type WsMessage =
  | { type: "fixtures"; fixtures: Fixture[] }
  | { type: "roomStatus"; records: StatusRecord[] }
  | { type: "liveStatusPush"; record: StatusRecord }
  | { type: "iridiStatus"; connected: boolean };

type OutgoingMessage =
  | { type: "getFixtures" }
  | { type: "getRoomStatus"; room: number }
  | {
      type: "setDevice";
      id: string;
      field: "switch" | "brightness" | "move" | "stop" | "position";
      value: boolean | number;
    };

interface Point {
  x: number;
  y: number;
}

type Gesture =
  | {
      mode: "pan";
      startCamera: Camera;
      startX: number;
      startY: number;
      moved: boolean;
      roomN?: string | null;
    }
  | {
      mode: "pinch";
      startDist: number;
      startScale: number;
      contentX: number;
      contentY: number;
      moved: boolean;
    };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

// Размер "вписанной" картинки считаем в JS пикселями, а не CSS
// aspect-ratio внутри flex - на телефоне (мобильный Safari/Chrome) это
// сочетание не всегда корректно выводит высоту из ширины, картинку
// растягивало. Пиксели однозначны в любом браузере.
function computeFitSize(
  containerWidth: number,
  containerHeight: number,
): FitSize {
  if (!containerWidth || !containerHeight) return { width: 0, height: 0 };
  const containerRatio = containerWidth / containerHeight;
  const imageRatio = IMAGE_WIDTH / IMAGE_HEIGHT;
  if (containerRatio > imageRatio) {
    return { width: containerHeight * imageRatio, height: containerHeight };
  }
  return { width: containerWidth, height: containerWidth / imageRatio };
}

function App() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [openRoomN, setOpenRoomN] = useState<number | null>(null);
  const [statusById, setStatusById] = useState<Record<string, StatusRecord>>(
    {},
  );
  // Единая "камера": transform-origin всегда в углу (0,0), transform
  // всегда `translate(x,y) scale(scale)` - это стандартная схема для
  // pan/zoom (drag, pinch, колесо), где нет неоднозначности с порядком
  // функций, а зум-к-точке считается одной и той же формулой везде
  // (клик по комнате, колесо, пинч).
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [isInteracting, setIsInteracting] = useState(false);
  const [fitSize, setFitSize] = useState<FitSize>({ width: 0, height: 0 });
  const [wsConnected, setWsConnected] = useState(false);
  // Соединение браузер<->Node может быть открыто, а сам Node при этом не
  // достучаться до iRidium (см. WsGatewayService/broadcastIridiStatus) -
  // отдельный флаг, чтобы не путать эти два разных "не работает".
  const [iridiConnected, setIridiConnected] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const activePointers = useRef(new Map<number, Point>());
  const gestureRef = useRef<Gesture | null>(null);
  const wheelIdleTimerRef = useRef<number | undefined>(undefined);

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
        ws.send(JSON.stringify({ type: "getFixtures" }));
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(event.data) as WsMessage;
          if (msg.type === "fixtures") {
            setFixtures(msg.fixtures);
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

  // Пересчёт "вписанного" размера картинки по реальным пикселям
  // контейнера - ResizeObserver ловит и resize окна, и поворот экрана на
  // телефоне.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;

    const update = () => {
      setFitSize(computeFitSize(el.clientWidth, el.clientHeight));
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Колесо мыши - preventDefault нужен, чтобы страница не скроллилась
  // вместе с зумом, а React вешает onWheel как passive по умолчанию (в
  // passive-режиме preventDefault тихо игнорируется) - поэтому слушатель
  // навешен вручную через addEventListener с passive:false.
  useEffect(() => {
    const el = sizerRef.current;
    if (!el) return undefined;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;

      setCamera((prev) => {
        const contentX = (mx - prev.x) / prev.scale;
        const contentY = (my - prev.y) / prev.scale;
        const zoomFactor = Math.exp(-event.deltaY * 0.001);
        const newScale = clamp(prev.scale * zoomFactor, MIN_SCALE, MAX_SCALE);
        return {
          scale: newScale,
          x: mx - contentX * newScale,
          y: my - contentY * newScale,
        };
      });

      setIsInteracting(true);
      window.clearTimeout(wheelIdleTimerRef.current);
      wheelIdleTimerRef.current = window.setTimeout(
        () => setIsInteracting(false),
        200,
      );
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const send = (payload: OutgoingMessage) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify(payload));
  };

  const openRoom = (roomN: number) => {
    setIsInteracting(false);
    if (openRoomN === roomN) {
      setOpenRoomN(null);
      setCamera({ x: 0, y: 0, scale: 1 });
      return;
    }
    const hotspot = ROOM_HOTSPOTS.find((h) => h.roomN === roomN);
    if (hotspot && sizerRef.current) {
      const rect = sizerRef.current.getBoundingClientRect();
      const localX = ((hotspot.left + hotspot.width / 2) / 100) * rect.width;
      const localY = ((hotspot.top + hotspot.height / 2) / 100) * rect.height;
      setCamera({
        scale: ROOM_ZOOM_SCALE,
        x: rect.width / 2 - localX * ROOM_ZOOM_SCALE,
        y: rect.height / 2 - localY * ROOM_ZOOM_SCALE,
      });
    }
    setOpenRoomN(roomN);
    send({ type: "getRoomStatus", room: roomN });
  };

  const closeRoom = () => {
    setIsInteracting(false);
    setOpenRoomN(null);
    setCamera({ x: 0, y: 0, scale: 1 });
  };

  // Драг (мышь/палец) и пинч-зум (два пальца) - через Pointer Events,
  // единый API для мыши/тача/пера. Активные указатели храним в Map по
  // pointerId; когда их 2 - это пинч (масштаб по расстоянию между ними,
  // сдвиг - той же формулой "зум к точке", что и у колеса, только точка
  // - середина между пальцами).
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    setIsInteracting(true);

    if (activePointers.current.size === 1) {
      gestureRef.current = {
        mode: "pan",
        startCamera: camera,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        // Комната, на которую нажали - если отпустим палец/кнопку мыши
        // без движения (см. endGesture), это тап, открываем её. Клик
        // через нативный onClick на кнопке ненадёжен вместе с
        // setPointerCapture, поэтому решаем "тап это или драг" сами.
        roomN:
          (event.target as HTMLElement).closest<HTMLElement>("[data-room]")
            ?.dataset.room ?? null,
      };
    } else if (activePointers.current.size === 2) {
      const points = [...activePointers.current.values()];
      const [p0, p1] = points as [Point, Point];
      const dist = Math.hypot(p0.x - p1.x, p0.y - p1.y);
      const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      const rect = sizerRef.current!.getBoundingClientRect();
      gestureRef.current = {
        mode: "pinch",
        startDist: dist,
        startScale: camera.scale,
        contentX: (mid.x - rect.left - camera.x) / camera.scale,
        contentY: (mid.y - rect.top - camera.y) / camera.scale,
        moved: false,
      };
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(event.pointerId)) return;
    activePointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.mode === "pan" && activePointers.current.size === 1) {
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      if (
        Math.abs(dx) > DRAG_THRESHOLD_PX ||
        Math.abs(dy) > DRAG_THRESHOLD_PX
      ) {
        gesture.moved = true;
      }
      setCamera({
        ...gesture.startCamera,
        x: gesture.startCamera.x + dx,
        y: gesture.startCamera.y + dy,
      });
    } else if (gesture.mode === "pinch" && activePointers.current.size === 2) {
      const points = [...activePointers.current.values()];
      const [p0, p1] = points as [Point, Point];
      const dist = Math.hypot(p0.x - p1.x, p0.y - p1.y);
      const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      const rect = sizerRef.current!.getBoundingClientRect();
      const newScale = clamp(
        gesture.startScale * (dist / gesture.startDist),
        MIN_SCALE,
        MAX_SCALE,
      );
      gesture.moved = true;
      setCamera({
        scale: newScale,
        x: mid.x - rect.left - gesture.contentX * newScale,
        y: mid.y - rect.top - gesture.contentY * newScale,
      });
    }
  };

  const endGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(event.pointerId);

    if (activePointers.current.size === 0) {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      setIsInteracting(false);
      if (
        gesture &&
        gesture.mode === "pan" &&
        !gesture.moved &&
        gesture.roomN
      ) {
        openRoom(Number(gesture.roomN));
      }
    } else if (activePointers.current.size === 1) {
      // Отпустили один из двух пальцев во время пинча - продолжаем как
      // обычный драг оставшимся пальцем, от текущей камеры.
      const [remaining] = [...activePointers.current.values()] as [Point];
      gestureRef.current = {
        mode: "pan",
        startCamera: camera,
        startX: remaining.x,
        startY: remaining.y,
        moved: true,
      };
    }
  };

  // Optimistic-обновление: тумблер/слайдер должны отозваться сразу по
  // клику, не дожидаясь liveStatusPush с реальной шины (которого может не
  // быть вовсе, если провод ещё не подключен, либо он просто медленнее
  // тапа пальцем). Реальный фидбек, когда придёт, всё равно перезапишет
  // это значение как авторитетное (см. ws.onmessage) - здесь это просто
  // "предположение, что команда сработает".
  const toggleSwitch = (fixtureId: string) => {
    const current = statusById[fixtureId];
    const nextS = current?.s ? 0 : 1;
    setStatusById((prev) => ({
      ...prev,
      [fixtureId]: { ...prev[fixtureId], id: fixtureId, s: nextS },
    }));
    send({
      type: "setDevice",
      id: fixtureId,
      field: "switch",
      value: Boolean(nextS),
    });
  };

  const setBrightness = (fixtureId: string, value: number) => {
    setStatusById((prev) => ({
      ...prev,
      [fixtureId]: { ...prev[fixtureId], id: fixtureId, b: value },
    }));
    send({ type: "setDevice", id: fixtureId, field: "brightness", value });
  };

  // move: 0 - открыть (Up), 1 - закрыть (Down) - см. KnxApplyLiveCommand на
  // стороне iRidium. Без optimistic-обновления - в отличие от тумблера/
  // слайдера, у шторы нет мгновенного целевого состояния, реальную позицию
  // отдаст liveStatusPush по мере движения мотора.
  const moveShutter = (fixtureId: string, direction: 0 | 1) => {
    send({ type: "setDevice", id: fixtureId, field: "move", value: direction });
  };

  const stopShutter = (fixtureId: string) => {
    send({ type: "setDevice", id: fixtureId, field: "stop", value: 1 });
  };

  const setShutterPosition = (fixtureId: string, value: number) => {
    setStatusById((prev) => ({
      ...prev,
      [fixtureId]: { ...prev[fixtureId], id: fixtureId, p: value },
    }));
    send({ type: "setDevice", id: fixtureId, field: "position", value });
  };

  const openHotspot = ROOM_HOTSPOTS.find(
    (hotspot) => hotspot.roomN === openRoomN,
  );
  const displayFixtures = fixtures.filter(
    (fixture) => fixture.roomN === openRoomN,
  );

  const cameraStyle = {
    transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
    transition: isInteracting ? "none" : "transform 0.4s ease",
  };

  return (
    <main className="app">
      <AccountMenu />
      {!wsConnected && (
        <div className="ws-banner">Нет соединения — переподключение…</div>
      )}
      {wsConnected && !iridiConnected && (
        <div className="ws-banner">Нет подключения к iRidium серверу</div>
      )}
      <div
        className="map-backdrop"
        style={{ backgroundImage: `url(${planImage})` }}
      />
      <div className="map-viewport" ref={viewportRef}>
        <div
          className="map-sizer"
          ref={sizerRef}
          style={{ width: fitSize.width, height: fitSize.height }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
        >
          <div className="map-camera" style={cameraStyle}>
            <img
              src={planImage}
              alt="План дома"
              className="map-image"
              draggable={false}
            />
            {ROOM_HOTSPOTS.map((hotspot) => (
              <button
                key={hotspot.roomN}
                type="button"
                className="room-hotspot"
                data-room={hotspot.roomN}
                style={{
                  left: `${hotspot.left}%`,
                  top: `${hotspot.top}%`,
                  width: `${hotspot.width}%`,
                  height: `${hotspot.height}%`,
                }}
              >
                {hotspot.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <aside className={`room-panel${openRoomN !== null ? " open" : ""}`}>
        <button
          type="button"
          className="room-panel-close"
          onClick={closeRoom}
          aria-label="Закрыть"
        >
          ×
        </button>
        <h2 className="room-panel-title">{openHotspot?.label}</h2>
        {displayFixtures.map((fixture) => {
          const fixtureStatus = statusById[fixture.id] ?? {};
          const isShutter = fixture.type === "shutter";
          const isOn = Boolean(fixtureStatus.s);
          const brightness = fixtureStatus.b ?? 0;
          const position = fixtureStatus.p ?? 0;
          // Блокируем при разрыве любого из двух соединений (браузер<->Node
          // или Node<->iRidium), чтобы не создавать иллюзию рабочего
          // тумблера, команда от которого никуда не долетит (см. send()).
          const isDisabled = !wsConnected || !iridiConnected;
          const handleToggle = () => toggleSwitch(fixture.id);
          const handleBrightnessChange = (value: number) =>
            setBrightness(fixture.id, value);
          const handlePositionChange = (value: number) =>
            setShutterPosition(fixture.id, value);
          return (
            <div key={fixture.id} className="fixture-card">
              <div className="fixture-header">
                {isShutter ? (
                  <svg
                    className={`fixture-icon${position > 0 ? " on" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="4"
                      y="4"
                      width="16"
                      height="16"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M4 8h16M4 12h16M4 16h16"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                ) : (
                  <svg
                    className={`fixture-icon${isOn ? " on" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.5.4.6.9.6 1.5V16h6v-.7c0-.6.1-1.1.6-1.5A6 6 0 0 0 12 3Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill={isOn ? "currentColor" : "none"}
                      fillOpacity={isOn ? 0.18 : 0}
                    />
                  </svg>
                )}
                <span className="fixture-name">{fixture.name}</span>
                {!isShutter && (
                  <button
                    type="button"
                    className={`toggle-switch${isOn ? " on" : ""}`}
                    onClick={handleToggle}
                    disabled={isDisabled}
                    role="switch"
                    aria-checked={isOn}
                    aria-label={fixture.name}
                  >
                    <span className="toggle-knob" />
                  </button>
                )}
              </div>
              {fixture.type === "dimmer" && (
                <div className="brightness-row">
                  <input
                    type="range"
                    className="brightness-slider"
                    style={{ "--fill": `${brightness}%` } as React.CSSProperties}
                    min={0}
                    max={100}
                    value={brightness}
                    onChange={(event) =>
                      handleBrightnessChange(Number(event.target.value))
                    }
                    disabled={isDisabled}
                  />
                  <span className="brightness-value">{brightness}%</span>
                </div>
              )}
              {isShutter && (
                <div className="shutter-controls">
                  <div className="shutter-buttons">
                    <button
                      type="button"
                      className="shutter-btn"
                      onClick={() => moveShutter(fixture.id, 0)}
                      disabled={isDisabled}
                      aria-label="Открыть"
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M12 19V5M6 11l6-6 6 6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="shutter-btn"
                      onClick={() => stopShutter(fixture.id)}
                      disabled={isDisabled}
                      aria-label="Стоп"
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect
                          x="7"
                          y="7"
                          width="10"
                          height="10"
                          rx="1"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="shutter-btn"
                      onClick={() => moveShutter(fixture.id, 1)}
                      disabled={isDisabled}
                      aria-label="Закрыть"
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M12 5v14M6 13l6 6 6-6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="brightness-row">
                    <input
                      type="range"
                      className="brightness-slider"
                      style={
                        { "--fill": `${position}%` } as React.CSSProperties
                      }
                      min={0}
                      max={100}
                      value={position}
                      onChange={(event) =>
                        handlePositionChange(Number(event.target.value))
                      }
                      disabled={isDisabled}
                    />
                    <span className="brightness-value">{position}%</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </aside>
    </main>
  );
}

export default App;
