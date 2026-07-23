import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AdminLayout from "./layouts/AdminLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AsistenciasPage from "./pages/AsistenciasPage";
import TrabajadoresPage from "./pages/TrabajadoresPage";
import TrabajadorFormPage from "./pages/TrabajadorFormPage";
import EncargadoPage from "./pages/EncargadoPage";
import NominaPage from "./pages/NominaPage";
import UsuariosPage from "./pages/UsuariosPage";
import ConfiguracionPage from "./pages/ConfiguracionPage";
import ReportesPage from "./pages/ReportesPage";
import CambiarPasswordObligatorioPage from "./pages/CambiarPasswordObligatorioPage";
import KioscoPage from "./pages/KioscoPage";

// recepcion tiene bloqueado el Dashboard por completo (decision del usuario
// 2026-07-21): su rol es "solo visualiza la lista de asistencia y nada
// mas" — ni siquiera una version degradada del Dashboard le corresponde.
function rutaInicialPara(rol: string): string {
  return rol === "recepcion" ? "/panel/asistencias" : "/panel/dashboard";
}

export default function App() {
  const { sesion, cargando } = useAuth();

  // Mientras se lee la sesion persistida via safeStorage/IPC (asincrono) no
  // se puede decidir todavia si "/" va a Login o al panel — evita un
  // parpadeo hacia Login seguido de un salto a /panel.
  if (cargando) {
    return <div style={{ height: "100vh", background: "var(--bg)" }} />;
  }

  // Cuenta con contraseña temporal (reseteada por un administrador): bloquea
  // TODA la app hasta que la cambie por una propia — ni sidebar ni rutas,
  // sin importar el rol. No aplica a Kiosco (usa sesión de Terminal, no de
  // Usuario, así que sesion aquí siempre es null para ese flujo).
  if (sesion?.usuario.requiereCambioPassword) {
    return <CambiarPasswordObligatorioPage />;
  }

  const esRecepcion = sesion?.usuario.rol === "recepcion";
  const esAdministrador = sesion?.usuario.rol === "administrador";
  const esRh = sesion?.usuario.rol === "rh";

  return (
    <Routes>
      <Route path="/" element={sesion ? <Navigate to={rutaInicialPara(sesion.usuario.rol)} replace /> : <LoginPage />} />
      <Route path="/panel" element={sesion ? <AdminLayout /> : <Navigate to="/" replace />}>
        <Route index element={<Navigate to={esRecepcion ? "asistencias" : "dashboard"} replace />} />
        <Route
          path="dashboard"
          element={esRecepcion ? <Navigate to="/panel/asistencias" replace /> : <DashboardPage />}
        />
        <Route path="asistencias" element={<AsistenciasPage />} />
        <Route
          path="trabajadores"
          element={esRecepcion ? <Navigate to="/panel/asistencias" replace /> : <TrabajadoresPage />}
        />
        <Route
          path="trabajadores/nuevo"
          element={esRecepcion ? <Navigate to="/panel/asistencias" replace /> : <TrabajadorFormPage />}
        />
        <Route
          path="trabajadores/:id"
          element={esRecepcion ? <Navigate to="/panel/asistencias" replace /> : <TrabajadorFormPage />}
        />
        <Route
          path="encargado"
          element={esRecepcion ? <Navigate to="/panel/asistencias" replace /> : <EncargadoPage />}
        />
        <Route
          path="nomina"
          element={esRecepcion ? <Navigate to="/panel/asistencias" replace /> : <NominaPage />}
        />
        <Route
          path="usuarios"
          element={esAdministrador ? <UsuariosPage /> : <Navigate to={esRecepcion ? "/panel/asistencias" : "/panel/dashboard"} replace />}
        />
        <Route
          path="configuracion"
          element={esRh ? <ConfiguracionPage /> : <Navigate to={esRecepcion ? "/panel/asistencias" : "/panel/dashboard"} replace />}
        />
        <Route
          path="reportes"
          element={esRh ? <ReportesPage /> : <Navigate to={esRecepcion ? "/panel/asistencias" : "/panel/dashboard"} replace />}
        />
      </Route>
      <Route path="/kiosco" element={<KioscoPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
