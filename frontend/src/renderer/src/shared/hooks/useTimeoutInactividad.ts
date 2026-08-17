import { useEffect, useRef } from "react";

// Eventos que cuentan como "el usuario sigue ahí" - mouse, teclado, scroll y
// touch (por si algún día corre en una pantalla táctil). No incluye eventos
// que el propio sistema puede disparar sin interacción real (ej. resize).
const EVENTOS_ACTIVIDAD: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];

/**
 * Llama a `alCumplirse` tras `minutos` sin ningún evento de actividad del
 * usuario (mouse/teclado/scroll/touch) — se reinicia el conteo con cada
 * evento. No revisa el JWT en sí: es una expiración de sesión del lado del
 * cliente, independiente y más corta que el vencimiento absoluto del token
 * (JWT_EXPIRES_IN en el backend).
 */
export function useTimeoutInactividad(minutos: number, alCumplirse: () => void): void {
  const alCumplirseRef = useRef(alCumplirse);

  useEffect(() => {
    alCumplirseRef.current = alCumplirse;
  }, [alCumplirse]);

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout>;

    function reiniciar() {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => alCumplirseRef.current(), minutos * 60_000);
    }

    reiniciar();
    EVENTOS_ACTIVIDAD.forEach((evento) => window.addEventListener(evento, reiniciar));

    return () => {
      clearTimeout(temporizador);
      EVENTOS_ACTIVIDAD.forEach((evento) => window.removeEventListener(evento, reiniciar));
    };
  }, [minutos]);
}
