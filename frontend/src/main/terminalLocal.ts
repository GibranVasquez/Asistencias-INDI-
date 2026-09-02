import { app, ipcMain } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
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
  ipcMain.handle("terminal-local:descubrir", async (_event, terminales: unknown) => {
    const lista = Array.isArray(terminales) ? terminales.filter((t): t is { id: string; numeroSerie?: string | null } => Boolean(t && typeof t === "object" && typeof (t as Record<string, unknown>).id === "string")) : [];
    const vecinos = await new Promise<string[]>((resolve) => {
      execFile("ip", ["neigh"], { timeout: 3000 }, (_error, stdout) => resolve(stdout.split("\n").map((l) => l.match(/^(\d+\.\d+\.\d+\.\d+) /)?.[1]).filter((v): v is string => Boolean(v))));
    }).catch(() => []);
    const configuraciones = leer();
    const hosts = [...new Set([...vecinos, ...Object.values(configuraciones).map((v) => (v && typeof v === "object" ? (v as Record<string, unknown>).host : null)).filter((v): v is string => typeof v === "string")])];
    const encontrados: { terminalId: string | null; serial: string; host: string; puerto: number; model?: string | null; firmware?: string | null }[] = [];
    for (const host of hosts.slice(0, 32)) { try { const info = await ZKTecoS922Adapter.probarConexion({ adapterKey: "zkteco-s922", host, puerto: 4370 }); const terminal = lista.filter((t) => t.numeroSerie === info.serial); encontrados.push({ terminalId: terminal.length === 1 ? terminal[0].id : null, serial: info.serial, host, puerto: 4370, model: info.model, firmware: info.firmware }); } catch { /* candidatos no ZKTeco */ } }
    return encontrados;
  });
}
