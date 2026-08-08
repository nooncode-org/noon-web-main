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
/** The public proposal token the same seed creates for that session — already paid. */
const DEMO_TOKEN = "dev-demo-token";
/** The seed's second proposal: sent, unpaid — the plan picker still on screen. */
const DEMO_UNPAID_TOKEN = "dev-demo-unpaid-token";

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

  /**
   * The proposal page has two faces, and only one of them was reachable.
   *
   * The seeded demo is already paid, so its token renders the receipt. Writing
   * the first version of these tests against that token is what surfaced the
   * real gap: the OTHER face — the plan picker, the last screen before a client
   * types card details — could not be opened locally at all. The seed now
   * carries a second, unpaid proposal so both faces get looked at.
   */
  test("a paid proposal shows the receipt, not the plan picker", async ({ page }) => {
    await page.goto(`/en/maxwell/proposal/${DEMO_TOKEN}`);

    await expect(page.getByRole("heading", { name: /payment successful/i })).toBeVisible();
    await expect(page.getByText(/^Paid$/)).toBeVisible();
    // Nothing that could take more money from someone who already paid.
    await expect(page.getByText(/choose an option/i)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/payment\.[a-z]+\.|studio\.[a-z]+\./i);
  });

  test("an unpaid proposal shows the plan picker", async ({ page }) => {
    await page.goto(`/en/maxwell/proposal/${DEMO_UNPAID_TOKEN}`);

    await expect(page.getByRole("heading", { name: /choose an option/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/payment\.[a-z]+\.|studio\.[a-z]+\./i);
  });

  /**
   * "Proposal for X" is the one sentence here with the project name INSIDE it,
   * so it is the one that breaks when a sentence is glued together from pieces:
   * the name sits mid-phrase in English and mid-phrase in Spanish, but the words
   * around it differ and the order can too. Asserting the whole sentence — not
   * just "no message key leaked" — is what proves it travelled intact instead of
   * arriving as "Propuesta para" with the name orphaned somewhere else.
   */
  test("the plan picker names the project inside a whole sentence", async ({ page }) => {
    await page.goto(`/en/maxwell/proposal/${DEMO_UNPAID_TOKEN}`);
    await expect(
      page.getByText("Proposal for Booking site for a dance studio"),
    ).toBeVisible();
  });

  /**
   * The highest-stakes page in the product gets the same scrutiny as the portal:
   * someone with low vision has to be able to tell the plans apart and reach the
   * button that takes their money.
   *
   * One violation is KNOWN and deliberately not fixed here. The muted grey
   * (#727272) on the card surface (#f6f6f6) measures 4.45:1 where AA asks for
   * 4.5 — short by 0.05, on 16 elements. The fix is one shade darker (#707070
   * measures 4.58 and is still a neutral grey, R=G=B), but that value is
   * declared in thirteen places and darkening it changes muted text on every
   * page of the site. That is the owner's call, not a side effect of writing a
   * test, so it is recorded as its own decision rather than slipped in here.
   *
   * The assertion is written to accept exactly that pair and nothing else: any
   * new rule, or the same rule with different colours, still fails.
   */
  test("the plan picker has no accessibility violations beyond the known grey", async ({
    page,
  }) => {
    await page.goto(`/en/maxwell/proposal/${DEMO_UNPAID_TOKEN}`);
    await expect(page.getByRole("heading", { name: /choose an option/i })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations.filter((v) => v.id !== "color-contrast")).toEqual([]);

    // Every failing pair, deduped — the accepted one is the only entry allowed.
    const pairs = new Set(
      results.violations
        .filter((v) => v.id === "color-contrast")
        .flatMap((v) => v.nodes)
        .flatMap((node) => node.any)
        .map((check) => {
          const data = check.data as { fgColor?: string; bgColor?: string };
          return `${data.fgColor} on ${data.bgColor}`;
        }),
    );
    expect([...pairs].sort()).toEqual(["#727272 on #f6f6f6"]);
  });

  test("the plan picker speaks Spanish when the URL says so", async ({ page }) => {
    await page.goto(`/es/maxwell/proposal/${DEMO_UNPAID_TOKEN}`);

    expect(new URL(page.url()).pathname).toBe(
      `/es/maxwell/proposal/${DEMO_UNPAID_TOKEN}`,
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.locator("body")).not.toContainText(/payment\.[a-z]+\./i);

    // The same sentence, in Spanish, still whole. The project name itself is
    // the client's own words and is not translated — only the frame around it.
    await expect(
      page.getByText("Propuesta para Booking site for a dance studio"),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /elige una opción/i })).toBeVisible();
  });
});
