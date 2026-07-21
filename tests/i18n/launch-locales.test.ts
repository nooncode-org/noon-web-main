/**
 * tests/i18n/launch-locales.test.ts
 *
 * §7.1 / spec §32 — the disabled-launch-locale redirect decision used by the
 * middleware (proxy.ts). Pure string function; no Next/next-intl machinery.
 *
 * Guards the user-facing routing invariant: launched locales (en, and es since
 * 2026-07-19) serve directly with browser-language auto-detection; the
 * not-yet-launched ones (fr/de) redirect to /en so a visitor never sees a
 * half-built localized page.
 */

import { describe, expect, it } from "vitest";
import {
  DISABLED_LAUNCH_LOCALES,
  resolveDisabledLocaleRedirect,
} from "@/i18n/launch-locales";

describe("resolveDisabledLocaleRedirect", () => {
  it("redirects each disabled locale root to /en", () => {
    expect(resolveDisabledLocaleRedirect("/fr")).toBe("/en");
    expect(resolveDisabledLocaleRedirect("/de")).toBe("/en");
  });

  it("preserves the rest of the path when swapping the locale", () => {
    expect(resolveDisabledLocaleRedirect("/fr/maxwell/workspace/abc")).toBe(
      "/en/maxwell/workspace/abc",
    );
    expect(resolveDisabledLocaleRedirect("/de/")).toBe("/en/");
  });

  it("returns null for launched locales (no redirect loop)", () => {
    expect(resolveDisabledLocaleRedirect("/en")).toBeNull();
    expect(resolveDisabledLocaleRedirect("/en/about")).toBeNull();
    // es re-opened 2026-07-19 — Spanish serves directly again.
    expect(resolveDisabledLocaleRedirect("/es")).toBeNull();
    expect(resolveDisabledLocaleRedirect("/es/about")).toBeNull();
  });

  it("returns null for a locale-less path (handled by next-intl)", () => {
    expect(resolveDisabledLocaleRedirect("/about")).toBeNull();
    expect(resolveDisabledLocaleRedirect("/")).toBeNull();
  });

  it("matches the exact first segment, not a prefix", () => {
    expect(resolveDisabledLocaleRedirect("/design")).toBeNull(); // starts with "de"
    expect(resolveDisabledLocaleRedirect("/french")).toBeNull(); // starts with "fr"
  });

  it("declares exactly the not-yet-launched locales (en + es are launched)", () => {
    expect([...DISABLED_LAUNCH_LOCALES].sort()).toEqual(["de", "fr"]);
    expect(DISABLED_LAUNCH_LOCALES.has("en")).toBe(false);
    expect(DISABLED_LAUNCH_LOCALES.has("es")).toBe(false);
  });
});
