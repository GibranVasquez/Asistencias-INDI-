import { ReactNode } from "react";
import { HashRouter } from "react-router-dom";
import { ProveedorAutenticacion } from "@/features/auth/ContextoAutenticacion";
import { ProveedorTerminal } from "@/features/kiosco/ContextoTerminal";
import { ProveedorMantenimiento } from "./ProveedorMantenimiento";
import { ProveedorEstadoSistema } from "./ProveedorEstadoSistema";
import { ProveedorTema } from "./ProveedorTema";

export default function AppProviders({ children }: { children: ReactNode }) {
  return <ProveedorTema>
    <HashRouter>
      <ProveedorAutenticacion>
        <ProveedorMantenimiento>
          <ProveedorEstadoSistema>
            <ProveedorTerminal>{children}</ProveedorTerminal>
          </ProveedorEstadoSistema>
        </ProveedorMantenimiento>
      </ProveedorAutenticacion>
    </HashRouter>
  </ProveedorTema>;
}
