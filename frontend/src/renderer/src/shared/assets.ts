// Rutas absolutas ("/assets/...") solo resuelven bien contra un servidor
// (dev server de Vite). En el build empaquetado, Electron carga el renderer
// como file://, donde una ruta que empieza con "/" apunta a la raiz del
// filesystem, no a out/renderer/ — por eso el logo no cargaba en produccion.
// import.meta.env.BASE_URL respeta el `base` configurado (relativo en build,
// absoluto en dev) y funciona en ambos casos.
export function asset(rutaPublica: string): string {
  return `${import.meta.env.BASE_URL}${rutaPublica}`;
}
