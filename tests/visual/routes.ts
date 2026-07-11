import type { Page } from "@playwright/test";

export const ROUTES = [
  { path: "", name: "home" },
  { path: "/about", name: "about" },
  { path: "/services", name: "services" },
  { path: "/work", name: "work" },
  { path: "/opportunities", name: "opportunities" },
  { path: "/templates", name: "templates" },
  { path: "/templates/client-portal-saas", name: "template-detail" },
  { path: "/contact", name: "contact" },
  { path: "/legal", name: "legal" },
  { path: "/signin", name: "signin" },
  { path: "/upgrade", name: "upgrade" },
] as const;

export const LOCALES = ["en", "es"] as const;
export const THEMES = ["light", "dark"] as const;
export const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

/**
 * B38 — Matrix viewport set for the parametrized a11y scan in
 * `a11y-matrix.spec.ts`. Wider than `VIEWPORTS` (which still drives the visual
 * regression `capture.spec.ts`) so we cover mobile-small, tablet, desktop, and
 * wide-desktop in the same run. Numbers chosen to match common breakpoint
 * boundaries (Tailwind's sm/md/lg/2xl) so tokens that only break at certain
 * widths get caught.
 */
export const A11Y_MATRIX_VIEWPORTS = [
  { name: "mobile-sm", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1920, height: 1080 },
] as const;

/**
 * Subset of ROUTES included in the a11y matrix. Picked for traffic + risk:
 * - `home` is the highest-traffic surface; any contrast token break is
 *   public-facing.
 * - `signin` is the conversion path; a mismatch in dark mode here loses users.
 * - `contact` includes form inputs (a frequent source of a11y violations).
 * - `upgrade` includes interactive product UI (cards, badges).
 *
 * /maxwell and /maxwell/proposal/[token] are intentionally excluded — both
 * require authentication / a seeded proposal token that the headless suite
 * cannot provision yet.
 */
export const A11Y_MATRIX_ROUTES = [
  { path: "", name: "home" },
  { path: "/signin", name: "signin" },
  { path: "/contact", name: "contact" },
  { path: "/upgrade", name: "upgrade" },
] as const;

export async function settlePage(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
  });

  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), (scrollHeight * i) / steps);
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.evaluate(() => document.fonts.ready);

  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });

  await page.waitForTimeout(500);
}
