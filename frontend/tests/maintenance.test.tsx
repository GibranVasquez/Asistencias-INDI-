// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "@/core/api/client";
import { MaintenanceProvider, useMaintenance } from "@/app/providers/MaintenanceProvider";
import MaintenanceScreen from "@/app/components/MaintenanceScreen";

function Estado() { return useMaintenance() ? <MaintenanceScreen/> : <div>Operación normal</div>; }
afterEach(()=>vi.unstubAllGlobals());
describe("mantenimiento frontend",()=>{
  it("distingue MAINTENANCE_MODE sin convertirlo en auth/logout",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,status:503,json:async()=>({error:"MAINTENANCE_MODE",message:"El sistema se encuentra temporalmente en mantenimiento."})}));
    render(<MaintenanceProvider><Estado/></MaintenanceProvider>);
    const error=await apiClient.post("/asistencias",{},"token-ficticio").catch(e=>e);
    expect(error).toBeInstanceOf(ApiError); expect(error.code).toBe("MAINTENANCE_MODE"); expect(error.status).toBe(503);
    await waitFor(()=>expect(screen.getByRole("main",{name:"Sistema en mantenimiento"})).toBeTruthy());
    expect(screen.getByText(/No se están registrando cambios/)).toBeTruthy();
    expect(screen.queryByText(/PostgreSQL|AWS|stack/i)).toBeNull();
  });
});
