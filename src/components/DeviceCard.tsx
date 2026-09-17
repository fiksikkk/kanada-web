import type { Device, StatusRecord } from "../hooks/useDeviceSocket.ts";

interface DeviceCardProps {
  device: Device;
  status: StatusRecord;
  disabled: boolean;
  onToggle: (deviceId: string) => void;
  onBrightnessPreview: (deviceId: string, value: number) => void;
  onBrightnessCommit: (deviceId: string, value: number) => void;
  onPositionPreview: (deviceId: string, value: number) => void;
  onPositionCommit: (deviceId: string, value: number) => void;
  onMove: (deviceId: string, direction: 0 | 1) => void;
  onStop: (deviceId: string) => void;
}

export function DeviceCard({
  device,
  status,
  disabled,
  onToggle,
  onBrightnessPreview,
  onBrightnessCommit,
  onPositionPreview,
  onPositionCommit,
  onMove,
  onStop,
}: DeviceCardProps) {
  const isShutter = device.type === "shutter";
  const isOn = Boolean(status.s);
  const brightness = status.b ?? 0;
  const position = status.p ?? 0;

  return (
    <div className="device-card">
      <div className="device-header">
        {isShutter ? (
          <svg
            className={`device-icon${position > 0 ? " on" : ""}`}
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
            className={`device-icon${isOn ? " on" : ""}`}
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
        <span className="device-name">{device.name}</span>
        {!isShutter && (
          <button
            type="button"
            className={`toggle-switch${isOn ? " on" : ""}`}
            onClick={() => onToggle(device.id)}
            disabled={disabled}
            role="switch"
            aria-checked={isOn}
            aria-label={device.name}
          >
            <span className="toggle-knob" />
          </button>
        )}
      </div>
      {device.type === "dimmer" && (
        <div className="brightness-row">
          <input
            type="range"
            className="brightness-slider"
            style={{ "--fill": `${brightness}%` } as React.CSSProperties}
            min={0}
            max={100}
            value={brightness}
            onChange={(event) =>
              onBrightnessPreview(device.id, Number(event.target.value))
            }
            onPointerUp={(event) =>
              onBrightnessCommit(device.id, Number(event.currentTarget.value))
            }
            onKeyUp={(event) =>
              onBrightnessCommit(device.id, Number(event.currentTarget.value))
            }
            disabled={disabled}
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
              onClick={() => onMove(device.id, 0)}
              disabled={disabled}
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
              onClick={() => onStop(device.id)}
              disabled={disabled}
              aria-label="Стоп"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className="shutter-btn"
              onClick={() => onMove(device.id, 1)}
              disabled={disabled}
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
              style={{ "--fill": `${position}%` } as React.CSSProperties}
              min={0}
              max={100}
              value={position}
              onChange={(event) =>
                onPositionPreview(device.id, Number(event.target.value))
              }
              onPointerUp={(event) =>
                onPositionCommit(device.id, Number(event.currentTarget.value))
              }
              onKeyUp={(event) =>
                onPositionCommit(device.id, Number(event.currentTarget.value))
              }
              disabled={disabled}
            />
            <span className="brightness-value">{position}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
