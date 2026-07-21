import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { UsuarioPublico } from "../api/auth";

interface SesionAuth {
  token: string;
  usuario: UsuarioPublico;
}

interface AuthContextValor {
  sesion: SesionAuth | null;
  // cargando=true mientras se lee la sesion persistida (safeStorage via IPC
  // es asincrono) — App no puede decidir la ruta inicial hasta que termine.
  cargando: boolean;
  // Estado PERSISTENTE (no un toast que desaparece) de si la sesion actual
  // sobrevivira cerrar y volver a abrir la app: true = cifrada en disco via
  // safeStorage; false = solo en memoria del proceso principal (recordar=false
  // a proposito, O recordar=true que no se pudo persistir de verdad — safeStorage
  // no disponible, keyring bloqueado, etc.); null = sin sesion.
  // La UI debe consultar esto en vez de asumir que "Recordarme" == recordado.
  sesionPersistida: boolean | null;
  // recordar=false guarda solo en memoria del proceso principal (se pierde
  // al cerrar la app); true la cifra con safeStorage y sobrevive reinicios.
  // Devuelve si realmente quedó persistida — puede pedirse recordar=true y
  // no lograrlo (ej. sin keyring del SO disponible), y eso NO debe impedir
  // iniciar sesión, solo degradar a sesión en memoria para esta ejecución.
  iniciarSesion: (sesion: SesionAuth, recordar: boolean) => Promise<{ persistida: boolean }>;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValor | null>(null);

function parsearSesion(crudo: string | null): SesionAuth | null {
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as SesionAuth;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionAuth | null>(null);
  const [sesionPersistida, setSesionPersistida] = useState<boolean | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    window.indiApp?.sesionSegura
      .leer()
      .then((resultado) => {
        if (cancelado) return;
        setSesion(parsearSesion(resultado?.valor ?? null));
        setSesionPersistida(resultado ? resultado.persistida : null);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const valor = useMemo<AuthContextValor>(
    () => ({
      sesion,
      cargando,
      sesionPersistida,
      iniciarSesion: async (nuevaSesion, recordar) => {
        const cuerpo = JSON.stringify(nuevaSesion);
        let persistida = recordar;
        try {
          await window.indiApp?.sesionSegura.guardar(cuerpo, recordar);
        } catch (err) {
          // safeStorage puede no estar disponible (sin keyring del SO, etc.):
          // no se bloquea el login por esto, se degrada a sesión en memoria.
          console.warn("[auth] no se pudo persistir la sesión de forma segura:", err);
          persistida = false;
          await window.indiApp?.sesionSegura.guardar(cuerpo, false).catch(() => {});
        }
        setSesion(nuevaSesion);
        setSesionPersistida(persistida);
        return { persistida };
      },
      cerrarSesion: async () => {
        await window.indiApp?.sesionSegura.borrar();
        setSesion(null);
        setSesionPersistida(null);
      },
    }),
    [sesion, cargando, sesionPersistida]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValor {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  }
  return contexto;
}
