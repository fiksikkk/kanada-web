import { useEffect } from "react";
import "./App.css";
import planImage from "./assets/floor-plan.png";
import { AccountMenu } from "./components/AccountMenu.tsx";
import { DeviceList } from "./components/DeviceList.tsx";
import { FloorPlanView } from "./components/FloorPlanView.tsx";
import { RoomMenu } from "./components/RoomMenu.tsx";
import { ROOM_HOTSPOTS } from "./rooms.ts";
import { useDeviceSocket } from "./hooks/useDeviceSocket.ts";
import { useRoomViewState } from "./hooks/useRoomViewState.ts";

function App() {
  const { viewMode, openRoomN, setView, setRoom, openRoom, closeRoom } =
    useRoomViewState();

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

  // Запрашиваем статус устройств выбранной комнаты при любой смене
  // выбора - по клику на плане, по клику в списке или сразу при заходе по
  // ссылке с ?room=.
  useEffect(() => {
    if (openRoomN !== null) requestRoomStatus(openRoomN);
  }, [openRoomN, requestRoomStatus]);

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

  const deviceHandlers = {
    disabled: isDisabled,
    onToggle: toggleSwitch,
    onBrightnessPreview: previewBrightness,
    onBrightnessCommit: commitBrightness,
    onPositionPreview: previewShutterPosition,
    onPositionCommit: commitShutterPosition,
    onMove: moveShutter,
    onStop: stopShutter,
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
          <FloorPlanView
            planImage={planImage}
            hotspots={ROOM_HOTSPOTS}
            focusRoomN={openRoomN}
            onTapRoom={openRoom}
          />
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
            <DeviceList
              devices={displayDevices}
              statusById={statusById}
              {...deviceHandlers}
            />
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
                    <DeviceList
                      devices={displayDevices}
                      statusById={statusById}
                      {...deviceHandlers}
                    />
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
