import { useEffect, useRef, useState } from "react";
import type { Hotspot } from "../rooms.ts";

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

interface UseMapCameraOptions {
  hotspots: Hotspot[];
  focusRoomN: number | null;
  onTapRoom: (roomN: number) => void;
}

// Пан/зум-камера плана этажа - живёт, пока смонтирован FloorPlanView
// (он размонтируется при переключении на вид "Список", так что отдельный
// guard на "активность" не нужен - эффекты ниже и так не переживают
// текущее монтирование).
export function useMapCamera({
  hotspots,
  focusRoomN,
  onTapRoom,
}: UseMapCameraOptions) {
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [isInteracting, setIsInteracting] = useState(false);
  const [fitSize, setFitSize] = useState<FitSize>({ width: 0, height: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const activePointers = useRef(new Map<number, Point>());
  const gestureRef = useRef<Gesture | null>(null);
  const wheelIdleTimerRef = useRef<number | undefined>(undefined);

  // Пересчёт "вписанного" размера картинки по реальным пикселям
  // контейнера - ResizeObserver ловит и resize окна, и поворот экрана на
  // телефоне.
  useEffect(() => {
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

  // Камера следует за выбранной комнатой, а не только за кликом по
  // хотспоту - иначе при выборе комнаты в списке и возврате на план
  // камера оставалась бы там, где её оставили в прошлый раз (не на
  // самой комнате). Ждём реальных размеров sizer'а (fitSize), иначе
  // расчёт зума получится по ещё нулевому прямоугольнику.
  useEffect(() => {
    if (!fitSize.width || !fitSize.height) return;
    if (focusRoomN === null) {
      setCamera({ x: 0, y: 0, scale: 1 });
      return;
    }
    const hotspot = hotspots.find((h) => h.roomN === focusRoomN);
    if (!hotspot || !sizerRef.current) return;
    const rect = sizerRef.current.getBoundingClientRect();
    const localX = ((hotspot.left + hotspot.width / 2) / 100) * rect.width;
    const localY = ((hotspot.top + hotspot.height / 2) / 100) * rect.height;
    setCamera({
      scale: ROOM_ZOOM_SCALE,
      x: rect.width / 2 - localX * ROOM_ZOOM_SCALE,
      y: rect.height / 2 - localY * ROOM_ZOOM_SCALE,
    });
  }, [focusRoomN, fitSize.width, fitSize.height, hotspots]);

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
        onTapRoom(Number(gesture.roomN));
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

  const cameraStyle = {
    transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
    transition: isInteracting ? "none" : "transform 0.4s ease",
  };

  return {
    viewportRef,
    sizerRef,
    fitSize,
    cameraStyle,
    handlePointerDown,
    handlePointerMove,
    endGesture,
  };
}
