import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { app } from "electron";
import { join } from "node:path";
import { InfoTerminalLocal, MarcacionTerminalNormalizada, TerminalAdapter, TerminalConnectionConfig } from "./types";
import { mapearPunchS922 } from "./punchMapping";

function rutasHelper(): { ejecutable: string; python?: string; args: (operacion: string, config: TerminalConnectionConfig) => string[] }[] {
  const base = app.isPackaged ? join(process.resourcesPath, "terminal-adapters") : join(app.getAppPath(), "resources", "terminal-adapters");
  const autocontenido = join(base, process.platform === "win32" ? "zk_readonly.exe" : "zk_readonly");
  const script = join(base, "zk_readonly.py");
  const candidatos: { ejecutable: string; python?: string; args: (operacion: string, config: TerminalConnectionConfig) => string[] }[] = [];
  if (existsSync(autocontenido)) candidatos.push({ ejecutable: autocontenido, args: (op, c) => [op, c.host, String(c.puerto)] });
  if (existsSync(script)) {
    const interpretes = [process.env.INDI_ZK_PYTHON, process.env.HOME ? join(process.env.HOME, "zk-test", "bin", process.platform === "win32" ? "python.exe" : "python") : undefined, process.platform === "win32" ? "python" : "python3"].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i);
    for (const python of interpretes) candidatos.push({ ejecutable: python, python, args: (op, c) => [script, op, c.host, String(c.puerto)] });
  }
  return candidatos;
}
function ejecutar(operacion: string, config: TerminalConnectionConfig): Promise<{ serial: string; model?: string; firmware?: string; records?: MarcacionTerminalNormalizada[] }> {
  if (config.adapterKey !== "zkteco-s922") return Promise.reject(new Error("Adaptador no permitido."));
  if (!config.host || !Number.isInteger(config.puerto) || config.puerto < 1 || config.puerto > 65535) return Promise.reject(new Error("Host o puerto inválido."));
  const candidatos = rutasHelper();
  if (!candidatos.length) return Promise.reject(new Error("El conector ZKTeco no está disponible."));
  return new Promise((resolve, reject) => {
    const candidato = candidatos[0];
    const child = spawn(candidato.ejecutable, candidato.args(operacion, config), { stdio: ["ignore", "pipe", "pipe"], shell: false });
    let stdout = ""; let stderr = "";
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("La conexión con el terminal agotó el tiempo de espera.")); }, 30_000);
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); if (code !== 0) { reject(new Error(operacion === "health" ? "El conector ZKTeco no está disponible." : (stderr.trim() || "No se pudo leer el terminal."))); return; } try { const value = JSON.parse(stdout); if (!value.ok || typeof value.serial !== "string") throw new Error(value.error || "Respuesta inválida del helper."); resolve(value); } catch (error) { reject(error instanceof Error ? error : new Error("Respuesta inválida del helper.")); } });
  });
}

export async function comprobarConectorZKTeco(): Promise<boolean> {
  try { await ejecutar("health", { adapterKey: "zkteco-s922", host: "127.0.0.1", puerto: 4370 }); return true; } catch { return false; }
}

function validarSerial(info: InfoTerminalLocal, esperado?: string | null): InfoTerminalLocal { if (esperado && info.serial !== esperado) throw new Error("El dispositivo conectado no corresponde al terminal seleccionado."); return info; }
export const ZKTecoS922Adapter: TerminalAdapter = {
  async probarConexion(config) { if (!(await comprobarConectorZKTeco())) throw new Error("El conector ZKTeco no está disponible."); return validarSerial(await ejecutar("info", config), config.numeroSerieEsperado); },
  async descargarMarcaciones(config) {
    if (!(await comprobarConectorZKTeco())) throw new Error("El conector ZKTeco no está disponible.");
    const value = await ejecutar("attendance", config);
    const info = validarSerial(value, config.numeroSerieEsperado);
    return { info, marcaciones: (value.records ?? []).map((record) => ({ ...record, tipoMarcacion: mapearPunchS922(record.codigoCrudo) })) };
  },
};
