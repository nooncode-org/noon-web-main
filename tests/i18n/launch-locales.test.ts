/**
 * tests/i18n/launch-locales.test.ts
 *
 * §7.1 / spec §32 — the launch-locale redirect decision used by the middleware
 * (proxy.ts). Pure string function; no Next/next-intl machinery.
 *
 * Guards the user-facing routing invariant, which since 2026-08-07 has three
 * tiers rather than two:
 *
 *   en          launched everywhere.
 *   es          PARTIAL — served only on routes whose every word is translated
 *               (the client portal and the prototype page). Everywhere else it
 *               redirects to /en, because the -rd marketing pages hold their
 *               copy inline and answer in English no matter the URL.
 *   fr, de      not launched anywhere.
 *
 * The boundary cases below are the point of the file: a prefix that matches one
 * character too loosely would serve Spanish on an English page, and a prefix
 * that matches too tightly would silence the portal a client just paid for.
 */

import { describe, expect, it } from "vitest";
import {
  DISABLED_LAUNCH_LOCALES,
  PARTIAL_LAUNCH_LOCALES,
  TRANSLATED_PATH_PREFIXES,
  resolveDisabledLocaleRedirect,
} from "@/i18n/launch-locales";

describe("resolveDisabledLocaleRedirect", () => {
  describe("fully disabled locales (fr, de)", () => {
    it("redirects each disabled locale root to /en", () => {
      expect(resolveDisabledLocaleRedirect("/fr")).toBe("/en");
      expect(resolveDisabledLocaleRedirect("/de")).toBe("/en");
    });

    it("preserves the rest of the path when swapping the locale", () => {
      expect(resolveDisabledLocaleRedirect("/de/")).toBe("/en/");
      expect(resolveDisabledLocaleRedirect("/fr/about")).toBe("/en/about");
    });

    it("redirects even on translated routes — disabled beats translated", () => {
      // The portal is translated into Spanish, not French. A disabled locale
      // has no claim on the allowlist.
      expect(resolveDisabledLocaleRedirect("/fr/maxwell/workspace/abc")).toBe(
        "/en/maxwell/workspace/abc",
      );
      expect(resolveDisabledLocaleRedirect("/de/maxwell/prototipo/xyz")).toBe(
        "/en/maxwell/prototipo/xyz",
      );
    });
  });

  describe("partial locale (es) — the routes it cannot answer", () => {
    it("redirects the Spanish root and the marketing pages to /en", () => {
      expect(resolveDisabledLocaleRedirect("/es")).toBe("/en");
      expect(resolveDisabledLocaleRedirect("/es/")).toBe("/en/");
      expect(resolveDisabledLocaleRedirect("/es/about")).toBe("/en/about");
      expect(resolveDisabledLocaleRedirect("/es/services")).toBe("/en/services");
      expect(resolveDisabledLocaleRedirect("/es/contact")).toBe("/en/contact");
      expect(resolveDisabledLocaleRedirect("/es/opportunities")).toBe(
        "/en/opportunities",
      );
    });

    it("redirects the studio — its copy is inline English", () => {
      expect(resolveDisabledLocaleRedirect("/es/maxwell")).toBe("/en/maxwell");
    });

    it("redirects a template page despite its own copy being translated", () => {
      // /templates/[slug] mounts <SiteNav> and <SiteFooterRd>, both hardcoded
      // English. Spanish inside an English frame reads worse than honest
      // English, so it stays gated until the shared chrome is translated.
      expect(resolveDisabledLocaleRedirect("/es/templates/saas-dashboard")).toBe(
        "/en/templates/saas-dashboard",
      );
    });
  });

  describe("partial locale (es) — the routes it keeps", () => {
    it("serves the client portal in Spanish", () => {
      expect(
        resolveDisabledLocaleRedirect("/es/maxwell/workspace/abc"),
      ).toBeNull();
      // Trailing slash and deeper segments stay inside the allowlist.
      expect(
        resolveDisabledLocaleRedirect("/es/maxwell/workspace/abc/"),
      ).toBeNull();
    });

    it("serves the prototype page in Spanish", () => {
      expect(
        resolveDisabledLocaleRedirect("/es/maxwell/prototipo/tok3n"),
      ).toBeNull();
    });

    it("serves the proposal and its payment step in Spanish", () => {
      // The page where a client types card details — the last one that should
      // be asking them to read a second language.
      expect(
        resolveDisabledLocaleRedirect("/es/maxwell/proposal/tok3n"),
      ).toBeNull();
    });
  });

  describe("prefix boundaries", () => {
    it("does not let a lookalike path slip through the allowlist", () => {
      // The trailing slash in "/maxwell/workspace/" is what stops these.
      expect(resolveDisabledLocaleRedirect("/es/maxwell/workspaces-old/a")).toBe(
        "/en/maxwell/workspaces-old/a",
      );
      expect(resolveDisabledLocaleRedirect("/es/maxwell/prototipos")).toBe(
        "/en/maxwell/prototipos",
      );
    });

    it("redirects the bare allowlisted segment (not a real route)", () => {
      expect(resolveDisabledLocaleRedirect("/es/maxwell/workspace")).toBe(
        "/en/maxwell/workspace",
      );
    });

    it("matches the exact first segment, not a prefix of it", () => {
      expect(resolveDisabledLocaleRedirect("/design")).toBeNull(); // "de"
      expect(resolveDisabledLocaleRedirect("/french")).toBeNull(); // "fr"
      expect(resolveDisabledLocaleRedirect("/espanol")).toBeNull(); // "es"
      expect(resolveDisabledLocaleRedirect("/establishment")).toBeNull();
    });
  });

  describe("launched and locale-less paths", () => {
    it("returns null for English (no redirect loop)", () => {
      expect(resolveDisabledLocaleRedirect("/en")).toBeNull();
      expect(resolveDisabledLocaleRedirect("/en/about")).toBeNull();
      expect(
        resolveDisabledLocaleRedirect("/en/maxwell/workspace/abc"),
      ).toBeNull();
    });

    it("returns null for a locale-less path (handled by next-intl)", () => {
      expect(resolveDisabledLocaleRedirect("/about")).toBeNull();
      expect(resolveDisabledLocaleRedirect("/")).toBeNull();
    });
  });

  describe("declared sets", () => {
    it("declares exactly the not-yet-launched locales", () => {
      expect([...DISABLED_LAUNCH_LOCALES].sort()).toEqual(["de", "fr"]);
      expect(DISABLED_LAUNCH_LOCALES.has("en")).toBe(false);
      expect(DISABLED_LAUNCH_LOCALES.has("es")).toBe(false);
    });

    it("declares es as the only partial locale", () => {
      expect([...PARTIAL_LAUNCH_LOCALES]).toEqual(["es"]);
      expect(PARTIAL_LAUNCH_LOCALES.has("en")).toBe(false);
    });

    it("keeps every allowlisted prefix anchored and slash-terminated", () => {
      expect(TRANSLATED_PATH_PREFIXES.length).toBeGreaterThan(0);
      for (const prefix of TRANSLATED_PATH_PREFIXES) {
        expect(prefix.startsWith("/")).toBe(true);
        expect(prefix.endsWith("/")).toBe(true);
      }
    });
  });
});
