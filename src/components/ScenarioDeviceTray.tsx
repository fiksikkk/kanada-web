import type { Device } from "../hooks/useDeviceSocket.ts";
import "./ScenarioDeviceTray.css";

interface ScenarioDeviceTrayProps {
  deviceIds: string[];
  devicesById: Record<string, Device>;
  onRemove: (deviceId: string) => void;
}

// Сводка "что уже выбрано" - видна независимо от того, какая комната сейчас
// открыта в RoomMenu слева (устройства могут быть из разных комнат).
// Правка значений - не здесь, а в самой комнате (ScenarioEditorPage), чтобы
// не дублировать контролы в двух местах.
export function ScenarioDeviceTray({
  deviceIds,
  devicesById,
  onRemove,
}: ScenarioDeviceTrayProps) {
  if (deviceIds.length === 0) {
    return (
      <p className="scenario-tray-empty">
        Устройства ещё не выбраны — откройте комнату слева и добавьте нужные.
      </p>
    );
  }

  return (
    <div className="scenario-tray">
      {deviceIds.map((id) => {
        const device = devicesById[id];
        return (
          <span key={id} className="scenario-tray-chip">
            {device?.name ?? id}
            <button
              type="button"
              className="scenario-tray-chip-remove"
              onClick={() => onRemove(id)}
              aria-label={`Убрать ${device?.name ?? id} из сценария`}
            >
              ×
            </button>
          </span>
        );
      })}
    </div>
  );
}
