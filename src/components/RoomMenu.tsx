import type { Hotspot } from "../rooms.ts";

interface RoomMenuProps {
  rooms: Hotspot[];
  selectedRoomN: number | null;
  onSelect: (roomN: number) => void;
}

const FLOORS = [1, 2];

export function RoomMenu({ rooms, selectedRoomN, onSelect }: RoomMenuProps) {
  return (
    <nav className="room-menu">
      {FLOORS.map((floor) => {
        const floorRooms = rooms.filter((room) => room.floor === floor);
        return (
          <div className="floor-section" key={floor}>
            <div className="floor-section-title">{floor} этаж</div>
            {floorRooms.length === 0 ? (
              <div className="floor-section-empty">Пока нет комнат</div>
            ) : (
              floorRooms.map((room) => (
                <button
                  key={room.roomN}
                  type="button"
                  className={`room-menu-item${room.roomN === selectedRoomN ? " active" : ""}`}
                  onClick={() => onSelect(room.roomN)}
                >
                  {room.label}
                </button>
              ))
            )}
          </div>
        );
      })}
    </nav>
  );
}
