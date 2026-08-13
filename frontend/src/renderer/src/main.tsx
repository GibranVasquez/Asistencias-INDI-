import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { TerminalProvider } from "./context/TerminalContext";
import { ThemeProvider } from "./context/ThemeContext";
import { MaintenanceProvider } from "./context/MaintenanceContext";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";
import "./styles/theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <HashRouter>
        <AuthProvider>
          <MaintenanceProvider><TerminalProvider><App /></TerminalProvider></MaintenanceProvider>
        </AuthProvider>
      </HashRouter>
    </ThemeProvider>
  </StrictMode>
);
