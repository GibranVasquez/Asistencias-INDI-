export const TEST_DATABASE_URL = "postgresql://indi_test:indi_test_only@127.0.0.1:55432/indi_test";

const PATRONES_PROHIBIDOS = [/\.rds\.amazonaws\.com/i, /supabase/i, /api\.sistemasindi\.com/i];

export function validarUrlBaseE2E(nombre, valor) {
  if (!valor) throw new Error(`${nombre} es obligatoria para comandos de base de datos de test.`);
  if (PATRONES_PROHIBIDOS.some((patron) => patron.test(valor))) {
    throw new Error(`${nombre} rechazada: contiene un destino externo/prohibido.`);
  }

  let url;
  try {
    url = new URL(valor);
  } catch {
    throw new Error(`${nombre} rechazada: no es una URL PostgreSQL válida.`);
  }

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "55432" ||
    url.pathname !== "/indi_test"
  ) {
    throw new Error(`${nombre} rechazada: solo se admite 127.0.0.1:55432/indi_test.`);
  }
  return url;
}

export function validarVariablesHeredadas(entorno) {
  for (const nombre of ["DATABASE_URL", "DIRECT_URL"]) {
    const valor = entorno[nombre];
    if (valor !== undefined) validarUrlBaseE2E(nombre, valor);
  }
}

export function crearEntornoBaseE2E(entorno = process.env) {
  validarVariablesHeredadas(entorno);
  validarUrlBaseE2E("DATABASE_URL", TEST_DATABASE_URL);
  validarUrlBaseE2E("DIRECT_URL", TEST_DATABASE_URL);
  return {
    ...entorno,
    NODE_ENV: "test",
    INTEGRATION_TEST_DB: "1",
    DATABASE_URL: TEST_DATABASE_URL,
    DIRECT_URL: TEST_DATABASE_URL,
  };
}
