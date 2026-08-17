import IntroSplash from "./components/IntroSplash";
import MaintenanceScreen from "./components/MaintenanceScreen";
import PrecisionLoader from "./components/PrecisionLoader";
import { useMantenimiento } from "./providers/ProveedorMantenimiento";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import CambiarPasswordObligatorioPage from "@/features/auth/CambiarPasswordObligatorioPage";
import AppRoutes from "@/routes/AppRoutes";

export default function App() {
  const { sesion, cargando } = useAutenticacion();
  const mantenimiento = useMantenimiento();

  if (mantenimiento) return <MaintenanceScreen />;
  if (cargando) return <PrecisionLoader pantallaCompleta />;
  if (sesion?.usuario.requiereCambioPassword) return <CambiarPasswordObligatorioPage />;

  return <div style={{ height: "100vh", position: "relative" }}>
    <IntroSplash />
    <AppRoutes />
  </div>;
}
