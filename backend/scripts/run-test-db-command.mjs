import { spawnSync } from "node:child_process";
import { crearEntornoBaseE2E } from "./test-database-guard.mjs";

const accion = process.argv[2];
const comandos = {
  migrate: ["npx", ["prisma", "migrate", "deploy"]],
  seed: ["npx", ["ts-node", "scripts/seed-e2e.ts"]],
};

if (!comandos[accion]) {
  console.error("Uso: node scripts/run-test-db-command.mjs <migrate|seed>");
  process.exit(2);
}

let env;
try {
  env = crearEntornoBaseE2E(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const [comando, argumentos] = comandos[accion];
const resultado = spawnSync(comando, argumentos, { env, stdio: "inherit", shell: process.platform === "win32" });
process.exit(resultado.status ?? 1);
