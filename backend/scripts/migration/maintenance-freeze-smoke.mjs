import { spawn } from "node:child_process";
import { once } from "node:events";
import pg from "pg";
import { validarUrlMigracionLocal } from "./url-guard.mjs";

const source = process.env.SOURCE_DATABASE_URL;
validarUrlMigracionLocal("SOURCE_DATABASE_URL", source);
const port = 45679, base = `http://127.0.0.1:${port}`;
const baseEnv = { ...process.env, DATABASE_URL:source, DIRECT_URL:source, MIGRATION_TEST_DB:"1", NODE_ENV:"test", PORT:String(port), JWT_SECRET:"migration-smoke-secret-fictitious", ALLOWED_ORIGIN:"http://127.0.0.1:5173", ADMS_IPS_PERMITIDAS:"127.0.0.1,::ffff:127.0.0.1" };

async function iniciar(mantenimiento) {
  const server=spawn(process.execPath,["dist/index.js"],{cwd:new URL("../../",import.meta.url),env:{...baseEnv,MAINTENANCE_MODE:mantenimiento},stdio:["ignore","pipe","pipe"]});
  for(let i=0;i<40;i++){try{if((await fetch(`${base}/health`)).ok)return server;}catch{/*arranque*/}await new Promise(r=>setTimeout(r,250));}
  server.kill(); throw new Error("backend no quedó saludable");
}
async function detener(server){server.kill("SIGTERM");await Promise.race([once(server,"exit"),new Promise(r=>setTimeout(r,2000))]);if(server.exitCode===null)server.kill("SIGKILL");}
async function login(path,username){const r=await fetch(`${base}${path}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username,password:"Migration-test-123!"})});if(!r.ok)throw new Error(`login normal falló ${r.status}`);return (await r.json()).token;}
async function firma(client){const tablas=["trabajadores","usuarios","asistencias_diarias","nominas_semanales","eventos_no_reconciliados","audit_log","terminales","asignaciones_diarias"];const out={};for(const t of tablas){const {rows:[r]}=await client.query(`SELECT count(*)::int n,md5(coalesce(string_agg(md5(row_to_json(x)::text),'' ORDER BY id::text),'')) h FROM ${client.escapeIdentifier(t)} x`);out[t]=r;}return out;}

const db=new pg.Client({connectionString:source}); await db.connect();
let server=await iniciar("false");
try{
  const [rh,terminal]=await Promise.all([login("/auth/login","migration-rh"),login("/auth/login-terminal","migration-kiosco")]);
  const control=await fetch(`${base}/asignaciones`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${rh}`},body:JSON.stringify({trabajadorIds:["20000000-0000-4000-8000-000000000120"],seccionId:"12000000-0000-4000-8000-000000000001",fecha:"2026-08-05"})});
  if(!control.ok)throw new Error(`escritura control normal falló ${control.status}`);
  await detener(server); server=await iniciar("true");
  const antes=await firma(db);
  const intentos=[
    fetch(`${base}/asistencias`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${terminal}`},body:"{}"}),
    fetch(`${base}/trabajadores/aplicar-sueldo`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${rh}`},body:"{}"}),
    fetch(`${base}/nominas`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${rh}`},body:"{}"}),
    fetch(`${base}/iclock/cdata?SN=SN-MIGRATION-TEST&options=all`),
    fetch(`${base}/iclock/cdata?SN=SN-MIGRATION-TEST&table=ATTLOG`,{method:"POST",headers:{"content-type":"text/plain"},body:"10001\t2026-08-05 08:00:00\t0\t1"}),
  ];
  for(const r of await Promise.all(intentos)){const b=await r.json();if(r.status!==503||b.error!=="MAINTENANCE_MODE")throw new Error("request no quedó congelada");}
  if(JSON.stringify(antes)!==JSON.stringify(await firma(db)))throw new Error("la base cambió durante mantenimiento");
  console.log("maintenance freeze: PASS (normal write, health, 5 blocked flows, database unchanged)");
} finally { await detener(server); await db.end(); }
