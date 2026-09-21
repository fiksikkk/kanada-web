import { useContext } from "react";
import {
  DeviceSocketContext,
  type DeviceSocketContextValue,
} from "./device-socket-context.ts";

export function useDeviceSocketContext(): DeviceSocketContextValue {
  const ctx = useContext(DeviceSocketContext);
  if (!ctx) {
    throw new Error(
      "useDeviceSocketContext must be used within a DeviceSocketProvider",
    );
  }
  return ctx;
}
