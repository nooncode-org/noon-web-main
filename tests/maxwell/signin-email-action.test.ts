/**
 * signInWithEmailAction — the useActionState server action. Covers email
 * validation, per-IP throttle, the sent state, redirectTo sanitization, and the
 * AccessDenied (per-email throttle) → friendly copy mapping.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next-auth (importing the real one pulls next-auth/lib/env.js → next/server,
// unresolvable under vitest). A lightweight AuthError keeps `instanceof` working
// for both the action and this test, since both resolve to this class.
vi.mock("next-auth", () => {
  class AuthError extends Error {
    type: string;
    constructor(message?: string) {
      super(message);
      this.type = "AuthError";
    }
  }
  return { AuthError };
});

import { AuthError } from "next-auth";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  headers: vi.fn(),
  resolveClientIdentity: vi.fn(),
  consume: vi.fn(),
}));

vi.mock("@/auth", () => ({ signIn: mocks.signIn, signOut: vi.fn() }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/server/rate-limit", () => ({ resolveClientIdentity: mocks.resolveClientIdentity }));
vi.mock("@/lib/server/rate-limit-distributed", () => ({ consumeDistributedToken: mocks.consume }));

import { signInWithEmailAction } from "@/app/[locale]/signin/actions";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.resolveClientIdentity.mockReturnValue("1.2.3.4");
  mocks.consume.mockResolvedValue({ ok: true, retryAfterSeconds: 0, remaining: 9 });
  mocks.signIn.mockResolvedValue("https://noon.test/api/auth/verify-request");
});

describe("signInWithEmailAction", () => {
  it("rejects an invalid email without sending", async () => {
    const res = await signInWithEmailAction({ status: "idle" }, fd({ email: "not-an-email" }));
    expect(res.status).toBe("error");
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("normalizes the email, sends, and returns the sent state", async () => {
    const res = await signInWithEmailAction({ status: "idle" }, fd({ email: "  User@Work.com " }));
    expect(res).toEqual({ status: "sent", email: "user@work.com" });
    expect(mocks.signIn).toHaveBeenCalledWith(
      "resend",
      expect.objectContaining({ email: "user@work.com", redirect: false }),
    );
  });

  it("throttles per-IP before sending", async () => {
    mocks.consume.mockResolvedValue({ ok: false, retryAfterSeconds: 60, remaining: 0 });
    const res = await signInWithEmailAction({ status: "idle" }, fd({ email: "a@b.com" }));
    expect(res.status).toBe("error");
    expect(res).toMatchObject({ message: expect.stringMatching(/too many/i) });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("sanitizes an external redirectTo to the internal default", async () => {
    await signInWithEmailAction({ status: "idle" }, fd({ email: "a@b.com", redirectTo: "https://evil.com/x" }));
    const arg = mocks.signIn.mock.calls[0][1] as { redirectTo: string };
    expect(arg.redirectTo).not.toContain("evil.com");
    expect(arg.redirectTo.startsWith("/")).toBe(true);
  });

  it("maps an AccessDenied AuthError to the throttle copy", async () => {
    const err = new AuthError("nope");
    (err as unknown as { type: string }).type = "AccessDenied";
    mocks.signIn.mockRejectedValue(err);
    const res = await signInWithEmailAction({ status: "idle" }, fd({ email: "a@b.com" }));
    expect(res).toMatchObject({ status: "error", message: expect.stringMatching(/too many/i) });
  });

  it("maps other AuthErrors to a generic send failure", async () => {
    const err = new AuthError("boom");
    (err as unknown as { type: string }).type = "EmailSignInError";
    mocks.signIn.mockRejectedValue(err);
    const res = await signInWithEmailAction({ status: "idle" }, fd({ email: "a@b.com" }));
    expect(res).toMatchObject({ status: "error", message: expect.stringMatching(/couldn't send/i) });
  });
});
