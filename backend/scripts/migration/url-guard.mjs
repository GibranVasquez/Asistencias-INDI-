const HOSTS_PERMITIDOS = new Set(["localhost", "127.0.0.1", "postgres-source-test", "postgres-mexico-test"]);
const BASES_PERMITIDAS = new Set(["indi_source_test", "indi_mexico_test"]);
const PATRONES_PROHIBIDOS = [/\.rds\.amazonaws\.com/i, /supabase/i, /api\.sistemasindi\.com/i];

export function validarUrlMigracionLocal(nombre, valor) {
  if (!valor) throw new Error(`${nombre} es obligatoria`);
  if (PATRONES_PROHIBIDOS.some((patron) => patron.test(valor))) {
    throw new Error(`${nombre} rechazada: contiene un destino prohibido`);
  }
  let url;
  try { url = new URL(valor); } catch { throw new Error(`${nombre} no es una URL PostgreSQL válida`); }
  const base = url.pathname.replace(/^\//, "");
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !HOSTS_PERMITIDOS.has(url.hostname) || !BASES_PERMITIDAS.has(base)) {
    throw new Error(`${nombre} rechazada: solo se admiten hosts y bases locales explícitas de ensayo`);
  }
  return url;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  validarUrlMigracionLocal("SOURCE_DATABASE_URL", process.env.SOURCE_DATABASE_URL);
  validarUrlMigracionLocal("TARGET_DATABASE_URL", process.env.TARGET_DATABASE_URL);
  console.log("Guardas anti-producción: PASS");
}
