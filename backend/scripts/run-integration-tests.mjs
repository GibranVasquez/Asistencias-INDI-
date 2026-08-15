import { spawnSync } from "node:child_process";
import { crearEntornoBaseE2E } from "./test-database-guard.mjs";

let env;
try {
  env = {
    ...crearEntornoBaseE2E(process.env),
    JWT_SECRET: "integration-test-secret-not-for-production",
    ALLOWED_ORIGIN: "http://127.0.0.1:5173",
    ADMS_IPS_PERMITIDAS: "127.0.0.1,::ffff:127.0.0.1",
  };
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

function ejecutar(comando, argumentos) {
  const resultado = spawnSync(comando, argumentos, { env, stdio: "inherit", shell: process.platform === "win32" });
  if (resultado.status !== 0) process.exit(resultado.status ?? 1);
}

// migrate deploy es aditivo; nunca se usa migrate reset. La limpieza de datos
// ocurre dentro de la suite y solo después de que utils/prisma repite la misma
// validación de URL exacta.
ejecutar("npx", ["prisma", "migrate", "deploy"]);
ejecutar("npx", ["vitest", "run", "--config", "vitest.integration.config.mjs"]);
