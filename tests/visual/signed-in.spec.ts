/**
 * tests/visual/signed-in.spec.ts
 *
 * The first browser coverage of anything behind the sign-in.
 *
 * Everything a client touches after paying — their portal, its chat, its
 * settings — has been verified only by hand, one piece at a time, and the
 * pieces changed a great deal on 2026-08-07. This walks the same surfaces
 * against a real signed-in session and a real seeded database, so a break gets
 * caught here instead of by a client.
 *
 * The fixture (a throwaway in-memory Postgres + the dev viewer bypass) lives in
 * `global-setup.ts`; the demo rows come from the repo's own seed.
 *
 * Run: `npx playwright test signed-in.spec.ts`
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** The session id the repo's seed creates, owned by the dev viewer. */
const DEMO_SESSION = "dev-demo-session";

test.describe("signed in", () => {
  test("the home is the client's dashboard, not the marketing hero", async ({ page }) => {
    await page.goto("/en");

    // The signed-in home replaces the marketing page IN PLACE — same URL, so
    // the URL proves nothing. The tell is the marketing navigation: the
    // dashboard has none. (Not the account controls: those live in the side
    // rail, which the launcher opens collapsed.)
    expect(new URL(page.url()).pathname).toBe("/en");
    await expect(page.getByRole("link", { name: /^services$/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^about$/i })).toHaveCount(0);
    // …and the launcher composer is there to type into.
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("the client portal renders the seeded project", async ({ page }) => {
    await page.goto(`/en/maxwell/workspace/${DEMO_SESSION}`);

    // Content the seed guarantees — if the page fell back to an error or an
    // empty state, none of this is on screen. Matched as the HEADING, not as
    // loose text: the same words are also in <title>, and a locator that hits
    // both fails on ambiguity rather than on truth.
    await expect(
      page.getByRole("heading", { name: /ops dashboard for field teams/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: /workspace sections/i }),
    ).toBeVisible();

    // No message key ever reaches a client's eyes. This catches the failure
    // mode that bit us during the translation pass: a missing key renders as
    // "workspace.chat.logLabel" and looks like a bug in the data.
    await expect(page.locator("body")).not.toContainText(/workspace\.[a-z]+\./i);
  });

  test("the portal has no accessibility violations", async ({ page }) => {
    await page.goto(`/en/maxwell/workspace/${DEMO_SESSION}`);
    await expect(
      page.getByRole("navigation", { name: /workspace sections/i }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  /**
   * The one that could not be checked by hand all day: the portal is the ONLY
   * surface Spanish is actually served on (see i18n/launch-locales.ts), and it
   * needs a real session in a database to render at all. Every other proof of
   * the Spanish work was structural — key parity, a passing build. This is the
   * page itself, in Spanish, with real rows behind it.
   */
  test("the portal speaks Spanish when the URL says so", async ({ page }) => {
    await page.goto(`/es/maxwell/workspace/${DEMO_SESSION}`);

    // Not redirected away: /es/maxwell/workspace/ is on the served list.
    expect(new URL(page.url()).pathname).toBe(`/es/maxwell/workspace/${DEMO_SESSION}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");

    // Real Spanish, from the message file — not a key and not English.
    await expect(page.getByRole("tab", { name: /chat/i })).toBeVisible();
    await expect(page.locator("body")).toContainText(/Dominios|Versiones|Resumen/);
    await expect(page.locator("body")).not.toContainText(/workspace\.[a-z]+\./i);
  });
});
