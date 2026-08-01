import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

type Tema = "claro" | "oscuro" | "automatico";
type TemaResuelto = "claro" | "oscuro";

const CLAVE_LOCALSTORAGE = "indi-tema";

interface ThemeContextValor {
  tema: Tema;
  temaResuelto: TemaResuelto;
  cambiarTema: (tema: Tema) => void;
}

const ThemeContext = createContext<ThemeContextValor | null>(null);

function leerTemaGuardado(): Tema {
  const crudo = localStorage.getItem(CLAVE_LOCALSTORAGE);
  return crudo === "claro" || crudo === "oscuro" || crudo === "automatico" ? crudo : "automatico";
}

function prefiereOscuroDelSistema(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(leerTemaGuardado);
  const [prefiereOscuro, setPrefiereOscuro] = useState(prefiereOscuroDelSistema);

  // "automatico" sigue la preferencia del sistema en vivo — si el usuario
  // nunca eligió claro/oscuro explícitamente, un cambio de tema del SO
  // (ej. horario automático oscuro de Windows) debe reflejarse sin recargar.
  useEffect(() => {
    const medio = window.matchMedia("(prefers-color-scheme: dark)");
    const escuchar = (e: MediaQueryListEvent) => setPrefiereOscuro(e.matches);
    medio.addEventListener("change", escuchar);
    return () => medio.removeEventListener("change", escuchar);
  }, []);

  const temaResuelto: TemaResuelto = tema === "automatico" ? (prefiereOscuro ? "oscuro" : "claro") : tema;

  useEffect(() => {
    document.documentElement.dataset.theme = temaResuelto === "oscuro" ? "dark" : "light";
  }, [temaResuelto]);

  const valor = useMemo<ThemeContextValor>(
    () => ({
      tema,
      temaResuelto,
      cambiarTema: (nuevoTema) => {
        localStorage.setItem(CLAVE_LOCALSTORAGE, nuevoTema);
        setTema(nuevoTema);
      },
    }),
    [tema, temaResuelto]
  );

  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValor {
  const contexto = useContext(ThemeContext);
  if (!contexto) {
    throw new Error("useTheme debe usarse dentro de <ThemeProvider>.");
  }
  return contexto;
}
