import { spawn } from "node:child_process";
import { once } from "node:events";
import { validarUrlMigracionLocal } from "./url-guard.mjs";

const target = process.env.TARGET_DATABASE_URL;
validarUrlMigracionLocal("TARGET_DATABASE_URL", target);
const port = 45678;
const server = spawn(process.execPath, ["dist/index.js"], { cwd: new URL("../../", import.meta.url), env: { ...process.env, DATABASE_URL: target, DIRECT_URL: target, MIGRATION_TEST_DB: "1", NODE_ENV: "test", PORT: String(port), JWT_SECRET: "migration-smoke-secret-fictitious", ALLOWED_ORIGIN: "http://127.0.0.1:5173", ADMS_IPS_PERMITIDAS: "127.0.0.1" }, stdio: ["ignore", "pipe", "pipe"] });
const base = `http://127.0.0.1:${port}`;
async function esperar() { for (let i=0;i<40;i++) { try { const r=await fetch(`${base}/health`); if(r.ok)return; } catch { /* El proceso aún está arrancando; se reintenta hasta el límite explícito. */ } await new Promise(r=>setTimeout(r,250)); } throw new Error("backend no quedó saludable"); }
try {
  await esperar();
  const health = await fetch(`${base}/health`);
  if (!health.ok || (await health.json()).status !== "ok") throw new Error("health falló");
  const login = await fetch(`${base}/auth/login`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ username:"migration-rh", password:"Migration-test-123!" }) });
  if (!login.ok) throw new Error(`login falló: ${login.status}`);
  const { token } = await login.json();
  for (const path of ["/trabajadores", "/asistencias", "/nominas", "/reportes/nomina?desde=2026-08-03&hasta=2026-08-09"]) {
    const r=await fetch(`${base}${path}`, { headers:{ authorization:`Bearer ${token}` } });
    if(!r.ok) throw new Error(`${path} falló: ${r.status}`);
  }
  const terminal = await fetch(`${base}/auth/login-terminal`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ username:"migration-kiosco", password:"Migration-test-123!" }) });
  if(!terminal.ok) throw new Error(`terminal falló: ${terminal.status}`);
  console.log("backend smoke: PASS (health, login RH, trabajadores, asistencias, nómina, reporte, terminal)");
} finally {
  server.kill("SIGTERM");
  await Promise.race([once(server,"exit"), new Promise(r=>setTimeout(r,2000))]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
