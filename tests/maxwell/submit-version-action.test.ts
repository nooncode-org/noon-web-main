/**
 * tests/maxwell/submit-version-action.test.ts
 *
 * Orchestration coverage for the Slice 2b `submitVersionAction` server action:
 * auth + ownership gates, version-sequence validation, per-client rate-limit
 * mapping, the payment-activated/bridge gate, the SYNCHRONOUS forward (no local
 * persistence — Design B), and clean error surfacing when the App rejects / is
 * down (a forward failure returns FORWARD_FAILED, never throws).
 *
 * Mirrors tests/maxwell/submit-request-action.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  authMock: vi.fn(),
  ownsMock: vi.fn(),
  getStudioSessionMock: vi.fn(),
  getWorkspaceMock: vi.fn(),
  getProposalMock: vi.fn(),
  configuredMock: vi.fn(),
  sendMock: vi.fn(),
  enforceMock: vi.fn(),
  revalidateMock: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: h.authMock }));
vi.mock("@/lib/auth/ownership", () => ({ viewerOwnsStudioSession: h.ownsMock }));
vi.mock("@/lib/maxwell/repositories", () => ({
  getStudioSession: h.getStudioSessionMock,
  getClientWorkspaceBySession: h.getWorkspaceMock,
  getLatestProposalRequest: h.getProposalMock,
}));
vi.mock("@/lib/noon-app-integration", () => ({
  isNoonAppProposalHandoffConfigured: h.configuredMock,
  sendVersionActionToNoonApp: h.sendMock,
  extractNoonAppVersionActionAck: (resp: unknown) => {
    const obj = resp && typeof resp === "object" ? (resp as Record<string, unknown>) : {};
    return {
      idempotent: obj.idempotent === true,
      publishedSequence: typeof obj.publishedSequence === "number" ? obj.publishedSequence : null,
      publishedUrl: typeof obj.publishedUrl === "string" ? obj.publishedUrl : null,
      requestId: typeof obj.requestId === "string" ? obj.requestId : null,
    };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidateMock }));
vi.mock("@/lib/server/rate-limit", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/server/rate-limit")>();
  return { ...actual, enforceRateLimit: h.enforceMock };
});

import { submitVersionAction } from "@/app/[locale]/maxwell/workspace/[sessionId]/_actions/submit-version-action";
import { RateLimitExceededError } from "@/lib/server/rate-limit";

const SESSION_ID = "session-1";
const VALID = { sessionId: SESSION_ID, versionSequenceNumber: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  h.authMock.mockResolvedValue({ user: { email: "owner@example.com" } });
  h.ownsMock.mockReturnValue(true);
  h.getStudioSessionMock.mockResolvedValue({ id: SESSION_ID, ownerEmail: "owner@example.com" });
  h.getWorkspaceMock.mockResolvedValue({ id: "ws-1", noonAppProjectId: "proj-1" });
  // Default plan = membership: publishing is a membership self-service action.
  h.getProposalMock.mockResolvedValue({ id: "prop-1", paymentModality: "membership" });
  h.configuredMock.mockReturnValue(true);
  h.sendMock.mockResolvedValue({
    idempotent: false,
    publishedSequence: 2,
    publishedUrl: "https://acme.example",
    requestId: "app-a-1",
  });
  h.enforceMock.mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitVersionAction — gates", () => {
  it("rejects an unauthenticated viewer without forwarding", async () => {
    h.authMock.mockResolvedValue(null);
    const result = await submitVersionAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(h.sendMock).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects an invalid version sequence (%s) without forwarding",
    async (versionSequenceNumber) => {
      const result = await submitVersionAction({ sessionId: SESSION_ID, versionSequenceNumber });
      expect(result).toMatchObject({ ok: false, code: "INVALID" });
      expect(h.sendMock).not.toHaveBeenCalled();
    },
  );

  it("maps a rate-limit hit to RATE_LIMITED without forwarding", async () => {
    h.enforceMock.mockImplementation(() => {
      throw new RateLimitExceededError(10, "maxwell.version-action");
    });
    const result = await submitVersionAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(h.sendMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when the viewer does not own the session", async () => {
    h.ownsMock.mockReturnValue(false);
    const result = await submitVersionAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.sendMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when there is no workspace yet", async () => {
    h.getWorkspaceMock.mockResolvedValue(null);
    const result = await submitVersionAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.sendMock).not.toHaveBeenCalled();
  });

  it("refuses (NOT_FOUND) when the project is not payment-activated (unmapped)", async () => {
    h.getWorkspaceMock.mockResolvedValue({ id: "ws-1", noonAppProjectId: null });
    const result = await submitVersionAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.sendMock).not.toHaveBeenCalled();
  });

  it("refuses (NOT_FOUND) when the cross-repo bridge is unconfigured", async () => {
    h.configuredMock.mockReturnValue(false);
    const result = await submitVersionAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.sendMock).not.toHaveBeenCalled();
  });
});

describe("submitVersionAction — forward", () => {
  it("forwards the publish with a generated externalActionId and returns the published state", async () => {
    const result = await submitVersionAction(VALID);

    expect(result).toEqual({
      ok: true,
      publishedSequence: 2,
      publishedUrl: "https://acme.example",
      idempotent: false,
    });
    expect(h.sendMock).toHaveBeenCalledWith({
      projectId: "proj-1",
      versionSequenceNumber: 2,
      externalActionId: expect.any(String),
    });
    expect(h.revalidateMock).toHaveBeenCalled();
  });

  it("returns FORWARD_FAILED (not a throw) when the App rejects / is down", async () => {
    h.sendMock.mockRejectedValue(new Error("App 503"));
    const result = await submitVersionAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "FORWARD_FAILED" });
    expect(h.revalidateMock).not.toHaveBeenCalled();
  });
});

/**
 * Publishing is a BUILD decision: a one-time buyer's versions are read-only and
 * the team ships their delivery (owner 2026-07-22). The portal hides the action;
 * this is the lock behind it, since a Server Action is a public endpoint.
 */
describe("submitVersionAction — one-time plan", () => {
  it("refuses to publish and never reaches the App", async () => {
    h.getProposalMock.mockResolvedValue({ id: "prop-1", paymentModality: "one_time" });
    const result = await submitVersionAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "PLAN_NOT_ALLOWED" });
    expect(h.sendMock).not.toHaveBeenCalled();
    expect(h.revalidateMock).not.toHaveBeenCalled();
  });

  it("points them at the membership instead of dead-ending", async () => {
    h.getProposalMock.mockResolvedValue({ id: "prop-1", paymentModality: "one_time" });
    const result = await submitVersionAction(VALID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/membership/i);
  });
});
