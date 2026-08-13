import { ReactNode, useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { asset } from "../assets";
import { useAuth } from "../context/AuthContext";
import { useTimeoutInactividad } from "../hooks/useTimeoutInactividad";
import AyudaSoporteModal from "../components/AyudaSoporteModal";
import ThemeToggle from "../components/ThemeToggle";
import { menuPorRol, RutaPanel } from "../config/menuPorRol";
import { guardarRutaPersistida } from "../config/estadoUI";

const MINUTOS_INACTIVIDAD_ANTES_DE_CERRAR_SESION = 30;

const ETIQUETA_ROL: Record<string, string> = {
  administrador: "Administrador",
  rh: "Recursos Humanos",
  recepcion: "Recepción",
  encargado_seccion: "Encargado de frente",
  trabajador: "Trabajador",
};

interface ItemNav {
  ruta: RutaPanel;
  etiqueta: string;
  icono: ReactNode;
}

const ITEMS_NAV: ItemNav[] = [
  {
    ruta: "dashboard",
    etiqueta: "Dashboard",
    icono: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="16" width="7" height="5" />
      </svg>
    ),
  },
  {
    ruta: "asistencias",
    etiqueta: "Asistencias",
    icono: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    ruta: "nomina",
    etiqueta: "Nómina RH",
    icono: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    ),
  },
  {
    ruta: "encargado",
    etiqueta: "Encargado",
    icono: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    ruta: "trabajadores",
    etiqueta: "Trabajadores",
    icono: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    ruta: "usuarios",
    etiqueta: "Usuarios",
    icono: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    ruta: "terminales",
    etiqueta: "Terminales",
    icono: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
  },
  {
    ruta: "reportes",
    etiqueta: "Reportes",
    icono: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    ruta: "configuracion",
    etiqueta: "Configuración",
    icono: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function AdminLayout() {
  const { sesion, persistenciaDegradada, cerrarSesion } = useAuth();
  const [mostrarAyuda, setMostrarAyuda] = useState(false);
  const [errorCerrarSesion, setErrorCerrarSesion] = useState<string | null>(null);
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
  // que ese caso no ocurre en la práctica (App.tsx nunca monta AdminLayout
  // sin sesión, ver la ruta "/panel" en App.tsx).
  useTimeoutInactividad(MINUTOS_INACTIVIDAD_ANTES_DE_CERRAR_SESION, () => {
    void manejarCerrarSesion();
  });

  // Guarda la ruta actual en cada navegación dentro de /panel — App.tsx la
  // lee una sola vez al montar para decidir dónde aterrizar la próxima vez
  // que se abra la app (ver config/estadoUI.ts).
  useEffect(() => {
    guardarRutaPersistida(location.pathname);
  }, [location.pathname]);

  if (!sesion) return null;

  const sesionDegradada = persistenciaDegradada;

  const iniciales = sesion.usuario.username.slice(0, 2).toUpperCase();

  // Única fuente de verdad para qué ve cada rol — ver config/menuPorRol.ts.
  const rutasPermitidas = menuPorRol[sesion.usuario.rol];
  const itemsNav = ITEMS_NAV.filter((i) => rutasPermitidas.includes(i.ruta));

  return (
    <div style={{ height: "100vh", display: "flex", background: "var(--bg)" }}>
      <nav
        className="admin-sidebar"
        style={{
          width: 238,
          flexShrink: 0,
          background: "var(--indi)",
          color: "var(--sidebar-ink)",
          display: "flex",
          flexDirection: "column",
          padding: "22px 0",
        }}
      >
        <div
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
          <div>
            <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 17, letterSpacing: ".06em" }}>INDI</div>
            <div style={{ fontSize: 11, color: "var(--pastel)" }}>Asistencia</div>
          </div>
        </div>

        {itemsNav.map((item) => (
          <NavLink
            key={item.ruta}
            to={`/panel/${item.ruta}`}
            className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: 13,
              padding: "13px 16px",
              margin: "0 12px",
              background: isActive ? "rgba(255,255,255,.14)" : "transparent",
              border: "none",
              borderRadius: 999,
              textAlign: "left",
              fontSize: 14,
              fontWeight: 600,
              color: isActive ? "var(--sidebar-ink)" : "var(--pastel)",
              textDecoration: "none",
            })}
          >
            {item.icono}
            {item.etiqueta}
          </NavLink>
        ))}

        <button
          className="sidebar-link"
          type="button"
          onClick={() => setMostrarAyuda(true)}
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
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Ayuda y soporte
        </button>

        <div
          style={{
            marginTop: "auto",
            padding: "16px 22px 0",
            borderTop: "1px solid rgba(255,255,255,.12)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
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
          <div style={{ lineHeight: 1.3, flex: 1, minWidth: 0 }}>
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
          <ThemeToggle oscuroPorDefecto />
          <button
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

      <main style={{ flex: 1, overflow: "auto", position: "relative", display: "flex", flexDirection: "column" }}>
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
