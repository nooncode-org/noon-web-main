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
/** The identity the harness signs in as (see global-setup.ts). */
const TEST_VIEWER_EMAIL = "dev@noon.dev";

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
   * The list of the client's own chats, straight from the endpoint that builds
   * it. This is the sidebar's data, and it was throwing.
   *
   * Found 2026-08-08 the only way it could be: in a server log, while measuring
   * something unrelated. The query used `= ANY(sql.array([...]))`, which the
   * local database rejects outright — so anyone running the portal on their
   * machine got an empty chat list and no visible reason. The page around it
   * rendered perfectly.
   *
   * Asserting the response and not the sidebar is deliberate: the rail opens
   * collapsed, so a UI check would pass on an empty list and prove nothing.
   */
  test("the client's chat list comes back with their sessions", async ({ page }) => {
    const response = await page.request.get("/api/maxwell/studio/sessions");
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      sessions: { id: string; goal_summary: string | null; has_client_workspace: boolean }[];
    };
    const ids = body.sessions.map((s) => s.id);
    expect(ids).toContain(DEMO_SESSION);

    // The paid demo has a workspace and the unpaid one does not — the two
    // fields the sidebar reads to decide what each row links to. A query that
    // returned rows but lost these would still look fine from the outside.
    const paid = body.sessions.find((s) => s.id === DEMO_SESSION);
    expect(paid?.has_client_workspace).toBe(true);
    expect(paid?.goal_summary).toBe("Ops dashboard for field teams");
  });

  /**
   * The chat is the portal's centerpiece — where a client asks for a change and
   * reads what the team answered. Everything about it had been checked in
   * pieces: the thread builder has unit tests, the copy has key-parity tests.
   * Neither proves a client opening the tab sees a conversation.
   */
  test("the chat tab shows the real conversation", async ({ page }) => {
    await page.goto(`/en/maxwell/workspace/${DEMO_SESSION}`);
    await page.getByRole("tab", { name: /chat/i }).click();

    const log = page.getByRole("log", { name: /conversation with noon/i });
    await expect(log).toBeVisible();

    // Both sides of the seeded thread, and they come from two different tables
    // — a team update and the client's own message. If either is missing, the
    // merge that builds one conversation out of them dropped a side.
    await expect(log.getByText(/Dashboards and role-based access shipped/i)).toBeVisible();
    await expect(log.getByText(/can the header logo be a bit bigger/i)).toBeVisible();

    // Attribution is what a client reads for, and it is carried by ABSENCE:
    // only the other side gets a name, the way a messaging app does it. So the
    // check is that the name appears exactly once across two messages — if the
    // client's own words were ever attributed to Noon, this is what catches it.
    await expect(log.getByText(/Your Noon team/i)).toHaveCount(1);

    // And somewhere to write back.
    await expect(page.getByRole("textbox", { name: /message noon/i })).toBeVisible();
  });

  /**
   * The distinction that the whole language pass turns on: the frame around the
   * conversation is ours and gets translated; the messages are the client's and
   * the team's own words and must NOT be. A test that only checked "the page is
   * in Spanish" would be satisfied by machine-translating someone's message.
   */
  test("the chat translates its frame but never the messages", async ({ page }) => {
    await page.goto(`/es/maxwell/workspace/${DEMO_SESSION}`);
    await page.getByRole("tab", { name: /chat/i }).click();

    // Ours — translated. Every one of these is a different kind of string:
    // an attribution, a button's accessible name, a placeholder. The accessible
    // names matter most: they are read aloud and nobody ever sees them, so they
    // are the first thing a translation pass forgets.
    const log = page.getByRole("log", { name: /conversación con noon/i });
    await expect(log).toBeVisible();
    await expect(log.getByText(/Tu equipo de Noon/i)).toHaveCount(1);
    await expect(page.getByRole("button", { name: /buscar en esta conversación/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Escribe a Noon/i)).toBeVisible();

    // Theirs — untouched, still exactly what was written.
    await expect(log.getByText(/can the header logo be a bit bigger/i)).toBeVisible();
    await expect(log.getByText(/Dashboards and role-based access shipped/i)).toBeVisible();
  });

  /**
   * The ✕ that closes a dialog has no visible text — its whole name exists for
   * screen readers, which is why it stayed English through the translation
   * pass: nobody sees it, so nobody notices. It also can't come from the
   * message files directly, because the dialog is a shared base component and
   * tying it to a locale provider is what broke app/error.tsx; the portal
   * passes the translated string in instead. This is the proof that the wiring
   * reaches the button.
   */
  test("a dialog's close button is named in the client's language", async ({ page }) => {
    // The account dialog, reached from the proposal page's rail. The portal's
    // own dialogs (domains) turned out to be unreachable in this fixture — the
    // demo client has only Overview and Chat — which is itself worth knowing:
    // the Domains tab has never been opened by any automated check.
    await page.goto(`/es/maxwell/proposal/${DEMO_UNPAID_TOKEN}`);
    // The rail renders collapsed; its contents are in the tree but not
    // clickable until it opens. Worth stating because it is also why a
    // sidebar-based UI assertion elsewhere would silently pass on nothing.
    await page.getByRole("button", { name: "Abrir el menú" }).click();
    await page.getByRole("button", { name: new RegExp(TEST_VIEWER_EMAIL, "i") }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cerrar" })).toBeVisible();
  });

  /**
   * The rail that sits beside every signed-in surface. Opening it for the test
   * above showed it half-translated in a way nothing could have caught: the
   * labels read ALOUD were in Spanish ("Borrar la conversación", "Plegar el
   * panel lateral") while the words a client actually READS were English —
   * Home, Templates, Upgrade, Talk to agent, New chat, Recent chats, Sign out.
   *
   * The reverse of the usual gap, and invisible to the inline-copy scanner:
   * those sit alone on their own lines inside multi-line JSX, and the scanner
   * only matches text with its tags on the same line.
   */
  test("the rail is in the client's language, not half of it", async ({ page }) => {
    await page.goto(`/es/maxwell/proposal/${DEMO_UNPAID_TOKEN}`);
    await page.getByRole("button", { name: "Abrir el menú" }).click();

    for (const label of ["Inicio", "Plantillas", "Mejorar mi web", "Hablar con un agente"]) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Nueva conversación" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();

    // And nothing English left behind in it.
    await expect(page.getByText("New chat", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Sign out", { exact: true })).toHaveCount(0);
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
