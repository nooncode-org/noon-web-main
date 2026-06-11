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
      // The /work (and any future) product mockups are self-contained,
      // illustrative recreations embedded as same-origin iframes — each carries
      // a descriptive `title` as its accessible name. Their INTERNAL demo
      // controls (e.g. the Leaflet zoom buttons inside cs3) are not real page
      // functionality, so we audit our own page chrome, not the illustration
      // inside the frame. (Originally added with the /services wiring, lost in
      // its revert — restored when /work joined ROUTES.)
      .exclude('iframe[src*="/mockups/"]')
      .analyze();

    if (results.violations.length > 0) {
      console.log(`Violations on ${route.name}:`, JSON.stringify(results.violations, null, 2));
    }
    expect(results.violations).toEqual([]);
  });
}
