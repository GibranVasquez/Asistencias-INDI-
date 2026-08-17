import { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RolUsuario } from "@/features/auth/api";
import { useAuth } from "@/features/auth/AuthContext";
import LoginPage from "@/features/auth/LoginPage";
import PanelPrincipalPage from "@/features/dashboard/PanelPrincipalPage";
import AsistenciasPage from "@/features/asistencias/AsistenciasPage";
import TrabajadoresPage from "@/features/trabajadores/TrabajadoresPage";
import TrabajadorFormPage from "@/features/trabajadores/TrabajadorFormPage";
import EncargadoPage from "@/features/encargado/EncargadoPage";
import NominaPage from "@/features/nomina/NominaPage";
import UsuariosPage from "@/features/usuarios/UsuariosPage";
import TerminalesPage from "@/features/terminales/TerminalesPage";
import ConfiguracionPage from "@/features/configuracion/ConfiguracionPage";
import ReportesPage from "@/features/reportes/ReportesPage";
import IncidenciasPage from "@/features/incidencias/IncidenciasPage";
import AuditoriaPage from "@/features/auditoria/AuditoriaPage";
import KioscoPage from "@/features/kiosco/KioscoPage";
import AdminLayout from "@/layouts/admin/AdminLayout";
import { leerRutaPersistida } from "@/core/config/estadoUI";
import { puedeAcceder, RutaPanel, rutaInicialPara } from "./navigationConfig";

function RutaProtegida({ rol, ruta, children }: { rol: RolUsuario; ruta: RutaPanel; children: ReactNode }) {
  return puedeAcceder(rol, ruta) ? <>{children}</> : <Navigate to={`/panel/${rutaInicialPara(rol)}`} replace />;
}

function rutaAlAbrir(rol: RolUsuario): RutaPanel {
  const coincidencia = leerRutaPersistida()?.match(/^\/panel\/([^/]+)/);
  const ruta = coincidencia?.[1] as RutaPanel | undefined;
  return ruta && puedeAcceder(rol, ruta) ? ruta : rutaInicialPara(rol);
}

export default function AppRoutes() {
  const { sesion } = useAuth();
  const rol = sesion?.usuario.rol;

  return <Routes>
    <Route path="/" element={sesion ? <Navigate to={`/panel/${rutaAlAbrir(sesion.usuario.rol)}`} replace /> : <LoginPage />} />
    <Route path="/panel" element={sesion ? <AdminLayout /> : <Navigate to="/" replace />}>
      {rol && <>
        <Route index element={<Navigate to={rutaInicialPara(rol)} replace />} />
        <Route path="dashboard" element={<RutaProtegida rol={rol} ruta="dashboard"><PanelPrincipalPage /></RutaProtegida>} />
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
      </>}
    </Route>
    <Route path="/kiosco" element={<KioscoPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
