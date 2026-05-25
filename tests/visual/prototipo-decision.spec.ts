/**
 * tests/visual/prototipo-decision.spec.ts
 *
 * D-slice ADR-023 a11y scan for `/maxwell/prototipo/[token]`. Covers the
 * five most operationally relevant UX buckets via fixture interception —
 * the dev server thinks it is talking to App, but `page.route()` short-
 * circuits the GET signed-read fetch with canned data per token value.
 *
 * Fixtures keyed by token so a single route handler dispatches to the
 * right wire shape:
 *   - `test-pending`   → 200, decision.status=pending, deployedUrl set
 *   - `test-accepted`  → 200, decision.status=accepted
 *   - `test-rejected`  → 200, decision.status=rejected (with notes)
 *   - `test-superseded`→ 410, code=PROTOTYPE_READ_TOKEN_SUPERSEDED
 *   - `test-notfound`  → 404, code=PROTOTYPE_READ_TOKEN_NOT_FOUND
 *
 * Why one viewport / one theme rather than the full A11Y_MATRIX_VIEWPORTS
 * grid: the route's primary risks are token-mismatch contrast and the
 * decision form (focus rings, tap targets) — those reproduce at the
 * default desktop viewport. The full grid can come later once the
 * bilateral smoke is in place and we have real data. Mocked-token a11y
 * scans across 4 viewports × 2 themes would mostly re-exercise the same
 * shared primitives the matrix already covers.
 *
 * Run: `npm run test:a11y -- prototipo-decision.spec.ts`
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  getRenderFixture,
  isRenderFixtureKey,
  type RenderFixtureKey,
} from "@/lib/maxwell/__dev__/prototipo-render-fixtures";
import { settlePage } from "./routes";

const LOCALE = "en";

test.beforeEach(async ({ page }) => {
  await page.route(
    "**/api/integrations/website/prototype-signed-read/**",
    async (route) => {
      const match = route.request().url().match(/prototype-signed-read\/([^/?]+)/);
      const token = match ? decodeURIComponent(match[1]) : "";
      if (isRenderFixtureKey(token)) {
        const fixture = getRenderFixture(token);
        await route.fulfill({
          status: fixture.status,
          contentType: "application/json",
          body: JSON.stringify(fixture.body),
        });
      } else {
        await route.fulfill({ status: 404, body: "unknown fixture token" });
      }
    },
  );
});

const STATES: Array<{ key: RenderFixtureKey; name: string }> = [
  { key: "test-pending", name: "ready.pending" },
  { key: "test-accepted", name: "ready.accepted" },
  { key: "test-rejected", name: "ready.rejected" },
  { key: "test-superseded", name: "expired.regenerated" },
  { key: "test-notfound", name: "terminal.invalid-link" },
];

for (const state of STATES) {
  test(`a11y prototipo route — ${state.name}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`/${LOCALE}/maxwell/prototipo/${state.key}`, {
      waitUntil: "networkidle",
    });
    await settlePage(page);

    const results = await new AxeBuilder({ page })
      // Iframes are sandboxed and may not be axe-analysable from outside;
      // exclude their content from the scan. The page chrome around the
      // iframe still gets full coverage.
      .exclude("iframe")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (results.violations.length > 0) {
      console.log(
        `Violations on prototipo ${state.name}:`,
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });
}
