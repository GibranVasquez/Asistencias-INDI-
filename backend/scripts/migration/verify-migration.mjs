import pg from "pg";
import { validarUrlMigracionLocal } from "./url-guard.mjs";

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;
validarUrlMigracionLocal("SOURCE_DATABASE_URL", sourceUrl);
validarUrlMigracionLocal("TARGET_DATABASE_URL", targetUrl);

const source = new pg.Client({ connectionString: sourceUrl });
const target = new pg.Client({ connectionString: targetUrl });
const tablas = ["_prisma_migrations","_SeccionEncargados","usuarios","trabajadores","categorias_trabajador","obras","secciones","horarios","asistencias_diarias","asignaciones_diarias","tipos_movimiento","movimientos_trabajador","tarifas_hora_extra","nominas_semanales","terminales","eventos_no_reconciliados","audit_log"];

async function resumen(client, tabla) {
  const orden = tabla === "_SeccionEncargados" ? '"A"::text||\':\'||"B"::text' : "id::text";
  const { rows: [row] } = await client.query(`SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY ${orden}), '')) AS checksum FROM ${client.escapeIdentifier(tabla)} t`);
  return row;
}

async function metadatos(client) {
  const constraints = await client.query("SELECT count(*)::int AS n, md5(string_agg(c.conname||':'||pg_get_constraintdef(c.oid), E'\\n' ORDER BY c.conname)) AS checksum FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'");
  const indexes = await client.query("SELECT count(*)::int AS n, md5(string_agg(indexname||':'||indexdef, E'\\n' ORDER BY indexname)) AS checksum FROM pg_indexes WHERE schemaname='public'");
  const enums = await client.query("SELECT count(*)::int AS n, md5(string_agg(t.typname||':'||e.enumlabel, E'\\n' ORDER BY t.typname,e.enumsortorder)) AS checksum FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' AND t.typtype='e'");
  const sequences = await client.query("SELECT count(*)::int AS n FROM pg_sequences WHERE schemaname='public'");
  return { constraints: constraints.rows[0], indexes: indexes.rows[0], enums: enums.rows[0], sequences: sequences.rows[0].n };
}

let ok = true;
try {
  await Promise.all([source.connect(), target.connect()]);
  for (const tabla of tablas) {
    const [a, b] = await Promise.all([resumen(source, tabla), resumen(target, tabla)]);
    const match = a.count === b.count && a.checksum === b.checksum;
    console.log(`${tabla}: source=${a.count} target=${b.count} checksum=${match ? "MATCH" : "MISMATCH"}`);
    ok &&= match;
  }
  const [a, b] = await Promise.all([metadatos(source), metadatos(target)]);
  const schemaMatch = JSON.stringify(a) === JSON.stringify(b);
  console.log(`schema: ${schemaMatch ? "MATCH" : "MISMATCH"} constraints=${b.constraints.n} indexes=${b.indexes.n} enums=${b.enums.n} sequences=${b.sequences}`);
  ok &&= schemaMatch;
  const prismaRows = await target.query('SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
  console.log(`prisma migrations: ${prismaRows.rows[0].n > 0 ? "PASS" : "FAIL"} (${prismaRows.rows[0].n})`);
  ok &&= prismaRows.rows[0].n > 0;
} finally {
  await Promise.allSettled([source.end(), target.end()]);
}
if (!ok) process.exit(1);
console.log("row counts: MATCH\nlogical checksums: MATCH\ncritical constraints: MATCH\nPrisma connectivity: PASS");
