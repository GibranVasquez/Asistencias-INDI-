interface OpcionesCsp {
  apiBaseUrl: string;
  desarrollo: boolean;
}

function origen(url: string): string {
  return new URL(url).origin;
}

export function construirContentSecurityPolicy({ apiBaseUrl, desarrollo }: OpcionesCsp): string {
  const conexiones = new Set(["'self'", origen(apiBaseUrl)]);
  if (desarrollo) {
    conexiones.add("http://localhost:*");
    conexiones.add("http://127.0.0.1:*");
    conexiones.add("ws://localhost:*");
    conexiones.add("ws://127.0.0.1:*");
  }

  return [
    "default-src 'none'",
    "script-src 'self'",
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
