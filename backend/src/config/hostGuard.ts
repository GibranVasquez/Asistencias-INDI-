/**
 * Guard compartido: en entorno de desarrollo, DATABASE_URL (y variables
 * relacionadas) debe apuntar a un host local (localhost / 127.0.0.1).
 *
 * Reutilizado por:
 *   - src/config/env.ts        (arranque del servidor Express)
 *   - prisma.config.ts         (Prisma CLI: migrate, generate, studio)
 *   - prisma/seed.ts           (semilla general)
 *
 * En producción y test el guard se omite:
 *   - producción usa hosts externos legítimos (RDS, Supabase, etc.)
 *   - tests setean NODE_ENV=test y el runner de integración overridea
 *     DATABASE_URL al efímero 127.0.0.1:55432.
 */
const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1"]);

export function exigirHostLocal(nombreVariable: string): void {
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") return;

  const url = process.env[nombreVariable];
  if (!url) return;

  try {
    const parsed = new URL(url);
    if (!HOSTS_LOCALES.has(parsed.hostname)) {
      console.error(
        `${nombreVariable} apunta a un host externo (${parsed.hostname}). ` +
          "En desarrollo local debe apuntar a un PostgreSQL local (localhost/127.0.0.1). " +
          "Si .env tiene múltiples líneas de esta variable, la última gana — comenta las externas."
      );
      process.exit(1);
    }
  } catch {
    // URL malformada — Prisma fallará al conectar con un error claro
  }
}
