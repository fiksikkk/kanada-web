import type { Hotspot } from "../rooms.ts";
import { useMapCamera } from "../hooks/useMapCamera.ts";
import "./FloorPlanView.css";

interface FloorPlanViewProps {
  planImage: string;
  hotspots: Hotspot[];
  focusRoomN: number | null;
  onTapRoom: (roomN: number) => void;
}

export function FloorPlanView({
  planImage,
  hotspots,
  focusRoomN,
  onTapRoom,
}: FloorPlanViewProps) {
  const {
    viewportRef,
    sizerRef,
    fitSize,
    cameraStyle,
    handlePointerDown,
    handlePointerMove,
    endGesture,
  } = useMapCamera({ hotspots, focusRoomN, onTapRoom });

  return (
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
            {hotspots.map((hotspot) => (
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
    </>
  );
}
