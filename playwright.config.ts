import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";

/**
 * Etapa 6 - Configuración inicial E2E
 *
 * Notas:
 * - Los tests asumen Firebase emulators activos.
 * - Playwright levanta solo el frontend Vite.
 * - Para correrlos localmente:
 *   1. Terminal A: npm run firebase:start:dev
 *   2. Terminal B: npm run test:e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm --workspace packages/frontend run dev -- --host 127.0.0.1 --port 5173",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
