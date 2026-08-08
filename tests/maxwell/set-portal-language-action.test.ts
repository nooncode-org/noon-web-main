/**
 * tests/maxwell/set-portal-language-action.test.ts
 *
 * The portal's language selector, which for months was decoration under a line
 * promising "We'll remember this for your next visit".
 *
 * What matters here is that it writes to BOTH places (the cookie decides what
 * the browser is served, the session decides what Maxwell speaks and what
 * locale the emailed portal link carries), that it refuses anything it cannot
 * actually serve, and that a project-side failure never swallows the choice the
 * person just made.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedViewer: vi.fn(),
  viewerOwnsStudioSession: vi.fn(),
  getStudioSession: vi.fn(),
  updateStudioSessionLanguage: vi.fn(),
  revalidatePath: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: mocks.getAuthenticatedViewer,
}));

vi.mock("@/lib/auth/ownership", () => ({
  viewerOwnsStudioSession: mocks.viewerOwnsStudioSession,
}));

vi.mock("@/lib/maxwell/repositories", () => ({
  getStudioSession: mocks.getStudioSession,
  updateStudioSessionLanguage: mocks.updateStudioSessionLanguage,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet }),
}));

vi.mock("@/lib/server/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { setPortalLanguageAction } from "@/app/[locale]/maxwell/_actions/set-portal-language";

const SESSION = { id: "sess-1", ownerEmail: "client@noon.test" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedViewer.mockResolvedValue({ email: "client@noon.test" });
  mocks.viewerOwnsStudioSession.mockReturnValue(true);
  mocks.getStudioSession.mockResolvedValue(SESSION);
  mocks.updateStudioSessionLanguage.mockResolvedValue(SESSION);
});

describe("setPortalLanguageAction", () => {
  describe("inside a project", () => {
    it("writes the cookie AND the project language", async () => {
      const result = await setPortalLanguageAction({ language: "es", sessionId: "sess-1" });

      expect(result).toEqual({ ok: true, language: "es" });
      expect(mocks.cookieSet).toHaveBeenCalledWith(
        "NEXT_LOCALE",
        "es",
        expect.objectContaining({ path: "/" }),
      );
      expect(mocks.updateStudioSessionLanguage).toHaveBeenCalledWith("sess-1", "es");
      expect(mocks.revalidatePath).toHaveBeenCalled();
    });

    it("keeps the cookie readable, since next-intl has to read it", () => {
      // A locale is not a secret, and an httpOnly cookie here would be a silent
      // no-op: the whole point is that the framework can see it.
      return setPortalLanguageAction({ language: "es", sessionId: "sess-1" }).then(() => {
        const options = mocks.cookieSet.mock.calls[0][2];
        expect(options.httpOnly).toBe(false);
        expect(options.maxAge).toBeGreaterThan(60 * 60 * 24 * 30);
      });
    });
  });

  describe("account mode (no project yet)", () => {
    it("still sets the cookie and touches no project", async () => {
      const result = await setPortalLanguageAction({ language: "es" });

      expect(result.ok).toBe(true);
      expect(mocks.cookieSet).toHaveBeenCalled();
      expect(mocks.getStudioSession).not.toHaveBeenCalled();
      expect(mocks.updateStudioSessionLanguage).not.toHaveBeenCalled();
    });
  });

  describe("the choice survives a project-side problem", () => {
    it("keeps the cookie when the project is not found", async () => {
      mocks.getStudioSession.mockResolvedValue(null);

      const result = await setPortalLanguageAction({ language: "es", sessionId: "gone" });

      expect(result.ok).toBe(true);
      expect(mocks.cookieSet).toHaveBeenCalled();
      expect(mocks.updateStudioSessionLanguage).not.toHaveBeenCalled();
    });

    it("keeps the cookie when the project belongs to someone else", async () => {
      mocks.viewerOwnsStudioSession.mockReturnValue(false);

      const result = await setPortalLanguageAction({ language: "es", sessionId: "sess-1" });

      expect(result.ok).toBe(true);
      expect(mocks.updateStudioSessionLanguage).not.toHaveBeenCalled();
    });

    it("keeps the cookie when the write throws", async () => {
      mocks.updateStudioSessionLanguage.mockRejectedValue(new Error("db down"));

      const result = await setPortalLanguageAction({ language: "es", sessionId: "sess-1" });

      // The person asked for Spanish and gets Spanish; the project catches up
      // on the next successful write rather than the request failing in a
      // settings panel.
      expect(result.ok).toBe(true);
      expect(mocks.cookieSet).toHaveBeenCalled();
    });
  });

  describe("what it refuses", () => {
    it("rejects a language we cannot carry end to end", async () => {
      for (const language of ["fr", "de", "ja", "", "es-ES", "EN"]) {
        mocks.cookieSet.mockClear();
        const result = await setPortalLanguageAction({ language });
        expect(result.ok, `expected ${language} to be refused`).toBe(false);
        // Nothing is written on a refusal — not even the cookie.
        expect(mocks.cookieSet).not.toHaveBeenCalled();
      }
    });

    it("rejects an injected value before it can reach a URL or the DB", async () => {
      const result = await setPortalLanguageAction({
        language: "../../etc/passwd",
        sessionId: "sess-1",
      });

      expect(result.ok).toBe(false);
      expect(mocks.cookieSet).not.toHaveBeenCalled();
      expect(mocks.updateStudioSessionLanguage).not.toHaveBeenCalled();
    });

    it("rejects a signed-out caller", async () => {
      mocks.getAuthenticatedViewer.mockResolvedValue(null);

      const result = await setPortalLanguageAction({ language: "es" });

      expect(result.ok).toBe(false);
      expect(mocks.cookieSet).not.toHaveBeenCalled();
    });
  });
});
