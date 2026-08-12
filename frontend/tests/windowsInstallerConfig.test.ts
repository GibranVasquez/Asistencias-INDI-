import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("configuración de seguridad del instalador Windows", () => {
  it("elimina el userData propio de INDI Asistencia al desinstalar", () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));

    expect(packageJson.build.win.target).toBe("nsis");
    expect(packageJson.build.nsis.deleteAppDataOnUninstall).toBe(true);
  });
});
