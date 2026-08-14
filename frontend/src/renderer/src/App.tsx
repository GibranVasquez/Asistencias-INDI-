import { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { RolUsuario } from "./api/auth";
import { puedeAcceder, RutaPanel, rutaInicialPara } from "./config/menuPorRol";
import { leerRutaPersistida } from "./config/estadoUI";
import IntroSplash from "./components/IntroSplash";
import AdminLayout from "./layouts/AdminLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AsistenciasPage from "./pages/AsistenciasPage";
import TrabajadoresPage from "./pages/TrabajadoresPage";
import TrabajadorFormPage from "./pages/TrabajadorFormPage";
import EncargadoPage from "./pages/EncargadoPage";
import NominaPage from "./pages/NominaPage";
import UsuariosPage from "./pages/UsuariosPage";
import TerminalesPage from "./pages/TerminalesPage";
import ConfiguracionPage from "./pages/ConfiguracionPage";
import ReportesPage from "./pages/ReportesPage";
import IncidenciasPage from "./pages/IncidenciasPage";
import AuditoriaPage from "./pages/AuditoriaPage";
import CambiarPasswordObligatorioPage from "./pages/CambiarPasswordObligatorioPage";
import KioscoPage from "./pages/KioscoPage";
import MaintenanceScreen from "./components/MaintenanceScreen";
import PrecisionLoader from "./components/PrecisionLoader";
import { useMaintenance } from "./context/MaintenanceContext";

// Guard genérico: reemplaza los ternarios esRecepcion/esAdministrador/esRh
// repetidos por ruta (uno por cada <Route>, cada uno con su propia lógica
// ad hoc) por una sola consulta a menuPorRol (config/menuPorRol.ts) — la
// misma fuente de verdad que filtra el sidebar en AdminLayout.tsx. Si el rol
// no puede ver esa ruta, redirige a su propio home (primer ítem permitido),
// no a un valor fijo — así un encargado_seccion que teclee /panel/nomina en
// la barra de direcciones cae en /panel/encargado, no en /panel/dashboard.
function RutaProtegida({ rol, ruta, children }: { rol: RolUsuario; ruta: RutaPanel; children: ReactNode }) {
  return puedeAcceder(rol, ruta) ? <>{children}</> : <Navigate to={`/panel/${rutaInicialPara(rol)}`} replace />;
}

// Restaura la última pantalla vista (config/estadoUI.ts) al abrir la app —
// pero solo si el rol de la sesión ACTUAL todavía puede acceder a esa ruta.
// No se puede confiar ciegamente en lo persistido: pudo quedar de una
// sesión con otro rol en la misma máquina, o de antes de que este mismo rol
// perdiera acceso a algo (ej. el fix de menú por rol). Si no hay nada
// persistido o ya no es válido, cae a rutaInicialPara(rol) como siempre.
function rutaAlAbrir(rol: RolUsuario): RutaPanel {
  const persistida = leerRutaPersistida();
  const coincidencia = persistida?.match(/^\/panel\/([^/]+)/);
  const rutaPanel = coincidencia?.[1] as RutaPanel | undefined;
  if (rutaPanel && puedeAcceder(rol, rutaPanel)) {
    return rutaPanel;
  }
  return rutaInicialPara(rol);
}

export default function App() {
  const { sesion, cargando } = useAuth();
  const mantenimiento = useMaintenance();

  if (mantenimiento) return <MaintenanceScreen />;

  // Mientras se lee la sesion persistida via safeStorage/IPC (asincrono) no
  // se puede decidir todavia si "/" va a Login o al panel — evita un
  // parpadeo hacia Login seguido de un salto a /panel.
  if (cargando) {
    return <PrecisionLoader pantallaCompleta />;
  }

  // Cuenta con contraseña temporal (reseteada por un administrador): bloquea
  // TODA la app hasta que la cambie por una propia — ni sidebar ni rutas,
  // sin importar el rol. No aplica a Kiosco (usa sesión de Terminal, no de
  // Usuario, así que sesion aquí siempre es null para ese flujo).
  if (sesion?.usuario.requiereCambioPassword) {
    return <CambiarPasswordObligatorioPage />;
  }

  const rol = sesion?.usuario.rol;

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      <IntroSplash />
      <Routes>
        <Route path="/" element={sesion ? <Navigate to={`/panel/${rutaAlAbrir(sesion.usuario.rol)}`} replace /> : <LoginPage />} />
        <Route path="/panel" element={sesion ? <AdminLayout /> : <Navigate to="/" replace />}>
          {rol && (
            <>
              <Route index element={<Navigate to={rutaInicialPara(rol)} replace />} />
              <Route path="dashboard" element={<RutaProtegida rol={rol} ruta="dashboard"><DashboardPage /></RutaProtegida>} />
              <Route path="asistencias" element={<RutaProtegida rol={rol} ruta="asistencias"><AsistenciasPage /></RutaProtegida>} />
              <Route path="trabajadores" element={<RutaProtegida rol={rol} ruta="trabajadores"><TrabajadoresPage /></RutaProtegida>} />
              <Route path="trabajadores/nuevo" element={<RutaProtegida rol={rol} ruta="trabajadores"><TrabajadorFormPage /></RutaProtegida>} />
              <Route path="trabajadores/:id" element={<RutaProtegida rol={rol} ruta="trabajadores"><TrabajadorFormPage /></RutaProtegida>} />
              <Route path="encargado" element={<RutaProtegida rol={rol} ruta="encargado"><EncargadoPage /></RutaProtegida>} />
              <Route path="nomina" element={<RutaProtegida rol={rol} ruta="nomina"><NominaPage /></RutaProtegida>} />
              <Route path="usuarios" element={<RutaProtegida rol={rol} ruta="usuarios"><UsuariosPage /></RutaProtegida>} />
              <Route path="terminales" element={<RutaProtegida rol={rol} ruta="terminales"><TerminalesPage /></RutaProtegida>} />
              <Route path="configuracion" element={<RutaProtegida rol={rol} ruta="configuracion"><ConfiguracionPage /></RutaProtegida>} />
              <Route path="reportes" element={<RutaProtegida rol={rol} ruta="reportes"><ReportesPage /></RutaProtegida>} />
              <Route path="incidencias" element={<RutaProtegida rol={rol} ruta="incidencias"><IncidenciasPage /></RutaProtegida>} />
              <Route path="auditoria" element={<RutaProtegida rol={rol} ruta="auditoria"><AuditoriaPage /></RutaProtegida>} />
            </>
          )}
        </Route>
        <Route path="/kiosco" element={<KioscoPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
