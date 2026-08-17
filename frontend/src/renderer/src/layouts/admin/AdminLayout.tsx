import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { asset } from "@/shared/assets";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import { useTimeoutInactividad } from "@/shared/hooks/useTimeoutInactividad";
import AyudaSoporteModal from "@/layouts/admin/AyudaSoporteModal";
import AlternarTema from "@/shared/components/AlternarTema";
import { ETIQUETAS_GRUPO, GrupoNavegacion, menuPorRol } from "@/routes/navigationConfig";
import { guardarRutaPersistida, guardarSidebarContraido, leerSidebarContraido } from "@/core/config/estadoUI";
import IndicadorEstadoSistema from "@/layouts/admin/IndicadorEstadoSistema";

const MINUTOS_INACTIVIDAD_ANTES_DE_CERRAR_SESION = 30;

const ETIQUETA_ROL: Record<string, string> = {
  administrador: "Administrador",
  rh: "Recursos Humanos",
  recepcion: "Recepción",
  encargado_seccion: "Encargado de frente",
  trabajador: "Trabajador",
};

export default function AdminLayout() {
  const { sesion, persistenciaDegradada, cerrarSesion } = useAutenticacion();
  const [mostrarAyuda, setMostrarAyuda] = useState(false);
  const [errorCerrarSesion, setErrorCerrarSesion] = useState<string | null>(null);
  const [sidebarContraido, setSidebarContraido] = useState(leerSidebarContraido);
  const location = useLocation();

  const manejarCerrarSesion = useCallback(async () => {
    setErrorCerrarSesion(null);
    try {
      await cerrarSesion();
    } catch {
      // Si no se pudo borrar el token seguro, no fingimos un logout: el
      // contexto conserva la sesión y la UI explica que debe reintentarse.
      setErrorCerrarSesion("No se pudo cerrar la sesión de forma segura. Intenta nuevamente.");
    }
  }, [cerrarSesion]);

  // Antes del "if (!sesion) return null" de abajo: los hooks siempre deben
  // correr, sin importar el valor de sesion (reglas de hooks de React) - el
  // propio hook no hace nada dañino si se llega a montar sin sesión, solo
  // que ese caso no ocurre en la práctica (AppRoutes nunca monta AdminLayout
  // sin sesión, ver la ruta protegida "/panel").
  useTimeoutInactividad(MINUTOS_INACTIVIDAD_ANTES_DE_CERRAR_SESION, () => {
    void manejarCerrarSesion();
  });

  // Guarda la ruta actual en cada navegación dentro de /panel — AppRoutes la
  // lee una sola vez al montar para decidir dónde aterrizar la próxima vez
  // que se abra la app (ver config/estadoUI.ts).
  useEffect(() => {
    guardarRutaPersistida(location.pathname);
  }, [location.pathname]);

  if (!sesion) return null;

  const sesionDegradada = persistenciaDegradada;

  const iniciales = sesion.usuario.username.slice(0, 2).toUpperCase();

  // Única fuente de verdad para qué ve cada rol — ver routes/navigationConfig.tsx.
  const itemsNav = menuPorRol(sesion.usuario.rol);
  const grupos = (["general", "operacion", "supervision", "administracion"] as GrupoNavegacion[])
    .map((id) => ({ id, items: itemsNav.filter((item) => item.group === id) }))
    .filter((grupo) => grupo.items.length > 0);

  function alternarSidebar() {
    setSidebarContraido((actual) => {
      const siguiente = !actual;
      guardarSidebarContraido(siguiente);
      return siguiente;
    });
  }

  return (
    <div style={{ height: "100vh", display: "flex", background: "var(--bg)" }}>
      <nav
        className={`admin-sidebar${sidebarContraido ? " contraido" : ""}`}
        aria-label="Navegación principal"
        style={{
          flexShrink: 0,
          background: "var(--indi)",
          color: "var(--sidebar-ink)",
          display: "flex",
          flexDirection: "column",
          padding: "22px 0",
        }}
      >
        <div
          className="sidebar-brand"
          style={{
            padding: "0 22px 22px",
            borderBottom: "1px solid rgba(255,255,255,.12)",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <img
            src={asset("assets/indi-icon.png")}
            alt="INDI"
            style={{ width: 40, height: 40, borderRadius: 9, objectFit: "cover" }}
          />
          <div className="sidebar-brand-text">
            <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 17, letterSpacing: ".06em" }}>INDI</div>
            <div style={{ fontSize: 11, color: "var(--pastel)" }}>Asistencia</div>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={alternarSidebar}
            aria-label={sidebarContraido ? "Expandir menú" : "Contraer menú"}
            aria-expanded={!sidebarContraido}
            title={sidebarContraido ? "Expandir menú" : "Contraer menú"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points={sidebarContraido ? "9 18 15 12 9 6" : "15 18 9 12 15 6"} />
            </svg>
          </button>
        </div>

        <div className="sidebar-navigation">
          {grupos.map((grupo) => <section className="sidebar-group" key={grupo.id} aria-label={ETIQUETAS_GRUPO[grupo.id]}>
            <div className="sidebar-group-label" aria-hidden={sidebarContraido}>{ETIQUETAS_GRUPO[grupo.id]}</div>
            {grupo.items.map((item) => <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
              aria-label={item.label}
              data-tooltip={sidebarContraido ? item.label : undefined}
              title={sidebarContraido ? item.label : undefined}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: 13, padding: "13px 16px", margin: "0 12px",
                background: isActive ? "rgba(255,255,255,.14)" : "transparent", border: "none",
                borderRadius: 999, textAlign: "left", fontSize: 14, fontWeight: 600,
                color: isActive ? "var(--sidebar-ink)" : "var(--pastel)", textDecoration: "none",
              })}
            >
              <span className="sidebar-icon" aria-hidden="true">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </NavLink>)}
          </section>)}
        </div>

        <button
          className="sidebar-link"
          type="button"
          onClick={() => setMostrarAyuda(true)}
          aria-label="Ayuda y soporte"
          data-tooltip={sidebarContraido ? "Ayuda y soporte" : undefined}
          title={sidebarContraido ? "Ayuda y soporte" : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            padding: "13px 22px",
            background: "transparent",
            border: "none",
            borderLeft: "3px solid transparent",
            textAlign: "left",
            fontSize: 14,
            fontWeight: 600,
            width: "100%",
            color: "var(--pastel)",
            cursor: "pointer",
          }}
        >
          <span className="sidebar-icon" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <span className="sidebar-label">Ayuda y soporte</span>
        </button>

        <div className="sidebar-system-status" style={{ padding: "10px 14px 0", marginTop: "auto" }}>
          <IndicadorEstadoSistema compacto={sidebarContraido} />
        </div>

        <div
          className="sidebar-footer"
          style={{
            padding: "16px 14px 0",
            borderTop: "1px solid rgba(255,255,255,.12)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            className="sidebar-avatar"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--indi2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {iniciales}
          </div>
          <div className="sidebar-user-info" style={{ lineHeight: 1.3, flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {sesion.usuario.username}
              {sesionDegradada && (
                <span
                  title="Esta sesión no se guardó de forma segura: tendrás que volver a iniciar sesión si cierras la app."
                  style={{
                    display: "inline-flex",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "var(--warn)",
                    color: "#1a1200",
                    fontSize: 10,
                    fontWeight: 800,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    cursor: "help",
                  }}
                >
                  !
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--pastel)" }}>
              {ETIQUETA_ROL[sesion.usuario.rol] ?? sesion.usuario.rol}
            </div>
          </div>
          <AlternarTema oscuroPorDefecto />
          <button
            className="sidebar-logout"
            onClick={manejarCerrarSesion}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            style={{ background: "none", border: "none", color: "var(--pastel)", cursor: "pointer", padding: 4 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </nav>

      <main style={{ flex: 1, minWidth: 0, overflow: "auto", position: "relative", display: "flex", flexDirection: "column" }}>
        <div className="om-ambient" />
        {sesionDegradada && (
          <div
            style={{
              flexShrink: 0,
              padding: "8px 22px",
              background: "rgba(242,169,59,.14)",
              borderBottom: "1px solid rgba(242,169,59,.3)",
              color: "#8a6215",
              fontSize: 12.5,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            Sesión no guardada de forma segura en este equipo — se perderá al cerrar la app. No es un estado
            normal de "Recordarme".
          </div>
        )}
        {errorCerrarSesion && (
          <div role="alert" style={{ padding: "8px 22px", color: "var(--err)", textAlign: "center", fontSize: 12.5 }}>
            {errorCerrarSesion}
          </div>
        )}
        <div style={{ flex: 1, overflow: "auto", position: "relative", zIndex: 1 }}>
          <div key={location.pathname} className="page-transition">
            <Outlet />
          </div>
        </div>
      </main>

      {mostrarAyuda && <AyudaSoporteModal onCerrar={() => setMostrarAyuda(false)} />}
    </div>
  );
}
