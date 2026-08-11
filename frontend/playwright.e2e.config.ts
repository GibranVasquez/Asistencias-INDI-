import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results/e2e",
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
