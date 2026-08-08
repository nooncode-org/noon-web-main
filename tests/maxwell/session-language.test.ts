/**
 * tests/maxwell/session-language.test.ts
 *
 * The one moment we get to ask a client what language they speak. Whatever
 * this returns follows them all the way to the portal link they click after
 * paying, so the cases that matter here are the ugly ones: a header from a bot,
 * a quality value that isn't a number, a regional tag we've never seen.
 *
 * None of them may throw, and none may return a language we can't actually
 * carry end to end.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SESSION_LANGUAGE,
  SESSION_LANGUAGES,
  negotiateSessionLanguage,
} from "@/lib/maxwell/session-language";

describe("negotiateSessionLanguage", () => {
  describe("the everyday cases", () => {
    it("follows a Spanish browser", () => {
      expect(negotiateSessionLanguage("es")).toBe("es");
      expect(negotiateSessionLanguage("es-ES,es;q=0.9,en;q=0.8")).toBe("es");
      expect(negotiateSessionLanguage("es-MX,es;q=0.9")).toBe("es");
    });

    it("follows an English browser", () => {
      expect(negotiateSessionLanguage("en")).toBe("en");
      expect(negotiateSessionLanguage("en-US,en;q=0.9,es;q=0.8")).toBe("en");
    });

    it("treats every Spanish region as the one Spanish we have", () => {
      // We ship one Spanish, not a regional set — es-419 (Latin America),
      // es-AR and es-ES all land on it.
      expect(negotiateSessionLanguage("es-419")).toBe("es");
      expect(negotiateSessionLanguage("es-AR")).toBe("es");
    });
  });

  describe("quality values", () => {
    it("prefers the highest quality, not the first listed", () => {
      expect(negotiateSessionLanguage("en;q=0.5,es;q=0.9")).toBe("es");
      expect(negotiateSessionLanguage("es;q=0.3,en;q=0.7")).toBe("en");
    });

    it("keeps the browser's own order when qualities tie", () => {
      expect(negotiateSessionLanguage("es;q=0.8,en;q=0.8")).toBe("es");
      expect(negotiateSessionLanguage("en;q=0.8,es;q=0.8")).toBe("en");
    });

    it("honours q=0 as an explicit refusal", () => {
      expect(negotiateSessionLanguage("es;q=0,en;q=0.5")).toBe("en");
    });

    it("treats an unparseable quality as full preference, not as junk", () => {
      // A half-understood header should still be read the way a browser reads
      // it, rather than silently dropping the client's actual language.
      expect(negotiateSessionLanguage("es;q=abc,en;q=0.9")).toBe("es");
      expect(negotiateSessionLanguage("es;q=,en;q=0.9")).toBe("es");
    });
  });

  describe("languages we cannot carry end to end", () => {
    it("falls back to English for French and German", () => {
      // Declared in routing, but not carried through Maxwell + labels + portal.
      // French replies with an English portal is the mixed experience we removed.
      expect(negotiateSessionLanguage("fr-FR,fr;q=0.9,en;q=0.5")).toBe("en");
      expect(negotiateSessionLanguage("de-DE,de;q=0.9")).toBe("en");
    });

    it("falls back to English for anything else", () => {
      expect(negotiateSessionLanguage("ja")).toBe("en");
      expect(negotiateSessionLanguage("zh-CN,zh;q=0.9")).toBe("en");
    });

    it("still finds a supported language further down the list", () => {
      expect(negotiateSessionLanguage("ja;q=1.0,es;q=0.4")).toBe("es");
    });
  });

  describe("headers that should never break a session", () => {
    it("defaults when there is no header at all", () => {
      expect(negotiateSessionLanguage(null)).toBe(DEFAULT_SESSION_LANGUAGE);
      expect(negotiateSessionLanguage(undefined)).toBe(DEFAULT_SESSION_LANGUAGE);
      expect(negotiateSessionLanguage("")).toBe(DEFAULT_SESSION_LANGUAGE);
    });

    it("defaults on a wildcard", () => {
      expect(negotiateSessionLanguage("*")).toBe("en");
    });

    it("survives malformed input without throwing", () => {
      for (const junk of [";;;", ",,,", "   ", ";q=0.9", "es;;;q=", "-", "en-"]) {
        expect(() => negotiateSessionLanguage(junk)).not.toThrow();
        expect(SESSION_LANGUAGES).toContain(negotiateSessionLanguage(junk));
      }
    });

    it("ignores case and stray whitespace", () => {
      expect(negotiateSessionLanguage("ES-es")).toBe("es");
      expect(negotiateSessionLanguage("  es-ES , en  ")).toBe("es");
    });

    it("never returns a language outside the supported set", () => {
      const headers = [
        "fr", "de", "ja", "*", "", "es", "en-GB", "xx-YY", "es;q=0,fr;q=1",
      ];
      for (const h of headers) {
        expect(SESSION_LANGUAGES).toContain(negotiateSessionLanguage(h));
      }
    });
  });

  describe("the supported set itself", () => {
    it("is exactly the two languages carried end to end", () => {
      expect([...SESSION_LANGUAGES]).toEqual(["en", "es"]);
    });

    it("defaults to English", () => {
      expect(DEFAULT_SESSION_LANGUAGE).toBe("en");
      expect(SESSION_LANGUAGES).toContain(DEFAULT_SESSION_LANGUAGE);
    });
  });
});
