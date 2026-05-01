import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./specs-lit",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5174",
    headless: true,
  },
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  webServer: {
    command: "pnpm --dir lit-app dev",
    url: "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
