import { esUrlPostgresLocal } from "./hostGuard";

interface TlsExternoVerificado {
  rejectUnauthorized: true;
  ca: string;
}

export interface ConfiguracionConexionPrisma {
  connectionString: string;
  ssl: false | TlsExternoVerificado;
}

const PARAMETROS_TLS = ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert", "sslnegotiation", "uselibpqcompat"];

function sinParametrosTls(valor: string): string {
  let parsed: URL;
  try {
    parsed = new URL(valor);
  } catch {
    throw new Error("DATABASE_URL no es una URL PostgreSQL válida. Operación abortada.");
  }
  for (const parametro of PARAMETROS_TLS) parsed.searchParams.delete(parametro);
  return parsed.toString();
}

export function crearConfiguracionConexionPrisma(databaseUrl: string, caExterna?: string): ConfiguracionConexionPrisma {
  const connectionString = sinParametrosTls(databaseUrl);
  if (esUrlPostgresLocal(databaseUrl)) return { connectionString, ssl: false };
  if (!caExterna) throw new Error("La conexión PostgreSQL externa requiere una CA de confianza explícita.");
  return { connectionString, ssl: { rejectUnauthorized: true, ca: caExterna } };
}
