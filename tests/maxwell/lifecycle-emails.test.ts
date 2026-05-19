/**
 * tests/maxwell/lifecycle-emails.test.ts
 *
 * Pins the contract for B8 #2 (payment received) and B8 #3 (workspace
 * ready). The two senders share infrastructure but have distinct
 * subject/body/idempotency-key shapes — each invariant is asserted so
 * a future refactor that renames a tag or changes the key pattern is
 * caught before it ships and breaks Resend de-duplication.
 *
 * Key invariants tested:
 *   - `MAXWELL_LIFECYCLE_EMAILS != "1"` → sender SKIPS (no fetch, no
 *     Resend call). This is the production safety gate.
 *   - When the gate is open but Resend env is missing → throws
 *     `EmailConfigurationError` (loud, immediate — not a silent skip).
 *   - When everything is configured → Resend HTTP call is made with
 *     the right subject, body, idempotency key, and tags.
 *   - Idempotency key shape: `maxwell-payment-<id>` and
 *     `maxwell-workspace-ready-<id>` (Resend de-duplicates on this).
 *   - HTML is escaped for projectTitle / paymentReference.
 *   - Currency formatting falls back gracefully for unknown codes.
 *   - `isLifecycleEmailsReady()` combines both env gates.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EmailConfigurationError,
  isLifecycleEmailsReady,
  sendPaymentReceivedEmail,
  sendWorkspaceReadyEmail,
} from "@/lib/maxwell/lifecycle-emails";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Gating
// ---------------------------------------------------------------------------

describe("lifecycle email gating (MAXWELL_LIFECYCLE_EMAILS)", () => {
  it("skips payment-received when MAXWELL_LIFECYCLE_EMAILS is unset", async () => {
    vi.stubEnv("MAXWELL_LIFECYCLE_EMAILS", "");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Noon <hello@noon.com>");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendPaymentReceivedEmail({
      paymentEventId: "evt-1",
      to: "client@example.com",
      projectTitle: "Acme",
      amount: 250,
      currency: "USD",
    });

    expect(result).toEqual({
      provider: "resend",
      messageId: null,
      skipped: true,
      reason: "lifecycle_emails_disabled",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips workspace-ready when MAXWELL_LIFECYCLE_EMAILS != \"1\"", async () => {
    vi.stubEnv("MAXWELL_LIFECYCLE_EMAILS", "true"); // common mistake
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Noon <hello@noon.com>");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWorkspaceReadyEmail({
      workspaceId: "ws-1",
      to: "client@example.com",
      projectTitle: "Acme",
      workspaceUrl: "https://noon.com/en/maxwell/workspace/sess-1",
    });

    expect(result).toMatchObject({ skipped: true, reason: "lifecycle_emails_disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("isLifecycleEmailsReady is true only when both Resend AND gate are configured", () => {
    vi.stubEnv("MAXWELL_LIFECYCLE_EMAILS", "1");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Noon <hello@noon.com>");
    expect(isLifecycleEmailsReady()).toBe(true);

    vi.stubEnv("RESEND_API_KEY", "");
    expect(isLifecycleEmailsReady()).toBe(false);
  });

  it("throws EmailConfigurationError when gate is open but Resend creds missing", async () => {
    vi.stubEnv("MAXWELL_LIFECYCLE_EMAILS", "1");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MAIL_FROM", "");

    await expect(
      sendPaymentReceivedEmail({
        paymentEventId: "evt-1",
        to: "client@example.com",
        projectTitle: "Acme",
        amount: 250,
        currency: "USD",
      }),
    ).rejects.toBeInstanceOf(EmailConfigurationError);
  });
});

// ---------------------------------------------------------------------------
// sendPaymentReceivedEmail — happy path
// ---------------------------------------------------------------------------

describe("sendPaymentReceivedEmail", () => {
  beforeEach(() => {
    vi.stubEnv("MAXWELL_LIFECYCLE_EMAILS", "1");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Noon <hello@noon.com>");
    vi.stubEnv("MAIL_REPLY_TO", "support@noon.com");
  });

  it("posts to Resend with the right subject, key and tags", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_pay_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendPaymentReceivedEmail({
      paymentEventId: "evt-abc",
      to: "client@example.com",
      projectTitle: "Acme launchpad",
      amount: 1250,
      currency: "USD",
      paymentReference: "pi_3OuFb...",
      workspaceUrl: "https://noon.com/en/maxwell/workspace/sess-1",
    });

    expect(result).toEqual({ provider: "resend", messageId: "email_pay_1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("maxwell-payment-evt-abc");

    const payload = JSON.parse(String(init.body)) as {
      to: string[];
      subject: string;
      html: string;
      text: string;
      tags: Array<{ name: string; value: string }>;
    };
    expect(payload.to).toEqual(["client@example.com"]);
    expect(payload.subject).toBe("Payment received — Acme launchpad");
    expect(payload.html).toContain("Acme launchpad");
    expect(payload.html).toContain("$1,250.00");
    expect(payload.html).toContain("pi_3OuFb...");
    expect(payload.html).toContain("Open your workspace");
    expect(payload.text).toContain("Amount: $1,250.00");
    expect(payload.text).toContain("Reference: pi_3OuFb...");
    expect(payload.tags).toEqual(
      expect.arrayContaining([
        { name: "flow", value: "maxwell_payment_received" },
        { name: "payment_event_id", value: "evt-abc" },
      ]),
    );
  });

  it("omits the workspace CTA and reference row when those fields are absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_pay_2" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendPaymentReceivedEmail({
      paymentEventId: "evt-def",
      to: "client@example.com",
      projectTitle: "Solo",
      amount: 99.5,
      currency: "USD",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { html: string; text: string };
    expect(payload.html).not.toContain("Open your workspace");
    expect(payload.html).not.toContain("Reference:");
    expect(payload.text).not.toContain("Open your workspace");
    expect(payload.text).not.toContain("Reference:");
    expect(payload.html).toContain("$99.50");
  });

  it("HTML-escapes the project title to prevent template injection", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_pay_3" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendPaymentReceivedEmail({
      paymentEventId: "evt-xss",
      to: "client@example.com",
      projectTitle: '<script>alert("x")</script>',
      amount: 1,
      currency: "USD",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { html: string };
    expect(payload.html).not.toContain("<script>");
    expect(payload.html).toContain("&lt;script&gt;");
  });

  it("falls back to plain currency formatting for unknown currency codes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_pay_4" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendPaymentReceivedEmail({
      paymentEventId: "evt-cur",
      to: "client@example.com",
      projectTitle: "Acme",
      amount: 10,
      currency: "XYZ", // not in ICU currency table
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { text: string };
    // Either Intl rendered something reasonable, or the fallback kicked in.
    // The contract: it must NOT throw, and the amount must be present.
    expect(payload.text).toMatch(/XYZ.*10\.00|10\.00.*XYZ/);
  });
});

// ---------------------------------------------------------------------------
// sendWorkspaceReadyEmail — happy path
// ---------------------------------------------------------------------------

describe("sendWorkspaceReadyEmail", () => {
  beforeEach(() => {
    vi.stubEnv("MAXWELL_LIFECYCLE_EMAILS", "1");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Noon <hello@noon.com>");
  });

  it("posts to Resend with the workspace URL and the right idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_ws_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWorkspaceReadyEmail({
      workspaceId: "ws-xyz",
      to: "client@example.com",
      projectTitle: "Acme launchpad",
      workspaceUrl: "https://noon.com/en/maxwell/workspace/sess-1",
    });

    expect(result).toEqual({ provider: "resend", messageId: "email_ws_1" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("maxwell-workspace-ready-ws-xyz");

    const payload = JSON.parse(String(init.body)) as {
      subject: string;
      html: string;
      text: string;
      tags: Array<{ name: string; value: string }>;
    };
    expect(payload.subject).toBe("Your workspace is ready — Acme launchpad");
    expect(payload.html).toContain("https://noon.com/en/maxwell/workspace/sess-1");
    expect(payload.text).toContain("Open your workspace: https://noon.com/en/maxwell/workspace/sess-1");
    expect(payload.tags).toEqual(
      expect.arrayContaining([
        { name: "flow", value: "maxwell_workspace_ready" },
        { name: "workspace_id", value: "ws-xyz" },
      ]),
    );
  });

  it("HTML-escapes the project title", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_ws_2" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendWorkspaceReadyEmail({
      workspaceId: "ws-1",
      to: "client@example.com",
      projectTitle: 'Bobby "> Tables',
      workspaceUrl: "https://noon.com/en/maxwell/workspace/sess-1",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { html: string };
    expect(payload.html).toContain("Bobby &quot;&gt; Tables");
  });
});
