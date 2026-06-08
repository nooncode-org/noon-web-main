import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProposalEmailConfigurationError,
  sendProposalEmail,
  sendProposalRejectedEmail,
  isProposalEmailConfigured,
} from "@/lib/maxwell/proposal-email";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("isProposalEmailConfigured", () => {
  it("returns false when required env vars are missing", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MAIL_FROM", "");
    expect(isProposalEmailConfigured()).toBe(false);
  });

  it("returns true when Resend config is complete", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Noon <hello@noon.com>");
    expect(isProposalEmailConfigured()).toBe(true);
  });
});

describe("sendProposalEmail", () => {
  it("throws a configuration error without provider config", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MAIL_FROM", "");

    await expect(
      sendProposalEmail({
        proposalId: "proposal-1",
        versionNumber: 1,
        to: "client@example.com",
        publicUrl: "https://noon.com/maxwell/proposal/token-1",
        projectTitle: "Client portal",
      })
    ).rejects.toBeInstanceOf(ProposalEmailConfigurationError);
  });

  it("sends the message through Resend and returns the provider id", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Noon <hello@noon.com>");
    vi.stubEnv("MAIL_REPLY_TO", "support@noon.com");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendProposalEmail({
      proposalId: "proposal-1",
      versionNumber: 3,
      to: "client@example.com",
      publicUrl: "https://noon.com/maxwell/proposal/token-1",
      projectTitle: "Client portal",
    });

    expect(result).toEqual({ provider: "resend", messageId: "email_123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");

    const payload = JSON.parse(String(init.body)) as {
      to: string[];
      subject: string;
      html: string;
      text: string;
    };

    expect(payload.to).toEqual(["client@example.com"]);
    expect(payload.subject).toContain("Client portal");
    expect(payload.html).toContain("Open proposal");
    expect(payload.text).toContain("15 days");
    // No approved amount supplied → the activation line must NOT appear
    // (backward-compatible with the SLA auto-send path, which sends a
    // still-unpriced pending_review proposal).
    expect(payload.text).not.toContain("Activation:");
    expect(payload.html).not.toContain("Activation:");
  });

  it("surfaces the activation amount when an approved amount is supplied", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Noon <hello@noon.com>");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_amount" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendProposalEmail({
      proposalId: "proposal-2",
      versionNumber: 1,
      to: "client@example.com",
      publicUrl: "https://noon.com/maxwell/proposal/token-2",
      projectTitle: "Client portal",
      approvedAmountUsd: 349,
      approvedCurrency: "USD",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { html: string; text: string };

    // The headline activation figure appears, formatted like the receipt email
    // ("$349.00"), framed as the activation fee with the modalities deferred to
    // the proposal — never implying membership is mandatory.
    expect(payload.text).toContain("Activation: $349.00");
    expect(payload.text).toContain("payment options and the full breakdown are in your proposal");
    expect(payload.html).toContain("$349.00");
    expect(payload.html).toContain("Activation:");
  });

  it("omits the activation line when the approved amount is zero or missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Noon <hello@noon.com>");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_zero" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendProposalEmail({
      proposalId: "proposal-3",
      versionNumber: 1,
      to: "client@example.com",
      publicUrl: "https://noon.com/maxwell/proposal/token-3",
      projectTitle: "Client portal",
      approvedAmountUsd: 0,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { html: string; text: string };

    expect(payload.text).not.toContain("Activation:");
    expect(payload.html).not.toContain("Activation:");
  });
});

describe("sendProposalRejectedEmail", () => {
  it("throws a configuration error without provider config", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MAIL_FROM", "");

    await expect(
      sendProposalRejectedEmail({
        proposalId: "proposal-9",
        versionNumber: 2,
        to: "client@example.com",
        projectTitle: "Client portal",
      })
    ).rejects.toBeInstanceOf(ProposalEmailConfigurationError);
  });

  it("sends the decline email with the right subject, copy, idempotency key and tags", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Noon <hello@noon.com>");
    vi.stubEnv("MAIL_REPLY_TO", "support@noon.com");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_decline_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendProposalRejectedEmail({
      proposalId: "proposal-9",
      versionNumber: 2,
      to: "client@example.com",
      projectTitle: "Client portal",
    });

    expect(result).toEqual({ provider: "resend", messageId: "email_decline_1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("maxwell-proposal-rejected-proposal-9");

    const payload = JSON.parse(String(init.body)) as {
      to: string[];
      subject: string;
      html: string;
      text: string;
      tags: Array<{ name: string; value: string }>;
    };

    expect(payload.to).toEqual(["client@example.com"]);
    expect(payload.subject).toBe("Update on your Noon proposal — Client portal");
    // Respectful decline copy with a reply-to path back, and crucially NO CTA.
    expect(payload.text).toContain("won't be moving forward");
    expect(payload.text).toContain("reply to this email");
    expect(payload.html).not.toContain("Open proposal");
    expect(payload.tags).toContainEqual({ name: "flow", value: "maxwell_proposal_rejected" });
    expect(payload.tags).toContainEqual({ name: "proposal_id", value: "proposal-9" });
  });

  it("omits the project clause from the subject when the title is empty", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Noon <hello@noon.com>");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_decline_2" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendProposalRejectedEmail({
      proposalId: "proposal-10",
      versionNumber: 1,
      to: "client@example.com",
      projectTitle: "",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { subject: string };
    expect(payload.subject).toBe("Update on your Noon proposal");
  });
});
