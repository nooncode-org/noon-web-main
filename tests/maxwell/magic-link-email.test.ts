/**
 * magic-link-email — the branded sign-in email. Asserts the URL is present +
 * HTML-escaped, the deterministic idempotency key, the flow tag, and that a
 * missing Resend config surfaces as a thrown error (never a silent no-send).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getResendConfig: vi.fn(), sendViaResend: vi.fn() }));
vi.mock("@/lib/maxwell/email-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/maxwell/email-config")>();
  return { ...actual, getResendConfig: mocks.getResendConfig, sendViaResend: mocks.sendViaResend };
});

import {
  buildMagicLinkEmailSubject,
  buildMagicLinkEmailHtml,
  buildMagicLinkEmailText,
  sendMagicLinkVerificationRequest,
} from "@/lib/auth/magic-link-email";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getResendConfig.mockReturnValue({
    provider: "resend",
    apiKey: "k",
    from: "noon@work.com",
    replyTo: null,
  });
  mocks.sendViaResend.mockResolvedValue({ provider: "resend", messageId: "m1" });
});

describe("magic-link-email templates", () => {
  it("subject mentions the sign-in link", () => {
    expect(buildMagicLinkEmailSubject()).toMatch(/sign-in link/i);
  });

  it("html contains the escaped link and the CTA; text contains the raw link", () => {
    const url = "https://noon.test/api/auth/callback/resend?token=abc&x=1";
    const html = buildMagicLinkEmailHtml(url);
    expect(html).toContain("Sign in to Maxwell");
    expect(html).toContain("&amp;"); // the & in the query is escaped
    expect(html).not.toContain("token=abc&x="); // raw ampersand must not appear
    expect(buildMagicLinkEmailText(url)).toContain(url);
  });
});

describe("sendMagicLinkVerificationRequest", () => {
  it("sends via Resend with a deterministic idempotency key + flow tag", async () => {
    await sendMagicLinkVerificationRequest({
      identifier: "user@work.com",
      url: "https://noon.test/link",
      token: "hashedtoken",
    });
    const arg = mocks.sendViaResend.mock.calls[0][0];
    expect(arg.to).toBe("user@work.com");
    expect(arg.idempotencyKey).toMatch(/^auth-magiclink-/);
    expect(arg.tags).toEqual([{ name: "flow", value: "auth_magic_link" }]);

    // Same token → same key (idempotent resend).
    const firstKey = arg.idempotencyKey;
    await sendMagicLinkVerificationRequest({
      identifier: "user@work.com",
      url: "https://noon.test/link",
      token: "hashedtoken",
    });
    expect(mocks.sendViaResend.mock.calls[1][0].idempotencyKey).toBe(firstKey);
  });

  it("throws when Resend isn't configured (no silent no-send)", async () => {
    mocks.getResendConfig.mockImplementation(() => {
      throw new Error("RESEND_API_KEY is not configured.");
    });
    await expect(
      sendMagicLinkVerificationRequest({ identifier: "a@b.com", url: "https://x", token: "t" }),
    ).rejects.toThrow(/RESEND_API_KEY/);
    expect(mocks.sendViaResend).not.toHaveBeenCalled();
  });
});
