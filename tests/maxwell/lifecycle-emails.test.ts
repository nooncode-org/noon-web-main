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
  EmailSendError,
  isLifecycleEmailsReady,
  sendMvpReadyEmail,
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

    // Resend transport missing → not ready, even with the gate open.
    vi.stubEnv("RESEND_API_KEY", "");
    expect(isLifecycleEmailsReady()).toBe(false);

    // Resend configured but the lifecycle gate is off → still not ready.
    // (The other branch of the AND: gate decides independently of transport.)
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAXWELL_LIFECYCLE_EMAILS", "");
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

  it("throws EmailConfigurationError on workspace-ready when gate is open but Resend creds missing", async () => {
    // Symmetry with the payment-received case above: the workspace
    // sender must also fail LOUD (not silently skip) when the gate is
    // flipped on without the Resend transport configured.
    vi.stubEnv("MAXWELL_LIFECYCLE_EMAILS", "1");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MAIL_FROM", "");

    await expect(
      sendWorkspaceReadyEmail({
        workspaceId: "ws-1",
        to: "client@example.com",
        projectTitle: "Acme",
        workspaceUrl: "https://noon.com/en/maxwell/workspace/sess-1",
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

  it("includes the workspace CTA but omits the reference row when only the URL is present", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_pay_mix1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendPaymentReceivedEmail({
      paymentEventId: "evt-mix1",
      to: "client@example.com",
      projectTitle: "Acme",
      amount: 100,
      currency: "USD",
      workspaceUrl: "https://noon.com/en/maxwell/workspace/sess-1",
      // paymentReference intentionally absent
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { html: string; text: string };
    expect(payload.html).toContain("Open your workspace");
    expect(payload.html).not.toContain("Reference:");
    expect(payload.text).toContain("Open your workspace");
    expect(payload.text).not.toContain("Reference:");
  });

  it("includes the reference row but omits the workspace CTA when only the reference is present", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_pay_mix2" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendPaymentReceivedEmail({
      paymentEventId: "evt-mix2",
      to: "client@example.com",
      projectTitle: "Acme",
      amount: 100,
      currency: "USD",
      paymentReference: "pi_ref_only",
      // workspaceUrl intentionally absent
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { html: string; text: string };
    expect(payload.html).toContain("pi_ref_only");
    expect(payload.html).not.toContain("Open your workspace");
    expect(payload.text).toContain("Reference: pi_ref_only");
    expect(payload.text).not.toContain("Open your workspace");
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

// ---------------------------------------------------------------------------
// Resend transport failures — both senders surface EmailSendError
// ---------------------------------------------------------------------------
//
// The gate is open and Resend is configured, so the senders reach the
// shared `sendViaResend` transport. A non-2xx response or a 2xx without
// a message id must throw `EmailSendError` so the caller's try/catch can
// log + (in the wiring) swallow it without confusing it for a config
// problem.

describe("lifecycle senders surface EmailSendError on transport failure", () => {
  beforeEach(() => {
    vi.stubEnv("MAXWELL_LIFECYCLE_EMAILS", "1");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Noon <hello@noon.com>");
  });

  it("payment-received throws EmailSendError when Resend responds non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "service unavailable",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendPaymentReceivedEmail({
        paymentEventId: "evt-fail",
        to: "client@example.com",
        projectTitle: "Acme",
        amount: 1,
        currency: "USD",
      }),
    ).rejects.toBeInstanceOf(EmailSendError);
  });

  it("payment-received throws EmailSendError when Resend returns 2xx without an id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}), // no `id`
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendPaymentReceivedEmail({
        paymentEventId: "evt-noid",
        to: "client@example.com",
        projectTitle: "Acme",
        amount: 1,
        currency: "USD",
      }),
    ).rejects.toBeInstanceOf(EmailSendError);
  });

  it("workspace-ready throws EmailSendError when Resend responds non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendWorkspaceReadyEmail({
        workspaceId: "ws-fail",
        to: "client@example.com",
        projectTitle: "Acme",
        workspaceUrl: "https://noon.com/en/maxwell/workspace/sess-1",
      }),
    ).rejects.toBeInstanceOf(EmailSendError);
  });
});

// ---------------------------------------------------------------------------
// sendMvpReadyEmail (B8 #4) — first version ready
// ---------------------------------------------------------------------------

describe("sendMvpReadyEmail", () => {
  beforeEach(() => {
    vi.stubEnv("MAXWELL_LIFECYCLE_EMAILS", "1");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Noon <hello@noon.com>");
  });

  it("skips without calling Resend when the lifecycle gate is closed", async () => {
    vi.stubEnv("MAXWELL_LIFECYCLE_EMAILS", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendMvpReadyEmail({
      projectId: "project-1",
      to: "client@example.com",
      projectTitle: "Acme",
      workspaceUrl: "https://noon.com/en/maxwell/workspace/sess-1",
    });

    expect(result).toMatchObject({ skipped: true, reason: "lifecycle_emails_disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to Resend with the right subject, key, tags and both links", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_mvp_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendMvpReadyEmail({
      projectId: "project-1",
      to: "client@example.com",
      projectTitle: "Acme launchpad",
      workspaceUrl: "https://noon.com/en/maxwell/workspace/sess-1",
      previewUrl: "https://preview.example/v1",
    });

    expect(result).toEqual({ provider: "resend", messageId: "email_mvp_1" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("maxwell-mvp-ready-project-1");

    const payload = JSON.parse(String(init.body)) as {
      to: string[];
      subject: string;
      html: string;
      text: string;
      tags: Array<{ name: string; value: string }>;
    };
    expect(payload.to).toEqual(["client@example.com"]);
    expect(payload.subject).toBe("Your first version is ready — Acme launchpad");
    expect(payload.html).toContain("See your project");
    expect(payload.html).toContain("https://noon.com/en/maxwell/workspace/sess-1");
    expect(payload.html).toContain("https://preview.example/v1");
    expect(payload.text).toContain("Open your workspace: https://noon.com/en/maxwell/workspace/sess-1");
    expect(payload.text).toContain("Or open the version directly: https://preview.example/v1");
    expect(payload.tags).toEqual(
      expect.arrayContaining([
        { name: "flow", value: "maxwell_mvp_ready" },
        { name: "project_id", value: "project-1" },
      ]),
    );
  });

  it("omits the direct-preview line when previewUrl is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_mvp_2" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendMvpReadyEmail({
      projectId: "project-2",
      to: "client@example.com",
      projectTitle: "Solo",
      workspaceUrl: "https://noon.com/en/maxwell/workspace/sess-2",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { html: string; text: string };
    expect(payload.html).not.toContain("Or open the version directly");
    expect(payload.text).not.toContain("Or open the version directly");
  });

  it("HTML-escapes the project title", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_mvp_3" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendMvpReadyEmail({
      projectId: "project-3",
      to: "client@example.com",
      projectTitle: '<script>alert("x")</script>',
      workspaceUrl: "https://noon.com/en/maxwell/workspace/sess-3",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { html: string };
    expect(payload.html).not.toContain("<script>");
    expect(payload.html).toContain("&lt;script&gt;");
  });
});
