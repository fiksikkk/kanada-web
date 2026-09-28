import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { RoomMenu } from "../components/RoomMenu.tsx";
import { ScenarioDeviceTray } from "../components/ScenarioDeviceTray.tsx";
import { useDeviceSocketContext } from "../context/useDeviceSocketContext.ts";
import type {
  Device,
  SceneDayField,
  SceneSchedule,
  SceneUpsertRecord,
  StatusRecord,
} from "../hooks/useDeviceSocket.ts";
import { ROOM_HOTSPOTS } from "../rooms.ts";
import "../components/DeviceCard.css";
import "./AuthPages.css";
import "./ScenarioEditorPage.css";

type DraftMap = Record<string, SceneUpsertRecord>;

const EMPTY_SCHEDULE: SceneSchedule = {
  hour: 0,
  minute: 0,
  monday: false,
  tuesday: false,
  wednesday: false,
  thursday: false,
  friday: false,
  saturday: false,
  sunday: false,
};

const DAY_FIELDS: SceneDayField[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABELS: Record<SceneDayField, string> = {
  monday: "Пн",
  tuesday: "Вт",
  wednesday: "Ср",
  thursday: "Чт",
  friday: "Пт",
  saturday: "Сб",
  sunday: "Вс",
};

// Сохранённое значение сценария (switch/brightness/position) -> черновик
// для правки в редакторе. "active" всегда true - это карта только
// включённых в сценарий устройств (сервер отдаёт ВСЕ устройства дома с
// active=false по умолчанию, см. ReadKnxSceneValues LEFT JOIN).
function buildUpsertFromStatus(
  device: Device,
  status: StatusRecord | undefined,
): SceneUpsertRecord {
  if (device.type === "shutter") {
    return { id: device.id, active: true, position: status?.p ?? 0 };
  }
  if (device.type === "dimmer") {
    return {
      id: device.id,
      active: true,
      switch: Boolean(status?.s),
      brightness: status?.b ?? 0,
    };
  }
  return { id: device.id, active: true, switch: Boolean(status?.s) };
}

export function ScenarioEditorPage() {
  const { number: numberParam } = useParams();
  const editingNumber = numberParam ? Number(numberParam) : null;
  const navigate = useNavigate();

  const {
    devices,
    statusById,
    requestRoomStatus,
    sceneDetail,
    sceneSchedule,
    requestSceneDetail,
    requestSceneSchedule,
    saveScene,
    deleteScene,
    runScene,
    saveSceneSchedule,
  } = useDeviceSocketContext();

  const [name, setName] = useState("");
  const [draft, setDraft] = useState<DraftMap>({});
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [schedule, setSchedule] = useState<SceneSchedule>(EMPTY_SCHEDULE);
  const [selectedRoomN, setSelectedRoomN] = useState<number | null>(null);
  const [loadedFromDetail, setLoadedFromDetail] = useState(false);
  // Создание нового сценария: номер назначает сервер, ждём "свой" ответ
  // sceneDetail и переходим в редактор созданного сценария - расписание
  // можно задать только сценарию с номером.
  const [pendingCreateId, setPendingCreateId] = useState<string | null>(null);

  useEffect(() => {
    if (
      pendingCreateId === null ||
      !sceneDetail ||
      sceneDetail.clientRequestId !== pendingCreateId
    ) {
      return;
    }
    navigate(`/scenarios/${sceneDetail.number}`, { replace: true });
  }, [pendingCreateId, sceneDetail, navigate]);

  useEffect(() => {
    if (editingNumber === null) return;
    requestSceneDetail(editingNumber);
    requestSceneSchedule(editingNumber);
  }, [editingNumber, requestSceneDetail, requestSceneSchedule]);

  // sceneDetail/sceneSchedule - широковещательные ответы (см.
  // useDeviceSocket.ts), нужно дождаться именно "нашего" number. Черновик
  // заполняем только один раз (loadedFromDetail) - иначе более позднее
  // эхо (например от другого браузера) перезаписало бы уже сделанные, но
  // ещё не сохранённые правки.
  useEffect(() => {
    if (
      editingNumber === null ||
      !sceneDetail ||
      sceneDetail.number !== editingNumber ||
      loadedFromDetail
    ) {
      return;
    }

    setName(sceneDetail.name);
    const nextDraft: DraftMap = {};
    for (const record of sceneDetail.devices) {
      if (!record.active) continue;
      nextDraft[record.id] = {
        id: record.id,
        active: true,
        switch: record.switchValue,
        brightness: record.brightnessValue,
        position: record.positionValue,
      };
    }
    setDraft(nextDraft);
    setLoadedFromDetail(true);
  }, [editingNumber, sceneDetail, loadedFromDetail]);

  useEffect(() => {
    if (
      editingNumber !== null &&
      sceneSchedule &&
      sceneSchedule.number === editingNumber
    ) {
      setSchedule(sceneSchedule.schedule);
    }
  }, [editingNumber, sceneSchedule]);

  useEffect(() => {
    if (selectedRoomN !== null) requestRoomStatus(selectedRoomN);
  }, [selectedRoomN, requestRoomStatus]);

  const devicesById = useMemo(() => {
    const map: Record<string, Device> = {};
    for (const device of devices) map[device.id] = device;
    return map;
  }, [devices]);

  const roomDevices = useMemo(
    () => devices.filter((device) => device.roomN === selectedRoomN),
    [devices, selectedRoomN],
  );

  const selectedHotspot = ROOM_HOTSPOTS.find(
    (hotspot) => hotspot.roomN === selectedRoomN,
  );

  function addDevice(device: Device) {
    setDraft((prev) => ({
      ...prev,
      [device.id]: buildUpsertFromStatus(device, statusById[device.id]),
    }));
    setRemovedIds((prev) => {
      if (!prev.has(device.id)) return prev;
      const next = new Set(prev);
      next.delete(device.id);
      return next;
    });
  }

  function removeDevice(deviceId: string) {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[deviceId];
      return next;
    });
    if (editingNumber !== null) {
      setRemovedIds((prev) => new Set(prev).add(deviceId));
    }
  }

  function updateDraftField(deviceId: string, patch: Partial<SceneUpsertRecord>) {
    setDraft((prev) => ({
      ...prev,
      [deviceId]: { ...prev[deviceId], ...patch },
    }));
  }

  function recaptureAll() {
    setDraft((prev) => {
      const next: DraftMap = {};
      for (const id of Object.keys(prev)) {
        const device = devicesById[id];
        next[id] = device
          ? buildUpsertFromStatus(device, statusById[id])
          : prev[id];
      }
      return next;
    });
  }

  const includedIds = Object.keys(draft);

  function handleSave() {
    const payload = {
      number: editingNumber,
      name: name.trim() || "Без названия",
      upsert: Object.values(draft),
      remove: Array.from(removedIds),
    };
    if (editingNumber === null) {
      // не crypto.randomUUID - он есть только в secure context (https/localhost)
      const clientRequestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setPendingCreateId(clientRequestId);
      saveScene({ ...payload, clientRequestId });
      return;
    }
    saveScene(payload);
    navigate("/scenarios");
  }

  function handleDelete() {
    if (editingNumber === null) return;
    if (
      !window.confirm(`Удалить сценарий «${name}»? Действие необратимо.`)
    ) {
      return;
    }
    deleteScene(editingNumber);
    navigate("/scenarios");
  }

  function handleScheduleSave() {
    if (editingNumber === null) return;
    const { hour, minute, ...days } = schedule;
    saveSceneSchedule({ number: editingNumber, hour, minute, days });
  }

  return (
    <main className="scenario-editor">
      <div className="scenario-editor-header">
        <Link to="/scenarios" className="auth-switch">
          ← Сценарии
        </Link>
        <input
          className="scenario-editor-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Название сценария"
        />
        <div className="scenario-editor-actions">
          {editingNumber !== null && (
            <button
              type="button"
              className="auth-submit secondary"
              onClick={() => runScene(editingNumber)}
            >
              Запустить
            </button>
          )}
          {editingNumber !== null && (
            <button
              type="button"
              className="auth-submit danger"
              onClick={handleDelete}
            >
              Удалить
            </button>
          )}
          <button
            type="button"
            className="auth-submit"
            onClick={handleSave}
            disabled={pendingCreateId !== null}
          >
            Сохранить
          </button>
        </div>
      </div>

      <section className="scenario-editor-section">
        <div className="scenario-tray-header">
          <h3>Устройства ({includedIds.length})</h3>
          {includedIds.length > 0 && (
            <button
              type="button"
              className="scenario-recapture-all"
              onClick={recaptureAll}
            >
              Обновить все по текущему состоянию
            </button>
          )}
        </div>
        <ScenarioDeviceTray
          deviceIds={includedIds}
          devicesById={devicesById}
          onRemove={removeDevice}
        />
      </section>

      <section className="scenario-editor-rooms">
        <RoomMenu
          rooms={ROOM_HOTSPOTS}
          selectedRoomN={selectedRoomN}
          onSelect={setSelectedRoomN}
        />
        <div className="scenario-editor-devices">
          {selectedRoomN === null ? (
            <p className="scenario-tray-empty">
              Выберите комнату, чтобы добавить её устройства в сценарий.
            </p>
          ) : (
            <>
              <h3>{selectedHotspot?.label}</h3>
              {roomDevices.length === 0 ? (
                <p className="scenario-tray-empty">
                  В этой комнате пока нет устройств.
                </p>
              ) : (
                roomDevices.map((device) => {
                  const included = Boolean(draft[device.id]);
                  const value = draft[device.id];
                  return (
                    <div key={device.id} className="device-card">
                      <div className="device-header">
                        <span className="device-name">{device.name}</span>
                        {included ? (
                          <button
                            type="button"
                            className="scenario-device-remove"
                            onClick={() => removeDevice(device.id)}
                          >
                            Убрать
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="scenario-device-add"
                            onClick={() => addDevice(device)}
                          >
                            Добавить
                          </button>
                        )}
                      </div>
                      {included && device.type !== "shutter" && (
                        <div className="device-header">
                          <span>Включено в сценарии</span>
                          <button
                            type="button"
                            className={`toggle-switch${value?.switch ? " on" : ""}`}
                            onClick={() =>
                              updateDraftField(device.id, {
                                switch: !value?.switch,
                              })
                            }
                            role="switch"
                            aria-checked={Boolean(value?.switch)}
                          >
                            <span className="toggle-knob" />
                          </button>
                        </div>
                      )}
                      {included && device.type === "dimmer" && (
                        <div className="brightness-row">
                          <input
                            type="range"
                            className="brightness-slider"
                            style={
                              {
                                "--fill": `${value?.brightness ?? 0}%`,
                              } as React.CSSProperties
                            }
                            min={0}
                            max={100}
                            value={value?.brightness ?? 0}
                            onChange={(event) =>
                              updateDraftField(device.id, {
                                brightness: Number(event.target.value),
                              })
                            }
                          />
                          <span className="brightness-value">
                            {value?.brightness ?? 0}%
                          </span>
                        </div>
                      )}
                      {included && device.type === "shutter" && (
                        <div className="brightness-row">
                          <input
                            type="range"
                            className="brightness-slider"
                            style={
                              {
                                "--fill": `${value?.position ?? 0}%`,
                              } as React.CSSProperties
                            }
                            min={0}
                            max={100}
                            value={value?.position ?? 0}
                            onChange={(event) =>
                              updateDraftField(device.id, {
                                position: Number(event.target.value),
                              })
                            }
                          />
                          <span className="brightness-value">
                            {value?.position ?? 0}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </section>

      {editingNumber === null && (
        <section className="scenario-editor-section">
          <h3>Расписание</h3>
          <p className="scenario-schedule-hint">
            Расписание можно задать после первого сохранения сценария.
          </p>
        </section>
      )}

      {editingNumber !== null && (
        <section className="scenario-editor-section">
          <h3>Расписание</h3>
          <div className="scenario-schedule-time">
            <label>
              Часы
              <input
                type="number"
                min={0}
                max={23}
                value={schedule.hour}
                onChange={(event) =>
                  setSchedule((prev) => ({
                    ...prev,
                    hour: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              Минуты
              <input
                type="number"
                min={0}
                max={59}
                value={schedule.minute}
                onChange={(event) =>
                  setSchedule((prev) => ({
                    ...prev,
                    minute: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>
          <div className="scenario-schedule-days">
            {DAY_FIELDS.map((day) => (
              <button
                key={day}
                type="button"
                className={`scenario-schedule-day${schedule[day] ? " active" : ""}`}
                onClick={() =>
                  setSchedule((prev) => ({ ...prev, [day]: !prev[day] }))
                }
              >
                {DAY_LABELS[day]}
              </button>
            ))}
          </div>
          <p className="scenario-schedule-hint">
            Сценарий сработает автоматически в указанное время в отмеченные
            дни недели. Без отмеченных дней расписание не активно.
          </p>
          <button
            type="button"
            className="auth-submit"
            onClick={handleScheduleSave}
          >
            Сохранить расписание
          </button>
        </section>
      )}
    </main>
  );
}
