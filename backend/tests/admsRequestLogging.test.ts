import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registrarSolicitudAdms } from "../src/middlewares/admsRequestLogging";

const original = process.env.ADMS_REQUEST_LOGGING;
afterEach(() => {
  vi.restoreAllMocks();
  if (original === undefined) delete process.env.ADMS_REQUEST_LOGGING;
  else process.env.ADMS_REQUEST_LOGGING = original;
});

function appDePrueba() {
  const app = express();
  app.use("/iclock", registrarSolicitudAdms);
  app.post("/iclock/cdata", express.text({ type: () => true }), (_req, res) => res.status(201).send("OK"));
  return app;
}

describe("logging seguro de solicitudes ADMS", () => {
  it("registra ruta, SN y status final sin cuerpo", async () => {
    process.env.ADMS_REQUEST_LOGGING = "true";
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await request(appDePrueba()).post("/iclock/cdata?SN=SN-TEST").set("User-Agent", "S922").send("ATTLOG\n990001");
    expect(log).toHaveBeenCalledOnce();
    const mensaje = String(log.mock.calls[0][0]);
    expect(mensaje).toMatch(/ADMS_REQUEST timestamp=\d{4}-\d{2}-\d{2}T/);
    expect(mensaje).toContain("method=POST path=/iclock/cdata sn=SN-TEST");
    expect(mensaje).toContain("status=201");
    expect(mensaje).toContain("userAgent=\"S922\"");
    expect(mensaje).not.toContain("ATTLOG");
    expect(mensaje).not.toContain("990001");
  });

  it("observa rutas desconocidas y no registra nada con flag apagado", async () => {
    process.env.ADMS_REQUEST_LOGGING = "true";
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await request(appDePrueba()).get("/iclock/foo?SN=UNKNOWN");
    expect(log).toHaveBeenCalledOnce();
    expect(String(log.mock.calls[0][0])).toContain("status=404");
    log.mockClear();
    process.env.ADMS_REQUEST_LOGGING = "false";
    await request(appDePrueba()).get("/iclock/foo?SN=UNKNOWN");
    expect(log).not.toHaveBeenCalled();
  });
});
