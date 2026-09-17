import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./App.css";
import planImage from "./assets/floor-plan.png";
import { AccountMenu } from "./components/AccountMenu.tsx";
import { DeviceCard } from "./components/DeviceCard.tsx";
import { RoomMenu } from "./components/RoomMenu.tsx";
import { ROOM_HOTSPOTS } from "./rooms.ts";
import { useDeviceSocket } from "./hooks/useDeviceSocket.ts";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode: "plan" | "list" =
    searchParams.get("view") === "list" ? "list" : "plan";
  const openRoomN = (() => {
    const raw = searchParams.get("room");
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  })();

  // Выбранная комната и вид (план/список) живут в query-параметрах, а не в
  // локальном стейте - чтобы при переключении вида справа оставалась та же
  // комната, и чтобы можно было открыть ссылку сразу в нужном состоянии
  // (?view=list&room=5).
  const setRoom = (roomN: number | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (roomN === null) next.delete("room");
        else next.set("room", String(roomN));
        return next;
      },
      { replace: true },
    );
  };

  const setView = (mode: "plan" | "list") => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (mode === "plan") next.delete("view");
        else next.set("view", mode);
        return next;
      },
      { replace: true },
    );
  };

  const {
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
  } = useDeviceSocket();

  // Единая "камера": transform-origin всегда в углу (0,0), transform
  // всегда `translate(x,y) scale(scale)` - это стандартная схема для
  // pan/zoom (drag, pinch, колесо), где нет неоднозначности с порядком
  // функций, а зум-к-точке считается одной и той же формулой везде
  // (клик по комнате, колесо, пинч).
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [isInteracting, setIsInteracting] = useState(false);
  const [fitSize, setFitSize] = useState<FitSize>({ width: 0, height: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const activePointers = useRef(new Map<number, Point>());
  const gestureRef = useRef<Gesture | null>(null);
  const wheelIdleTimerRef = useRef<number | undefined>(undefined);

  // Запрашиваем статус устройств выбранной комнаты при любой смене
  // выбора - по клику на плане, по клику в списке или сразу при заходе по
  // ссылке с ?room=.
  useEffect(() => {
    if (openRoomN !== null) requestRoomStatus(openRoomN);
  }, [openRoomN, requestRoomStatus]);

  // Пересчёт "вписанного" размера картинки по реальным пикселям
  // контейнера - ResizeObserver ловит и resize окна, и поворот экрана на
  // телефоне. Завязано на viewMode: план монтируется/размонтируется при
  // переключении видов, а без этой зависимости эффект остался бы
  // навсегда привязан к самому первому DOM-узлу. У отсоединённого узла
  // ResizeObserver репортит размер 0 - без guard'а на clientWidth/Height
  // это тихо зануляло бы fitSize при уходе с плана, и он оставался бы
  // нулевым навсегда (сам эффект больше не перезапускается).
  useEffect(() => {
    if (viewMode !== "plan") return undefined;
    const el = viewportRef.current;
    if (!el) return undefined;

    const update = () => {
      if (!el.clientWidth || !el.clientHeight) return;
      setFitSize(computeFitSize(el.clientWidth, el.clientHeight));
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewMode]);

  // Колесо мыши - preventDefault нужен, чтобы страница не скроллилась
  // вместе с зумом, а React вешает onWheel как passive по умолчанию (в
  // passive-режиме preventDefault тихо игнорируется) - поэтому слушатель
  // навешен вручную через addEventListener с passive:false. Тоже завязан
  // на viewMode - иначе после возврата на план слушатель остаётся висеть
  // на уже отсоединённом узле предыдущего монтирования.
  useEffect(() => {
    if (viewMode !== "plan") return undefined;
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
  }, [viewMode]);

  // Камера следует за выбранной комнатой, а не только за кликом по
  // хотспоту - иначе при выборе комнаты в списке и возврате на план
  // камера оставалась бы там, где её оставили в прошлый раз (не на
  // самой комнате). Ждём реальных размеров sizer'а (fitSize), иначе
  // расчёт зума получится по ещё нулевому прямоугольнику.
  useEffect(() => {
    if (viewMode !== "plan" || !fitSize.width || !fitSize.height) return;
    if (openRoomN === null) {
      setCamera({ x: 0, y: 0, scale: 1 });
      return;
    }
    const hotspot = ROOM_HOTSPOTS.find((h) => h.roomN === openRoomN);
    if (!hotspot || !sizerRef.current) return;
    const rect = sizerRef.current.getBoundingClientRect();
    const localX = ((hotspot.left + hotspot.width / 2) / 100) * rect.width;
    const localY = ((hotspot.top + hotspot.height / 2) / 100) * rect.height;
    setCamera({
      scale: ROOM_ZOOM_SCALE,
      x: rect.width / 2 - localX * ROOM_ZOOM_SCALE,
      y: rect.height / 2 - localY * ROOM_ZOOM_SCALE,
    });
  }, [viewMode, openRoomN, fitSize.width, fitSize.height]);

  const openRoom = (roomN: number) => {
    setIsInteracting(false);
    setRoom(openRoomN === roomN ? null : roomN);
  };

  const closeRoom = () => {
    setIsInteracting(false);
    setRoom(null);
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

  const openHotspot = ROOM_HOTSPOTS.find(
    (hotspot) => hotspot.roomN === openRoomN,
  );
  const displayDevices = devices.filter(
    (device) => device.roomN === openRoomN,
  );
  // Блокируем управление при разрыве любого из двух соединений
  // (браузер<->Node или Node<->iRidium), чтобы не создавать иллюзию
  // рабочего тумблера, команда от которого никуда не долетит.
  const isDisabled = !wsConnected || !iridiConnected;

  const cameraStyle = {
    transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
    transition: isInteracting ? "none" : "transform 0.4s ease",
  };

  return (
    <main className="app">
      <AccountMenu />
      <div className="view-toggle">
        <button
          type="button"
          className={`view-toggle-btn${viewMode === "plan" ? " active" : ""}`}
          onClick={() => setView("plan")}
        >
          План
        </button>
        <button
          type="button"
          className={`view-toggle-btn${viewMode === "list" ? " active" : ""}`}
          onClick={() => setView("list")}
        >
          Список
        </button>
      </div>
      {!wsConnected && (
        <div className="ws-banner">Нет соединения — переподключение…</div>
      )}
      {wsConnected && !iridiConnected && (
        <div className="ws-banner">Нет подключения к iRidium серверу</div>
      )}

      {viewMode === "plan" ? (
        <>
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
            {displayDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                status={statusById[device.id] ?? { id: device.id }}
                disabled={isDisabled}
                onToggle={toggleSwitch}
                onBrightnessPreview={previewBrightness}
                onBrightnessCommit={commitBrightness}
                onPositionPreview={previewShutterPosition}
                onPositionCommit={commitShutterPosition}
                onMove={moveShutter}
                onStop={stopShutter}
              />
            ))}
          </aside>
        </>
      ) : (
        <div className="rooms-view">
          <RoomMenu
            rooms={ROOM_HOTSPOTS}
            selectedRoomN={openRoomN}
            onSelect={setRoom}
          />
          <section className="rooms-content">
            {openRoomN === null ? (
              <div className="rooms-empty-state">Выберите комнату</div>
            ) : (
              <>
                <h2 className="rooms-content-title">{openHotspot?.label}</h2>
                {displayDevices.length === 0 ? (
                  <div className="rooms-empty-state">
                    В этой комнате пока нет устройств
                  </div>
                ) : (
                  <div className="rooms-device-list">
                    {displayDevices.map((device) => (
                      <DeviceCard
                        key={device.id}
                        device={device}
                        status={statusById[device.id] ?? { id: device.id }}
                        disabled={isDisabled}
                        onToggle={toggleSwitch}
                        onBrightnessPreview={previewBrightness}
                        onBrightnessCommit={commitBrightness}
                        onPositionPreview={previewShutterPosition}
                        onPositionCommit={commitShutterPosition}
                        onMove={moveShutter}
                        onStop={stopShutter}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
