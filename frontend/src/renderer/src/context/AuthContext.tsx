import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { UsuarioPublico } from "../api/auth";
import { limpiarEstadoUI } from "../config/estadoUI";

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
  // Solo es true cuando el usuario pidió "Recordarme" y safeStorage no
  // pudo persistir la sesión. Una sesión deliberadamente efímera no es una
  // degradación y no debe mostrar una advertencia de seguridad.
  persistenciaDegradada: boolean;
  // recordar=false guarda solo en memoria del proceso principal (se pierde
  // al cerrar la app); true la cifra con safeStorage y sobrevive reinicios.
  // Devuelve si realmente quedó persistida — puede pedirse recordar=true y
  // no lograrlo (ej. sin keyring del SO disponible), y eso NO debe impedir
  // iniciar sesión, solo degradar a sesión en memoria para esta ejecución.
  iniciarSesion: (sesion: SesionAuth, recordar: boolean) => Promise<{ persistida: boolean }>;
  cerrarSesion: () => Promise<void>;
  // Actualiza campos del usuario de la sesión actual (ej. requiereCambioPassword
  // tras cambiarla) sin volver a loguearse — re-persiste con el mismo modo
  // (memoria/safeStorage) que ya tenía la sesión.
  actualizarUsuario: (cambios: Partial<UsuarioPublico>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValor | null>(null);

export function esPersistenciaDegradada(recordar: boolean, persistida: boolean): boolean {
  return recordar && !persistida;
}

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
  const [persistenciaDegradada, setPersistenciaDegradada] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    window.indiApp?.sesionSegura
      .leer()
      .then((resultado) => {
        if (cancelado) return;
        setSesion(parsearSesion(resultado?.valor ?? null));
        setSesionPersistida(resultado ? resultado.persistida : null);
        setPersistenciaDegradada(false);
      })
      .catch(() => {
        if (cancelado) return;
        // Una falla de IPC/safeStorage durante la restauración nunca debe
        // convertirse en sesión autenticada ni quedar como rechazo global.
        setSesion(null);
        setSesionPersistida(null);
        setPersistenciaDegradada(false);
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
      persistenciaDegradada,
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
        setPersistenciaDegradada(esPersistenciaDegradada(recordar, persistida));
        return { persistida };
      },
      cerrarSesion: async () => {
        await window.indiApp?.sesionSegura.borrar();
        // Un cambio de usuario en la misma máquina no debe heredar la
        // ruta/filtros de la sesión anterior (rol distinto podría ya ni
        // siquiera poder ver esa ruta) — ver config/estadoUI.ts.
        limpiarEstadoUI();
        setSesion(null);
        setSesionPersistida(null);
        setPersistenciaDegradada(false);
      },
      actualizarUsuario: async (cambios) => {
        setSesion((actual) => {
          if (!actual) return actual;
          const actualizada = { ...actual, usuario: { ...actual.usuario, ...cambios } };
          window.indiApp?.sesionSegura.guardar(JSON.stringify(actualizada), sesionPersistida ?? false).catch(() => {});
          return actualizada;
        });
      },
    }),
    [sesion, cargando, sesionPersistida, persistenciaDegradada]
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
