import { readFileSync } from "fs";
import { join } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { exigirHostLocal } from "../config/hostGuard";

// Tanto el pooler de Supabase como RDS presentan cadenas firmadas por su
// propia CA privada (ninguna está en el almacén de CAs por default de
// Node) — con solo `rejectUnauthorized: true` la conexión falla con
// "self-signed certificate in certificate chain". En vez de relajar la
// verificación (rejectUnauthorized: false), se fija la CA correcta como
// ancla de confianza explícita según a qué proveedor apunte DATABASE_URL
// realmente — necesario desde que el ECS de producción empezó a apuntar a
// RDS (secrets.tf) mientras el desarrollo local sigue contra Supabase
// (backend/.env): un CA fijo para ambos casos rompía uno de los dos
// (bug real encontrado en producción 2026-07-30 - toda query fallaba tras
// el primer deploy a ECS, oculto detrás de un 500 genérico porque
// NODE_ENV=production esconde el mensaje real en errorHandler.ts).
// certs/supabase-root-2021-ca.pem y certs/rds-global-bundle.pem se
// extrajeron/descargaron y verificaron contra la cadena real de cada
// proveedor (`openssl s_client -showcerts` + `openssl verify` para
// Supabase; el bundle público de AWS para RDS) - ninguno es un cert de
// terceros sin auditar. Son información pública (CAs raíz, no
// credenciales), seguras de tener en el repo.
//
// DB_CA_PATH permite un override explícito (nombre de archivo dentro de
// certs/) para el caso de un tercer proveedor futuro sin tener que tocar
// este archivo otra vez; sin esa variable, se infiere del host en
// DATABASE_URL - RDS siempre usa el dominio *.rds.amazonaws.com.
//
// Ruta vía __dirname, no process.cwd(): cwd depende de desde dónde se
// lanza el proceso (se rompe con un gestor de procesos o contenedor que
// use un working directory distinto a backend/), __dirname depende de
// dónde vive este archivo, que es estable. Con rootDir:"src" en
// tsconfig.json (ver ese archivo), dist/ espeja src/ 1:1 — este archivo
// vive en src/utils/ en dev (ts-node-dev) y en dist/utils/ en el build
// compilado, misma profundidad relativa a backend/ en ambos casos, así
// que ../../ desde __dirname llega a backend/ en los dos entornos.
function resolverArchivoCA(): string {
  if (process.env.DB_CA_PATH) return process.env.DB_CA_PATH;
  const url = process.env.DATABASE_URL;
  // Explícito, no silencioso: este módulo se importa (y este código corre)
  // antes de que validarVariablesDeEntorno() alcance a ejecutarse en
  // app.ts (el import de ./routes precede a esa llamada) - ese chequeo NO
  // protege esta rama. Sin esto, un DATABASE_URL vacío caía por default a
  // supabase-root-2021-ca.pem sin ningún aviso.
  if (!url) {
    throw new Error(
      "DATABASE_URL no está definida - no se puede determinar el CA de confianza correcto para la conexión a la base de datos."
    );
  }
  return url.includes(".rds.amazonaws.com") ? "rds-global-bundle.pem" : "supabase-root-2021-ca.pem";
}

const URL_INTEGRACION_LOCAL = "postgresql://indi_test:indi_test_only@127.0.0.1:55432/indi_test";
const esIntegracionLocal = process.env.INTEGRATION_TEST_DB === "1";
const URL_MIGRACION_LOCAL = "postgresql://indi_migration_test:migration_test_only@127.0.0.1:55433/indi_mexico_test";
const URL_MIGRACION_SOURCE_LOCAL = "postgresql://indi_migration_test:migration_test_only@127.0.0.1:55432/indi_source_test";
const esEnsayoMigracionLocal = process.env.MIGRATION_TEST_DB === "1";

// Este módulo se carga desde los routers antes de que app.ts alcance su
// validación general. La guarda debe ejecutarse aquí, antes de construir el
// adapter o PrismaClient, para que tampoco exista una ventana de conexión.
exigirHostLocal("DATABASE_URL");

if (esIntegracionLocal && process.env.DATABASE_URL !== URL_INTEGRACION_LOCAL) {
  throw new Error(
    "INTEGRATION_TEST_DB=1 solo admite la base efímera exacta en 127.0.0.1:55432/indi_test. Operación abortada."
  );
}
if (esEnsayoMigracionLocal && ![URL_MIGRACION_LOCAL, URL_MIGRACION_SOURCE_LOCAL].includes(process.env.DATABASE_URL ?? "")) {
  throw new Error(
    "MIGRATION_TEST_DB=1 solo admite source/destination efímeros exactos del ensayo. Operación abortada."
  );
}

// PostgreSQL efímero de integración no usa TLS y solo se admite detrás de
// la guardia exacta anterior. Cualquier ejecución normal conserva la CA y
// verificación TLS estricta existente; no hay fallback inseguro.
const adapter = esIntegracionLocal || esEnsayoMigracionLocal
  ? new PrismaPg({ connectionString: esIntegracionLocal ? URL_INTEGRACION_LOCAL : process.env.DATABASE_URL! })
  : (() => {
      const ca = readFileSync(join(__dirname, "..", "..", "certs", resolverArchivoCA()));
      return new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: true, ca: ca.toString() },
      });
    })();

export const prisma = new PrismaClient({ adapter });
