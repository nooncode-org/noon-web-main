/**
 * tests/maxwell/email-config.test.ts
 *
 * Unit coverage for the shared Resend primitives in
 * `lib/maxwell/email-config.ts` — the module every transactional email
 * (proposal, payment-received, workspace-ready) routes through. These
 * were previously exercised only indirectly via the sender tests; pinning
 * them here means a regression in config parsing, the HTML escaper, or
 * the HTTP transport is caught at its source instead of as a confusing
 * downstream failure in three different sender suites.
 *
 * Covered:
 *   - getResendConfig: provider guard, missing creds, trimming, replyTo.
 *   - isResendConfigured: soft (never-throws) wrapper.
 *   - isLifecycleEmailsEnabled: exact "1" gate.
 *   - escapeHtml: all five entities, ampersand-first ordering.
 *   - sendViaResend: request shape, replyTo presence/absence, and the
 *     two EmailSendError failure modes (non-2xx, 2xx without id).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EmailConfigurationError,
  EmailSendError,
  escapeHtml,
  getResendConfig,
  isLifecycleEmailsEnabled,
  isResendConfigured,
  sendViaResend,
  type ResendConfig,
} from "@/lib/maxwell/email-config";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getResendConfig
// ---------------------------------------------------------------------------

describe("getResendConfig", () => {
  beforeEach(() => {
    // Clean baseline: a valid config that individual tests selectively break.
    vi.stubEnv("MAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Noon <hello@noon.com>");
    vi.stubEnv("MAIL_REPLY_TO", "");
  });

  it("returns a fully-resolved config for valid env", () => {
    const config = getResendConfig();
    expect(config).toEqual({
      provider: "resend",
      apiKey: "re_test",
      from: "Noon <hello@noon.com>",
      replyTo: null,
    });
  });

  it("defaults the provider to resend when MAIL_PROVIDER is unset", () => {
    vi.stubEnv("MAIL_PROVIDER", "");
    expect(getResendConfig().provider).toBe("resend");
  });

  it("throws EmailConfigurationError for an unsupported provider", () => {
    vi.stubEnv("MAIL_PROVIDER", "sendgrid");
    expect(() => getResendConfig()).toThrow(EmailConfigurationError);
  });

  it("throws when RESEND_API_KEY is missing", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(() => getResendConfig()).toThrow(/RESEND_API_KEY/);
  });

  it("throws when MAIL_FROM is missing", () => {
    vi.stubEnv("MAIL_FROM", "");
    expect(() => getResendConfig()).toThrow(/MAIL_FROM/);
  });

  it("trims surrounding whitespace/newlines from the API key and from address", () => {
    vi.stubEnv("RESEND_API_KEY", "  re_test\n");
    vi.stubEnv("MAIL_FROM", "  Noon <hello@noon.com>  ");
    const config = getResendConfig();
    expect(config.apiKey).toBe("re_test");
    expect(config.from).toBe("Noon <hello@noon.com>");
  });

  it("resolves a trimmed replyTo when MAIL_REPLY_TO is set, null otherwise", () => {
    vi.stubEnv("MAIL_REPLY_TO", "  support@noon.com  ");
    expect(getResendConfig().replyTo).toBe("support@noon.com");

    vi.stubEnv("MAIL_REPLY_TO", "");
    expect(getResendConfig().replyTo).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isResendConfigured
// ---------------------------------------------------------------------------

describe("isResendConfigured", () => {
  it("is true when getResendConfig would succeed", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Noon <hello@noon.com>");
    expect(isResendConfigured()).toBe(true);
  });

  it("is false (never throws) when config is incomplete", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MAIL_FROM", "");
    expect(isResendConfigured()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isLifecycleEmailsEnabled
// ---------------------------------------------------------------------------

describe("isLifecycleEmailsEnabled", () => {
  it('is true only for the exact string "1"', () => {
    vi.stubEnv("MAXWELL_LIFECYCLE_EMAILS", "1");
    expect(isLifecycleEmailsEnabled()).toBe(true);
  });

  it.each(["", "0", "true", "yes", "TRUE"])(
    'is false for "%s"',
    (value) => {
      vi.stubEnv("MAXWELL_LIFECYCLE_EMAILS", value);
      expect(isLifecycleEmailsEnabled()).toBe(false);
    },
  );
});

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------

describe("escapeHtml", () => {
  it("escapes all five HTML-sensitive characters", () => {
    expect(escapeHtml(`<a href="x" data-q='y'>&`)).toBe(
      "&lt;a href=&quot;x&quot; data-q=&#39;y&#39;&gt;&amp;",
    );
  });

  it("escapes the ampersand first so entities are not double-encoded", () => {
    // If "<" were escaped before "&", the resulting "&lt;" would become
    // "&amp;lt;". Ampersand-first ordering keeps a lone "<" → "&lt;".
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("leaves a safe string untouched", () => {
    expect(escapeHtml("Acme launchpad 123")).toBe("Acme launchpad 123");
  });
});

// ---------------------------------------------------------------------------
// sendViaResend
// ---------------------------------------------------------------------------

const baseConfig: ResendConfig = {
  provider: "resend",
  apiKey: "re_test",
  from: "Noon <hello@noon.com>",
  replyTo: null,
};

function baseInput(overrides: Partial<Parameters<typeof sendViaResend>[0]> = {}) {
  return {
    config: baseConfig,
    to: "client@example.com",
    subject: "Subject",
    html: "<p>html</p>",
    text: "text",
    idempotencyKey: "maxwell-test-1",
    tags: [{ name: "flow", value: "test" }],
    ...overrides,
  };
}

describe("sendViaResend", () => {
  it("POSTs the right URL, headers and body and returns the message id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendViaResend(baseInput());

    expect(result).toEqual({ provider: "resend", messageId: "email_1" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Idempotency-Key"]).toBe("maxwell-test-1");

    const payload = JSON.parse(String(init.body)) as {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
      tags: Array<{ name: string; value: string }>;
    };
    expect(payload.from).toBe("Noon <hello@noon.com>");
    expect(payload.to).toEqual(["client@example.com"]);
    expect(payload.subject).toBe("Subject");
    expect(payload.tags).toEqual([{ name: "flow", value: "test" }]);
  });

  it("includes replyTo in the body when the config carries one", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_2" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendViaResend(
      baseInput({ config: { ...baseConfig, replyTo: "support@noon.com" } }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { replyTo?: string };
    expect(payload.replyTo).toBe("support@noon.com");
  });

  it("omits replyTo from the serialized body when the config has none", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_3" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendViaResend(baseInput());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // `replyTo: undefined` is dropped by JSON.stringify → key absent.
    expect(String(init.body)).not.toContain("replyTo");
  });

  it("throws EmailSendError on a non-2xx response, surfacing status + body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "invalid from address",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendViaResend(baseInput())).rejects.toThrow(EmailSendError);
    await expect(sendViaResend(baseInput())).rejects.toThrow(/422.*invalid from address/);
  });

  it("throws EmailSendError when the response is 2xx but carries no id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendViaResend(baseInput())).rejects.toThrow(EmailSendError);
  });
});
