import { defineConfig } from "@playwright/test";

/**
 * El entorno trae Chromium preinstalado en PLAYWRIGHT_BROWSERS_PATH, pero con
 * un build distinto al que espera esta versión de @playwright/test. Se apunta
 * al binario existente en vez de descargar uno nuevo.
 */
const CHROMIUM = process.env.E2E_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    launchOptions: { executablePath: CHROMIUM },
  },
});
