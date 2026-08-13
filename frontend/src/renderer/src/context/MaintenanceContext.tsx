import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { escucharMantenimiento } from "../api/client";

const MaintenanceContext = createContext(false);
export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [activo, setActivo] = useState(false);
  useEffect(() => escucharMantenimiento(setActivo), []);
  return <MaintenanceContext.Provider value={activo}>{children}</MaintenanceContext.Provider>;
}
export function useMaintenance(): boolean { return useContext(MaintenanceContext); }
