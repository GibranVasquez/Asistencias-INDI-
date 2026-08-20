/**
 * Guard compartido: en entorno de desarrollo, DATABASE_URL (y variables
 * relacionadas) debe apuntar a un host local (localhost / 127.0.0.1).
 *
 * Reutilizado por:
 *   - src/config/env.ts        (arranque del servidor Express)
 *   - prisma.config.ts         (Prisma CLI: migrate, generate, studio)
 *   - prisma/seed.ts           (semilla general)
 *
 * Solo producción puede usar hosts externos legítimos. Desarrollo, un
 * NODE_ENV ausente y test quedan limitados a infraestructura local; los
 * runners de integración fijan además la URL efímera exacta.
 */
const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1"]);
const PROTOCOLOS_POSTGRES = new Set(["postgres:", "postgresql:"]);

function hostnameEfectivo(parsed: URL): string {
  // pg-connection-string permite que ?host= sobrescriba el hostname de la
  // URL. La guarda debe evaluar el destino que pg usará realmente.
  return (parsed.searchParams.get("host") || parsed.hostname).toLowerCase();
}

export function esUrlPostgresLocal(valor: string): boolean {
  try {
    const parsed = new URL(valor);
    return PROTOCOLOS_POSTGRES.has(parsed.protocol) && HOSTS_LOCALES.has(hostnameEfectivo(parsed));
  } catch {
    return false;
  }
}

export function exigirHostLocal(nombreVariable: string): void {
  if (process.env.NODE_ENV === "production") return;

  const url = process.env[nombreVariable];
  // Algunos comandos sin conexión (por ejemplo `prisma generate`) no
  // necesitan URL. Los entrypoints que sí la requieren la validan aparte.
  if (!url) return;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${nombreVariable} no es una URL PostgreSQL válida. Operación abortada.`);
  }

  if (!PROTOCOLOS_POSTGRES.has(parsed.protocol)) {
    throw new Error(`${nombreVariable} no usa el protocolo PostgreSQL. Operación abortada.`);
  }

  const hostname = hostnameEfectivo(parsed);
  if (!esUrlPostgresLocal(url)) {
    const hostnameSeguro = hostname || "vacío";
    throw new Error(
      `${nombreVariable} apunta a un host externo (${hostnameSeguro}). ` +
        "En desarrollo local y test debe apuntar a PostgreSQL local (localhost/127.0.0.1). " +
        "Si .env tiene múltiples líneas de esta variable, la última gana — comenta las externas."
    );
  }
}
