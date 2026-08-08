import { defineConfig, devices } from "@playwright/test";
import { TEST_DB_URL, TEST_VIEWER_EMAIL,
  NOON_APP_STUB_URL,
  TEST_WEBHOOK_SECRET,
} from "./tests/visual/global-setup";

export default defineConfig({
  testDir: "./tests/visual",
  // Starts a throwaway in-memory Postgres and seeds the demo client, so the
  // signed-in surfaces (studio, payment page, client portal) are reachable.
  // See tests/visual/global-setup.ts for why this is safe.
  globalSetup: "./tests/visual/global-setup.ts",
  globalTeardown: "./tests/visual/global-teardown.ts",
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
      // `prototipo-decision.spec.ts` a11y scan can reach the route.
      MAXWELL_PROTOTIPO_DECISION_ROUTE: "1",
      // The signed-in fixture. DEV_VIEWER_EMAIL is the bypass the app already
      // ships for local work — inert in production (NODE_ENV) and only when no
      // real provider is configured. The database is the throwaway one global
      // setup starts, never the persisted dev database on 5432.
      DATABASE_URL: TEST_DB_URL,
      DEV_VIEWER_EMAIL: TEST_VIEWER_EMAIL,
      // Points at the stand-in App (tests/visual/noon-app-stub.mjs). It used to
      // be an unreachable hostname, which meant every App-gated surface — the
      // domains tab, the versions tab, the membership notices — simply never
      // rendered and could not be tested. Now they can.
      NOON_APP_BASE_URL: NOON_APP_STUB_URL,
      NOON_WEBSITE_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
    },
  },
});
