/**
 * tests/i18n/launch-locales.test.ts
 *
 * §7.1 / spec §32 — the disabled-launch-locale redirect decision used by the
 * middleware (proxy.ts). Pure string function; no Next/next-intl machinery.
 *
 * Guards the user-facing routing invariant "the site is English-only at launch":
 * any es/fr/de URL must resolve to its /en equivalent so a visitor never sees a
 * half-built localized page.
 */

import { describe, expect, it } from "vitest";
import {
  DISABLED_LAUNCH_LOCALES,
  resolveDisabledLocaleRedirect,
} from "@/i18n/launch-locales";

describe("resolveDisabledLocaleRedirect", () => {
  it("redirects each disabled locale root to /en", () => {
    expect(resolveDisabledLocaleRedirect("/es")).toBe("/en");
    expect(resolveDisabledLocaleRedirect("/fr")).toBe("/en");
    expect(resolveDisabledLocaleRedirect("/de")).toBe("/en");
  });

  it("preserves the rest of the path when swapping the locale", () => {
    expect(resolveDisabledLocaleRedirect("/es/about")).toBe("/en/about");
    expect(resolveDisabledLocaleRedirect("/fr/maxwell/workspace/abc")).toBe(
      "/en/maxwell/workspace/abc",
    );
    expect(resolveDisabledLocaleRedirect("/de/")).toBe("/en/");
  });

  it("returns null for the launched locale (no redirect loop)", () => {
    expect(resolveDisabledLocaleRedirect("/en")).toBeNull();
    expect(resolveDisabledLocaleRedirect("/en/about")).toBeNull();
  });

  it("returns null for a locale-less path (handled by next-intl)", () => {
    expect(resolveDisabledLocaleRedirect("/about")).toBeNull();
    expect(resolveDisabledLocaleRedirect("/")).toBeNull();
  });

  it("matches the exact first segment, not a prefix", () => {
    // "espanol" starts with "es" but is not the locale segment.
    expect(resolveDisabledLocaleRedirect("/espanol")).toBeNull();
    expect(resolveDisabledLocaleRedirect("/design")).toBeNull(); // starts with "de"
    expect(resolveDisabledLocaleRedirect("/french")).toBeNull(); // starts with "fr"
  });

  it("declares exactly the not-yet-launched locales (en is launched)", () => {
    expect([...DISABLED_LAUNCH_LOCALES].sort()).toEqual(["de", "es", "fr"]);
    expect(DISABLED_LAUNCH_LOCALES.has("en")).toBe(false);
  });
});
