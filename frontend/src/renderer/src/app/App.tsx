import IntroSplash from "./components/IntroSplash";
import MaintenanceScreen from "./components/MaintenanceScreen";
import PrecisionLoader from "./components/PrecisionLoader";
import { useMaintenance } from "./providers/MaintenanceProvider";
import { useAuth } from "@/features/auth/AuthContext";
import CambiarPasswordObligatorioPage from "@/features/auth/CambiarPasswordObligatorioPage";
import AppRoutes from "@/routes/AppRoutes";

export default function App() {
  const { sesion, cargando } = useAuth();
  const mantenimiento = useMaintenance();

  if (mantenimiento) return <MaintenanceScreen />;
  if (cargando) return <PrecisionLoader pantallaCompleta />;
  if (sesion?.usuario.requiereCambioPassword) return <CambiarPasswordObligatorioPage />;

  return <div style={{ height: "100vh", position: "relative" }}>
    <IntroSplash />
    <AppRoutes />
  </div>;
}
