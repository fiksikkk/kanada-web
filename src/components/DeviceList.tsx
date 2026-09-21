import { DeviceCard } from "./DeviceCard.tsx";
import type { Device, StatusRecord } from "../hooks/useDeviceSocket.ts";

interface DeviceHandlers {
  disabled: boolean;
  onToggle: (deviceId: string) => void;
  onBrightnessPreview: (deviceId: string, value: number) => void;
  onBrightnessCommit: (deviceId: string, value: number) => void;
  onPositionPreview: (deviceId: string, value: number) => void;
  onPositionCommit: (deviceId: string, value: number) => void;
  onMove: (deviceId: string, direction: 0 | 1) => void;
  onStop: (deviceId: string) => void;
}

interface DeviceListProps extends DeviceHandlers {
  devices: Device[];
  statusById: Record<string, StatusRecord>;
}

export function DeviceList({
  devices,
  statusById,
  ...handlers
}: DeviceListProps) {
  return (
    <>
      {devices.map((device) => (
        <DeviceCard
          key={device.id}
          device={device}
          status={statusById[device.id] ?? { id: device.id }}
          {...handlers}
        />
      ))}
    </>
  );
}
