import { readFileSync } from "fs";
import { join } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// El pooler de Supabase presenta una cadena firmada por su propia CA privada
// ("Supabase Root 2021 CA"), que no está en el almacén de CAs por default de
// Node — con solo `rejectUnauthorized: true` la conexión falla con
// "self-signed certificate in certificate chain". En vez de relajar la
// verificación (rejectUnauthorized: false), se fija esta CA como ancla de
// confianza explícita: certs/supabase-root-2021-ca.pem se extrajo y
// verificó contra la cadena real que sirve el pooler (`openssl s_client
// -showcerts` + `openssl verify`), no es un cert de terceros sin auditar.
// Es información pública (la CA raíz, no una credencial), segura de tener
// en el repo.
//
// Ruta vía __dirname, no process.cwd(): cwd depende de desde dónde se
// lanza el proceso (se rompe con un gestor de procesos o contenedor que
// use un working directory distinto a backend/), __dirname depende de
// dónde vive este archivo, que es estable. Con rootDir:"src" en
// tsconfig.json (ver ese archivo), dist/ espeja src/ 1:1 — este archivo
// vive en src/utils/ en dev (ts-node-dev) y en dist/utils/ en el build
// compilado, misma profundidad relativa a backend/ en ambos casos, así
// que ../../ desde __dirname llega a backend/ en los dos entornos.
const caSupabase = readFileSync(join(__dirname, "..", "..", "certs", "supabase-root-2021-ca.pem"));

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true, ca: caSupabase.toString() },
});

export const prisma = new PrismaClient({ adapter });
