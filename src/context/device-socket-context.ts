import { createContext } from "react";
import type { useDeviceSocket } from "../hooks/useDeviceSocket.ts";

export type DeviceSocketContextValue = ReturnType<typeof useDeviceSocket>;

export const DeviceSocketContext =
  createContext<DeviceSocketContextValue | null>(null);
