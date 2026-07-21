import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { TerminalProvider } from "./context/TerminalContext";
import "./styles/theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <TerminalProvider>
          <App />
        </TerminalProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>
);
