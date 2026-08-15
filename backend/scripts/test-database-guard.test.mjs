import test from "node:test";
import assert from "node:assert/strict";
import { crearEntornoBaseE2E, TEST_DATABASE_URL, validarUrlBaseE2E, validarVariablesHeredadas } from "./test-database-guard.mjs";

test("acepta únicamente la base E2E local exacta", () => {
  assert.doesNotThrow(() => validarUrlBaseE2E("DATABASE_URL", TEST_DATABASE_URL));
  const entorno = crearEntornoBaseE2E({});
  assert.equal(entorno.DATABASE_URL, TEST_DATABASE_URL);
  assert.equal(entorno.DIRECT_URL, TEST_DATABASE_URL);
});

for (const valor of [
  "postgresql://x:x@db.supabase.co:5432/postgres",
  "postgresql://x:x@db.example.rds.amazonaws.com:5432/indi_test",
  "postgresql://x:x@203.0.113.10:5432/indi_test",
  "postgresql://x:x@localhost:5432/production",
]) {
  test(`rechaza destino no autorizado: ${new URL(valor).hostname}`, () => {
    assert.throws(() => validarUrlBaseE2E("DATABASE_URL", valor));
  });
}

test("rechaza DATABASE_URL o DIRECT_URL heredadas antes de crear el entorno hijo", () => {
  assert.throws(() => validarVariablesHeredadas({ DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: "postgresql://x:x@db.supabase.co/postgres" }));
  assert.throws(() => validarVariablesHeredadas({ DATABASE_URL: "postgresql://x:x@db.example.rds.amazonaws.com/indi_test", DIRECT_URL: TEST_DATABASE_URL }));
});
