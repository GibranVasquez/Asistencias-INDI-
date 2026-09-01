import { app, ipcMain } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ZKTecoS922Adapter } from "./terminalAdapters/ZKTecoS922Adapter";
import { TerminalConnectionConfig } from "./terminalAdapters/types";

const archivo = () => join(app.getPath("userData"), "terminales-local.json");
function validar(config: unknown): TerminalConnectionConfig & { terminalId: string } {
  if (!config || typeof config !== "object") throw new Error("Configuración inválida.");
  const c = config as Record<string, unknown>;
  if (typeof c.terminalId !== "string" || typeof c.adapterKey !== "string" || typeof c.host !== "string" || !Number.isInteger(c.puerto)) throw new Error("Configuración incompleta.");
  if (c.adapterKey !== "zkteco-s922") throw new Error("Adaptador no permitido.");
  return { terminalId: c.terminalId, adapterKey: c.adapterKey, host: c.host.trim(), puerto: c.puerto as number, numeroSerieEsperado: typeof c.numeroSerieEsperado === "string" ? c.numeroSerieEsperado : null };
}
function leer(): Record<string, unknown> { const ruta = archivo(); if (!existsSync(ruta)) return {}; try { return JSON.parse(readFileSync(ruta, "utf8")) as Record<string, unknown>; } catch { return {}; } }
export function registrarHandlersTerminalLocal(): void {
  ipcMain.handle("terminal-local:leer-config", (_event, terminalId: string) => typeof terminalId === "string" ? leer()[terminalId] ?? null : null);
  ipcMain.handle("terminal-local:guardar-config", (_event, config: unknown) => { const c = validar(config); const datos = leer(); datos[c.terminalId] = c; mkdirSync(app.getPath("userData"), { recursive: true }); writeFileSync(archivo(), JSON.stringify(datos, null, 2), "utf8"); return c; });
  ipcMain.handle("terminal-local:probar", async (_event, config: unknown) => { const c = validar(config); return ZKTecoS922Adapter.probarConexion(c); });
  ipcMain.handle("terminal-local:descargar", async (_event, config: unknown) => { const c = validar(config); return ZKTecoS922Adapter.descargarMarcaciones(c); });
}
