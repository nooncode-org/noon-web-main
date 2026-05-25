import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      // D-slice ADR-023 route gate — enabled for Playwright so the
      // `prototipo-decision.spec.ts` a11y scan can reach the route. Other
      // specs are unaffected (they hit different paths). The cross-repo
      // App fetch is intercepted by `page.route()` inside the spec, so the
      // dev server does not need real App credentials.
      MAXWELL_PROTOTIPO_DECISION_ROUTE: "1",
      NOON_APP_BASE_URL: "http://noon-app.test-mock",
      NOON_WEBSITE_WEBHOOK_SECRET: "test-secret-playwright",
    },
  },
});
