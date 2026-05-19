/**
 * tests/lib/server/audit/proposal-access.test.ts
 *
 * B19 — Tests for the proposal-access audit helpers.
 *
 * Pure helpers (hashClientIp + truncateUserAgent) are tested directly.
 * The fire-and-forget wrapper (recordProposalAccessSafe) is tested with
 * a mocked repository to verify (a) it forwards arguments correctly,
 * (b) it NEVER throws on insert failure, (c) it logs the failure.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the repository BEFORE importing the helper that consumes it.
vi.mock("@/lib/maxwell/repositories", () => ({
  insertProposalAccessAudit: vi.fn(async () => undefined),
}));

// Mock the logger to capture warn calls without spamming test output.
vi.mock("@/lib/server/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { insertProposalAccessAudit } from "@/lib/maxwell/repositories";
import { log } from "@/lib/server/logger";
import {
  hashClientIp,
  recordProposalAccessSafe,
  truncateUserAgent,
} from "@/lib/server/audit/proposal-access";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hashClientIp", () => {
  it("returns null for null / undefined / empty string", () => {
    expect(hashClientIp(null)).toBeNull();
    expect(hashClientIp(undefined)).toBeNull();
    expect(hashClientIp("")).toBeNull();
    expect(hashClientIp("   ")).toBeNull();
  });

  it('returns null for the literal "anonymous" placeholder', () => {
    // resolveClientIdentity falls back to "anonymous" when no forwarded
    // header is present — hashing it would group all unknown-IP rows.
    expect(hashClientIp("anonymous")).toBeNull();
  });

  it("returns a 16-char hex string for a real IP", () => {
    const hash = hashClientIp("203.0.113.42");
    expect(hash).not.toBeNull();
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it("is deterministic (same IP always hashes the same)", () => {
    expect(hashClientIp("203.0.113.42")).toBe(hashClientIp("203.0.113.42"));
  });

  it("trims whitespace before hashing (so '1.2.3.4 ' === '1.2.3.4')", () => {
    expect(hashClientIp("1.2.3.4 ")).toBe(hashClientIp("1.2.3.4"));
    expect(hashClientIp("  1.2.3.4")).toBe(hashClientIp("1.2.3.4"));
  });

  it("produces different hashes for different IPs (collision sanity)", () => {
    expect(hashClientIp("203.0.113.42")).not.toBe(hashClientIp("203.0.113.43"));
  });
});

describe("truncateUserAgent", () => {
  it("returns null for null / undefined / empty / whitespace-only", () => {
    expect(truncateUserAgent(null)).toBeNull();
    expect(truncateUserAgent(undefined)).toBeNull();
    expect(truncateUserAgent("")).toBeNull();
    expect(truncateUserAgent("   ")).toBeNull();
  });

  it("collapses internal whitespace runs to a single space", () => {
    expect(truncateUserAgent("Mozilla/5.0   (Windows NT 10.0)")).toBe(
      "Mozilla/5.0 (Windows NT 10.0)",
    );
    expect(truncateUserAgent("Mozilla\t\tFirefox\n\nMobile")).toBe(
      "Mozilla Firefox Mobile",
    );
  });

  it("returns short UAs unchanged (modulo whitespace)", () => {
    expect(truncateUserAgent("Mozilla/5.0")).toBe("Mozilla/5.0");
  });

  it("caps at exactly 200 chars when input exceeds it", () => {
    const longUa = "x".repeat(500);
    const out = truncateUserAgent(longUa);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(200);
    expect(out).toBe("x".repeat(200));
  });

  it("preserves a UA that is exactly 200 chars", () => {
    const exactly200 = "y".repeat(200);
    expect(truncateUserAgent(exactly200)).toBe(exactly200);
  });
});

describe("recordProposalAccessSafe", () => {
  it("forwards hashed IP and truncated UA to the repository", async () => {
    await recordProposalAccessSafe({
      proposalToken: "tok-1",
      action: "page_view",
      responseStatus: 200,
      clientIp: "203.0.113.42",
      userAgent: "Mozilla/5.0 Firefox/130",
    });

    expect(insertProposalAccessAudit).toHaveBeenCalledTimes(1);
    const call = vi.mocked(insertProposalAccessAudit).mock.calls[0][0];
    expect(call.proposalToken).toBe("tok-1");
    expect(call.action).toBe("page_view");
    expect(call.responseStatus).toBe(200);
    expect(call.clientIpHash).toMatch(/^[a-f0-9]{16}$/);
    expect(call.userAgentTruncated).toBe("Mozilla/5.0 Firefox/130");
  });

  it("passes null hash / null UA when client hints are absent", async () => {
    await recordProposalAccessSafe({
      proposalToken: "tok-2",
      action: "page_view_blocked",
      responseStatus: 404,
    });

    const call = vi.mocked(insertProposalAccessAudit).mock.calls[0][0];
    expect(call.clientIpHash).toBeNull();
    expect(call.userAgentTruncated).toBeNull();
  });

  it("NEVER throws when the repository insert fails (audit must not break user flow)", async () => {
    vi.mocked(insertProposalAccessAudit).mockRejectedValueOnce(new Error("DB down"));

    await expect(
      recordProposalAccessSafe({
        proposalToken: "tok-3",
        action: "page_view",
        responseStatus: 200,
      }),
    ).resolves.toBeUndefined();
  });

  it("logs a warn via the structured logger when the insert fails", async () => {
    vi.mocked(insertProposalAccessAudit).mockRejectedValueOnce(new Error("DB down"));

    await recordProposalAccessSafe({
      proposalToken: "tok-4",
      action: "page_view",
      responseStatus: 200,
    });

    expect(log.warn).toHaveBeenCalledTimes(1);
    const [scope, , meta] = vi.mocked(log.warn).mock.calls[0];
    expect(scope).toBe("audit.proposal-access.insert-failed");
    expect(meta).toMatchObject({
      proposal_token: "tok-4",
      action: "page_view",
      response_status: 200,
      error: "DB down",
    });
  });

  it("never throws when the repository throws a non-Error value", async () => {
    vi.mocked(insertProposalAccessAudit).mockRejectedValueOnce("string-error");

    await expect(
      recordProposalAccessSafe({
        proposalToken: "tok-5",
        action: "page_view",
        responseStatus: 200,
      }),
    ).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledTimes(1);
    const meta = vi.mocked(log.warn).mock.calls[0][2];
    expect(meta?.error).toBe("string-error");
  });
});
