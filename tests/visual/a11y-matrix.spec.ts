/**
 * tests/visual/a11y-matrix.spec.ts
 *
 * B38 — Parametrized a11y matrix: 4 viewports × 2 color schemes × N routes.
 *
 * Complements `a11y.spec.ts` (single viewport breadth scan over all public
 * routes). This file goes deep on a curated set of conversion-critical pages,
 * checking that contrast tokens and tap targets hold up at every breakpoint
 * the design supports — small mobile, tablet, desktop, wide-desktop — in both
 * light and dark color schemes.
 *
 * Why split: the breadth scan in a11y.spec.ts catches regressions in route-
 * specific structure (landmarks, headings, ARIA). The matrix here catches
 * regressions in tokens that only break at certain widths or in one theme
 * (e.g. text-on-image overlays, sticky-header backdrops, dark-mode form
 * placeholders).
 *
 * Color scheme is driven via `page.emulateMedia({ colorScheme })` which maps
 * to `@media (prefers-color-scheme: dark)` in `app/globals.css` — that is
 * how this app actually renders dark mode (no toggle yet; OS-driven).
 *
 * Run:  npm run test:a11y -- a11y-matrix.spec.ts
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  A11Y_MATRIX_ROUTES,
  A11Y_MATRIX_VIEWPORTS,
  THEMES,
  settlePage,
} from "./routes";

const LOCALE = "en";

for (const route of A11Y_MATRIX_ROUTES) {
  for (const viewport of A11Y_MATRIX_VIEWPORTS) {
    for (const theme of THEMES) {
      test(`a11y matrix ${route.name} @ ${viewport.name} / ${theme}`, async ({
        page,
      }) => {
        test.setTimeout(60_000);

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ colorScheme: theme });

        await page.goto(`/${LOCALE}${route.path}`, { waitUntil: "networkidle" });
        await settlePage(page);

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        if (results.violations.length > 0) {
          // Log full violation context so the operator can pinpoint the
          // failing selector + token + computed values without re-running.
          console.log(
            `Violations on ${route.name} @ ${viewport.name}/${theme}:`,
            JSON.stringify(results.violations, null, 2),
          );
        }
        expect(results.violations).toEqual([]);
      });
    }
  }
}
