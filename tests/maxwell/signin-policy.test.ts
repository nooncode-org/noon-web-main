/**
 * signin-policy — the pure sign-in gate delegated from auth.ts. Matrix: Google
 * verified/unverified, unknown provider, email click (allowed, no throttle),
 * email send under/over the per-email limit, and email send with no address.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consume: vi.fn() }));
vi.mock("@/lib/server/rate-limit-distributed", () => ({
  consumeDistributedToken: mocks.consume,
}));

import { evaluateSignIn } from "@/lib/auth/signin-policy";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.consume.mockResolvedValue({ ok: true, retryAfterSeconds: 0, remaining: 2 });
});

describe("evaluateSignIn", () => {
  it("allows Google with a verified email", async () => {
    expect(
      await evaluateSignIn({
        account: { provider: "google" },
        profile: { email: "a@b.com", email_verified: true },
      }),
    ).toBe(true);
  });

  it("denies Google with an unverified email", async () => {
    expect(
      await evaluateSignIn({
        account: { provider: "google" },
        profile: { email: "a@b.com", email_verified: false },
      }),
    ).toBe(false);
  });

  it("denies unknown providers", async () => {
    expect(await evaluateSignIn({ account: { provider: "github" } })).toBe(false);
  });

  it("allows the email CLICK phase without throttling (token already validated)", async () => {
    expect(
      await evaluateSignIn({
        account: { type: "email", provider: "resend" },
        user: { email: "a@b.com" },
      }),
    ).toBe(true);
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it("allows the email SEND phase under the limit and throttles by normalized email", async () => {
    expect(
      await evaluateSignIn({
        account: { type: "email" },
        user: { email: "  A@B.com " },
        email: { verificationRequest: true },
      }),
    ).toBe(true);
    expect(mocks.consume).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "auth.magiclink.email", identityKey: "a@b.com" }),
    );
  });

  it("denies the email SEND phase over the limit", async () => {
    mocks.consume.mockResolvedValue({ ok: false, retryAfterSeconds: 60, remaining: 0 });
    expect(
      await evaluateSignIn({
        account: { type: "email" },
        user: { email: "a@b.com" },
        email: { verificationRequest: true },
      }),
    ).toBe(false);
  });

  it("denies the email SEND phase with no address", async () => {
    expect(
      await evaluateSignIn({ account: { type: "email" }, email: { verificationRequest: true } }),
    ).toBe(false);
    expect(mocks.consume).not.toHaveBeenCalled();
  });
});
