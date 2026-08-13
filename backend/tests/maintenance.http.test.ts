import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { bloquearDuranteMantenimiento } from "../src/middlewares/maintenance";
import { mantenimientoActivo } from "../src/config/maintenance";

function appPrueba() { const app=express(); app.use(bloquearDuranteMantenimiento); app.get("/health",(_q,r)=>r.json({status:"ok"})); for(const m of ["post","put","patch","delete"] as const) app[m]("/dato",(_q,r)=>r.sendStatus(204)); return app; }
afterEach(() => delete process.env.MAINTENANCE_MODE);
describe("modo mantenimiento HTTP", () => {
  it("permite operación normal cuando falta o es false", async()=>{ expect((await request(appPrueba()).post("/dato")).status).toBe(204); process.env.MAINTENANCE_MODE="false"; expect((await request(appPrueba()).post("/dato")).status).toBe(204); });
  it.each(["post","put","patch","delete"] as const)("bloquea %s con respuesta estable", async(m)=>{ process.env.MAINTENANCE_MODE="true"; const r=await request(appPrueba())[m]("/dato"); expect(r.status).toBe(503); expect(r.body).toEqual({error:"MAINTENANCE_MODE",message:"El sistema se encuentra temporalmente en mantenimiento."}); });
  it("mantiene health disponible",async()=>{ process.env.MAINTENANCE_MODE="1"; expect((await request(appPrueba()).get("/health")).status).toBe(200); });
  it("rechaza configuración ambigua",()=>expect(()=>mantenimientoActivo("yes")).toThrow());
});
