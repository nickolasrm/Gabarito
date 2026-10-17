import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the real dev server and a real browser, because the
 * interesting risks — WebGL boot, pointer routing, key handling — only exist there
 * (decision 0010).
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5199",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 5199 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:5199",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
