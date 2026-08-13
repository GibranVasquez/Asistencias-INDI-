import test from "node:test";
import assert from "node:assert/strict";
import { validarUrlMigracionLocal } from "./url-guard.mjs";

for (const url of [
  "postgresql://test:test@127.0.0.1:55432/indi_source_test",
  "postgresql://test:test@localhost:55433/indi_mexico_test",
  "postgresql://test:test@postgres-source-test:5432/indi_source_test",
  "postgresql://test:test@postgres-mexico-test:5432/indi_mexico_test",
]) test(`acepta ${new URL(url).hostname}`, () => assert.doesNotThrow(() => validarUrlMigracionLocal("URL", url)));

for (const url of [
  "postgresql://x:x@db.example.rds.amazonaws.com:5432/indi_source_test",
  "postgresql://x:x@db.supabase.co:5432/indi_source_test",
  "postgresql://x:x@api.sistemasindi.com:5432/indi_source_test",
  "postgresql://x:x@203.0.113.10:5432/indi_source_test",
  "postgresql://x:x@127.0.0.1:5432/production",
]) test("rechaza destino no local/de test", () => assert.throws(() => validarUrlMigracionLocal("URL", url)));
