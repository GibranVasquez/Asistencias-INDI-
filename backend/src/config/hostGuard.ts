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

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error(`${nombreVariable} no usa el protocolo PostgreSQL. Operación abortada.`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!HOSTS_LOCALES.has(hostname)) {
    const hostnameSeguro = hostname || "vacío";
    throw new Error(
      `${nombreVariable} apunta a un host externo (${hostnameSeguro}). ` +
        "En desarrollo local y test debe apuntar a PostgreSQL local (localhost/127.0.0.1). " +
        "Si .env tiene múltiples líneas de esta variable, la última gana — comenta las externas."
    );
  }
}
