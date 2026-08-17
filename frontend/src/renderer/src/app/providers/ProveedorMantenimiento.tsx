import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { escucharMantenimiento } from "@/core/api/client";

const ContextoMantenimiento = createContext(false);
export function ProveedorMantenimiento({ children }: { children: ReactNode }) {
  const [activo, setActivo] = useState(false);
  useEffect(() => escucharMantenimiento(setActivo), []);
  return <ContextoMantenimiento.Provider value={activo}>{children}</ContextoMantenimiento.Provider>;
}
export function useMantenimiento(): boolean { return useContext(ContextoMantenimiento); }
