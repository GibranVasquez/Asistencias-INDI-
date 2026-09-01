import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { app } from "electron";
import { join } from "node:path";
import { InfoTerminalLocal, MarcacionTerminalNormalizada, TerminalAdapter, TerminalConnectionConfig } from "./types";
import { mapearPunchS922 } from "./punchMapping";

function rutaHelper(): string { return app.isPackaged ? join(process.resourcesPath, "terminal-adapters", "zk_readonly.py") : join(app.getAppPath(), "resources", "terminal-adapters", "zk_readonly.py"); }
function ejecutar(operacion: string, config: TerminalConnectionConfig): Promise<{ serial: string; model?: string; firmware?: string; records?: MarcacionTerminalNormalizada[] }> {
  if (config.adapterKey !== "zkteco-s922") return Promise.reject(new Error("Adaptador no permitido."));
  if (!config.host || !Number.isInteger(config.puerto) || config.puerto < 1 || config.puerto > 65535) return Promise.reject(new Error("Host o puerto inválido."));
  const helper = rutaHelper();
  const python = process.env.INDI_ZK_PYTHON || "python3";
  if (!existsSync(helper)) return Promise.reject(new Error("No se encontró el helper local de ZKTeco."));
  return new Promise((resolve, reject) => {
    const child = spawn(python, [helper, operacion, config.host, String(config.puerto)], { stdio: ["ignore", "pipe", "pipe"], shell: false });
    let stdout = ""; let stderr = "";
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("La conexión con el terminal agotó el tiempo de espera.")); }, 30_000);
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); if (code !== 0) { reject(new Error(stderr.trim() || "El helper no pudo leer el terminal.")); return; } try { const value = JSON.parse(stdout); if (!value.ok || typeof value.serial !== "string") throw new Error(value.error || "Respuesta inválida del helper."); resolve(value); } catch (error) { reject(error instanceof Error ? error : new Error("Respuesta inválida del helper.")); } });
  });
}

function validarSerial(info: InfoTerminalLocal, esperado?: string | null): InfoTerminalLocal { if (esperado && info.serial !== esperado) throw new Error("El dispositivo conectado no corresponde al terminal seleccionado."); return info; }
export const ZKTecoS922Adapter: TerminalAdapter = {
  async probarConexion(config) { return validarSerial(await ejecutar("info", config), config.numeroSerieEsperado); },
  async descargarMarcaciones(config) {
    const value = await ejecutar("attendance", config);
    const info = validarSerial(value, config.numeroSerieEsperado);
    return { info, marcaciones: (value.records ?? []).map((record) => ({ ...record, tipoMarcacion: mapearPunchS922(record.codigoCrudo) })) };
  },
};
