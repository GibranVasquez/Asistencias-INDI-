import { useState } from "react";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import EncabezadoPagina from "@/shared/components/EncabezadoPagina";
import PanelCategoriasTrabajador from "./components/PanelCategoriasTrabajador";
import PanelDatosObra from "./components/PanelDatosObra";
import PanelFrentes from "./components/PanelFrentes";
import PanelHorarios from "./components/PanelHorarios";
import PanelTarifas from "./components/PanelTarifas";
import PanelTiposMovimiento from "./components/PanelTiposMovimiento";

type Tab = "obra" | "horarios" | "secciones" | "tiposMovimiento" | "tarifas" | "categorias";

const TABS: { id: Tab; etiqueta: string }[] = [
  { id: "obra", etiqueta: "Datos de la obra" },
  { id: "horarios", etiqueta: "Horarios" },
  { id: "secciones", etiqueta: "Frentes" },
  { id: "tiposMovimiento", etiqueta: "Tipos de movimiento" },
  { id: "tarifas", etiqueta: "Tarifa hora extra" },
  { id: "categorias", etiqueta: "Categorías" },
];

export default function ConfiguracionPage() {
  const { sesion } = useAutenticacion();
  const esAdministrador = sesion?.usuario.rol === "administrador";
  const [tab, setTab] = useState<Tab>(() => esAdministrador ? "obra" : "horarios");
  const tabsVisibles = esAdministrador ? TABS.filter((item) => item.id === "obra") : TABS;

  return (
    <div className="configuracion-page" style={{ padding: "26px 30px 36px" }}>
      <EncabezadoPagina titulo="Configuración" descripcion="Administra parámetros y catálogos que definen la operación del sistema." metadata="Parámetros del sistema" />

      <div className="configuracion-tabs" style={{ display: "flex", gap: 4, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 4, marginTop: 18, width: "fit-content" }}>
        {tabsVisibles.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            style={{
              padding: "9px 16px",
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              background: tab === item.id ? "var(--indi)" : "transparent",
              color: tab === item.id ? "#fff" : "var(--muted)",
              cursor: "pointer",
            }}
          >
            {item.etiqueta}
          </button>
        ))}
      </div>

      <div className="configuracion-contenido" style={{ marginTop: 18 }}>
        {tab === "obra" && <PanelDatosObra />}
        {tab === "horarios" && <PanelHorarios />}
        {tab === "secciones" && <PanelFrentes />}
        {tab === "tiposMovimiento" && <PanelTiposMovimiento />}
        {tab === "tarifas" && <PanelTarifas />}
        {tab === "categorias" && <PanelCategoriasTrabajador />}
      </div>
    </div>
  );
}
