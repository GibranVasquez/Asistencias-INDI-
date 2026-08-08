import { spawnSync } from "node:child_process";

const TEST_DATABASE_URL = "postgresql://indi_test:indi_test_only@127.0.0.1:55432/indi_test";

if (process.env.DATABASE_URL && process.env.DATABASE_URL !== TEST_DATABASE_URL) {
  console.error("Se rechazó DATABASE_URL: test:integration solo opera sobre 127.0.0.1:55432/indi_test.");
  process.exit(1);
}

const env = {
  ...process.env,
  NODE_ENV: "test",
  INTEGRATION_TEST_DB: "1",
  DATABASE_URL: TEST_DATABASE_URL,
  DIRECT_URL: TEST_DATABASE_URL,
  JWT_SECRET: "integration-test-secret-not-for-production",
  ALLOWED_ORIGIN: "http://127.0.0.1:5173",
  ADMS_IPS_PERMITIDAS: "127.0.0.1,::ffff:127.0.0.1",
};

function ejecutar(comando, argumentos) {
  const resultado = spawnSync(comando, argumentos, { env, stdio: "inherit", shell: process.platform === "win32" });
  if (resultado.status !== 0) process.exit(resultado.status ?? 1);
}

// migrate deploy es aditivo; nunca se usa migrate reset. La limpieza de datos
// ocurre dentro de la suite y solo después de que utils/prisma repite la misma
// validación de URL exacta.
ejecutar("npx", ["prisma", "migrate", "deploy"]);
ejecutar("npx", ["vitest", "run", "--config", "vitest.integration.config.mjs"]);
