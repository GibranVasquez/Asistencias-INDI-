const REQUIRED_ENV_VARS = ["DATABASE_URL", "JWT_SECRET", "ALLOWED_ORIGIN"] as const;

const HOSTS_EXTERNOS = [/\.rds\.amazonaws\.com$/i, /\.supabase\.(com|co)$/i, /sistemasindi\.com$/i];

export function validarVariablesDeEntorno(): void {
  const faltantes = REQUIRED_ENV_VARS.filter((nombre) => !process.env[nombre]?.trim());

  if (faltantes.length > 0) {
    console.error(
      `No se puede iniciar el servidor: faltan variables de entorno requeridas: ${faltantes.join(", ")}. ` +
        "Revisa tu archivo .env (usa .env.example como referencia)."
    );
    process.exit(1);
  }

  // En desarrollo local, DATABASE_URL debe apuntar a PostgreSQL local.
  // Evita que `npm run dev` arranque silenciosamente contra Supabase/RDS
  // cuando .env tiene definiciones duplicadas (dotenv usa last-wins).
  const esProduccion = process.env.NODE_ENV === "production";
  const esTest = process.env.NODE_ENV === "test";
  if (!esProduccion && !esTest) {
    const url = process.env.DATABASE_URL;
    if (url) {
      try {
        const parsed = new URL(url);
        if (HOSTS_EXTERNOS.some((patron) => patron.test(parsed.hostname))) {
          console.error(
            `DATABASE_URL apunta a un host externo (${parsed.hostname}). ` +
              "En desarrollo local debe apuntar a un PostgreSQL local (localhost/127.0.0.1). " +
              "Si .env tiene múltiples líneas DATABASE_URL, la última gana — comenta las externas."
          );
          process.exit(1);
        }
      } catch {
        // URL malformada — Prisma fallará al conectar con un error claro
      }
    }
  }

  const mantenimiento = process.env.MAINTENANCE_MODE;
  if (mantenimiento && !["true", "false", "1", "0"].includes(mantenimiento.toLowerCase())) {
    console.error("MAINTENANCE_MODE debe ser true, false, 1 o 0.");
    process.exit(1);
  }
}
