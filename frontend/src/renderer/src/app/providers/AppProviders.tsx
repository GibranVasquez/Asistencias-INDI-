import { ReactNode } from "react";
import { HashRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import { TerminalProvider } from "@/features/kiosco/TerminalContext";
import { MaintenanceProvider } from "./MaintenanceProvider";
import { SystemStatusProvider } from "./SystemStatusProvider";
import { ThemeProvider } from "./ThemeProvider";

export default function AppProviders({ children }: { children: ReactNode }) {
  return <ThemeProvider>
    <HashRouter>
      <AuthProvider>
        <MaintenanceProvider>
          <SystemStatusProvider>
            <TerminalProvider>{children}</TerminalProvider>
          </SystemStatusProvider>
        </MaintenanceProvider>
      </AuthProvider>
    </HashRouter>
  </ThemeProvider>;
}
