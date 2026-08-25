import { describe, expect, it } from "vitest";
import { esTimezoneIANA } from "../src/utils/validacion";

describe("validación de timezone IANA de obra", () => {
  it.each(["America/Matamoros", "America/Mexico_City", "America/New_York", "Europe/Madrid", "UTC"])("acepta %s", (zona) => {
    expect(esTimezoneIANA(zona)).toBe(true);
  });

  it.each(["America/FooBar", "UTC-5", "GMT-6", "CST", "CDT", "-05:00", "", " America/Matamoros ", "Etc/GMT+5"])("rechaza %s", (zona) => {
    expect(esTimezoneIANA(zona)).toBe(false);
  });
});
