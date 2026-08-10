interface OpcionesCsp {
  apiBaseUrl: string;
  desarrollo: boolean;
}

function origen(url: string): string {
  return new URL(url).origin;
}

export function construirContentSecurityPolicy({ apiBaseUrl, desarrollo }: OpcionesCsp): string {
  const conexiones = new Set(["'self'", origen(apiBaseUrl)]);
  const scripts = new Set(["'self'"]);
  if (desarrollo) {
    conexiones.add("http://localhost:*");
    conexiones.add("http://127.0.0.1:*");
    conexiones.add("ws://localhost:*");
    conexiones.add("ws://127.0.0.1:*");
    // Vite 7 inyecta el preámbulo de React Fast Refresh como un script
    // inline en desarrollo. Se permite únicamente su hash exacto (reportado
    // por Chromium), no unsafe-inline ni unsafe-eval. Producción no incluye
    // este hash porque el bundle compilado no usa dicho preámbulo.
    scripts.add("'sha256-Z2/iFzh9VMlVkEOar1f/oSHWwQk3ve1qk/C2WdsC4Xk='");
  }

  return [
    "default-src 'none'",
    `script-src ${[...scripts].join(" ")}`,
    // La UI existente usa estilos inline de React extensamente. Esto no
    // habilita scripts inline ni eval y evita una reescritura cosmética.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${[...conexiones].join(" ")}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
}

export function esNavegacionAlMismoDocumento(actual: string, destino: string): boolean {
  try {
    const desde = new URL(actual);
    const hacia = new URL(destino);
    return desde.protocol === hacia.protocol && desde.host === hacia.host && desde.pathname === hacia.pathname;
  } catch {
    return false;
  }
}
