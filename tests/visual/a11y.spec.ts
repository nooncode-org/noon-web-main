import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ROUTES, settlePage } from "./routes";

const LOCALE = "en";

for (const route of ROUTES) {
  test(`a11y ${route.name}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(`/${LOCALE}${route.path}`, { waitUntil: "networkidle" });
    await settlePage(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (results.violations.length > 0) {
      console.log(`Violations on ${route.name}:`, JSON.stringify(results.violations, null, 2));
    }
    expect(results.violations).toEqual([]);
  });
}
