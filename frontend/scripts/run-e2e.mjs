import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(frontend, "../backend");
const databaseUrl = "postgresql://indi_test:indi_test_only@127.0.0.1:55432/indi_test";
const apiUrl = "http://127.0.0.1:44100";
const prohibidos = /rds\.amazonaws\.com|supabase|api\.sistemasindi\.com/i;

if (prohibidos.test(databaseUrl) || new URL(databaseUrl).hostname !== "127.0.0.1" || new URL(databaseUrl).pathname !== "/indi_test") {
  throw new Error("E2E abortado: DATABASE_URL no identifica PostgreSQL local indi_test.");
}
for (const variable of ["DATABASE_URL", "DIRECT_URL"]) {
  const heredada = process.env[variable];
  if (heredada && heredada !== databaseUrl) {
    throw new Error(`E2E abortado: ${variable} heredada no coincide con PostgreSQL local indi_test.`);
  }
}

const entornoBackend = {
  ...process.env,
  NODE_ENV: "test",
  INTEGRATION_TEST_DB: "1",
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
  JWT_SECRET: "e2e-only-jwt-secret-not-for-production-2026",
  ALLOWED_ORIGIN: "null",
  ADMS_IPS_PERMITIDAS: "127.0.0.1,::ffff:127.0.0.1",
  PORT: "44100",
};

function ejecutar(comando, argumentos, cwd, env = process.env) {
  return new Promise((resolvePromise, reject) => {
    const hijo = spawn(comando, argumentos, { cwd, env, stdio: "inherit" });
    hijo.once("error", reject);
    hijo.once("exit", (codigo, senal) => {
      if (codigo === 0) resolvePromise();
      else reject(new Error(`${comando} ${argumentos.join(" ")} terminó con ${codigo ?? senal}`));
    });
  });
}

async function esperarBackend() {
  const limite = Date.now() + 20_000;
  let ultimoError;
  while (Date.now() < limite) {
    try {
      const respuesta = await fetch(`${apiUrl}/health`);
      if (respuesta.ok) return;
    } catch (error) {
      ultimoError = error;
    }
    await new Promise((resolver) => setTimeout(resolver, 150));
  }
  throw new Error(`Backend E2E no respondió a tiempo: ${String(ultimoError ?? "sin respuesta")}`);
}

const perfilRaiz = await mkdtemp(join(tmpdir(), "indi-e2e-run-"));
let backendProceso;
let dockerIniciado = false;

try {
  await ejecutar("npm", ["run", "test:db:up"], backend);
  dockerIniciado = true;
  await ejecutar("npx", ["prisma", "migrate", "deploy"], backend, entornoBackend);
  await ejecutar("npx", ["ts-node", "scripts/seed-e2e.ts"], backend, entornoBackend);
  await ejecutar("npm", ["run", "build"], backend, entornoBackend);
  await ejecutar("npm", ["run", "build"], frontend, { ...process.env, INDI_API_BASE_URL: apiUrl });

  backendProceso = spawn("node", ["dist/index.js"], { cwd: backend, env: entornoBackend, stdio: "inherit" });
  await esperarBackend();
  await ejecutar("npx", ["playwright", "test", "--config", "playwright.e2e.config.ts", ...process.argv.slice(2)], frontend, {
    ...process.env,
    NODE_ENV: "test",
    INDI_E2E_API_URL: apiUrl,
    INDI_E2E_USER_DATA_ROOT: perfilRaiz,
    INTEGRATION_TEST_DB: "1",
    DATABASE_URL: databaseUrl,
  });
} finally {
  if (backendProceso && backendProceso.exitCode === null) {
    backendProceso.kill("SIGTERM");
    await new Promise((resolver) => {
      const limite = setTimeout(() => {
        if (backendProceso.exitCode === null) backendProceso.kill("SIGKILL");
        resolver();
      }, 3_000);
      backendProceso.once("exit", () => {
        clearTimeout(limite);
        resolver();
      });
    });
  }
  if (dockerIniciado) {
    await ejecutar("npm", ["run", "test:db:down"], backend).catch((error) => console.error(error));
  }
  const temporalReal = resolve(tmpdir());
  if (resolve(perfilRaiz).startsWith(`${temporalReal}/indi-e2e-run-`)) {
    await rm(perfilRaiz, { recursive: true, force: true });
  }
}
