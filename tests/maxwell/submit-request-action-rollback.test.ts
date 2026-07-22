/**
 * tests/maxwell/submit-request-action-rollback.test.ts
 *
 * B.4 rollback GATE-OFF branch. The shipping default is ROLLBACK_REQUEST_ENABLED
 * = true (gate-on behavior is covered in submit-request-action.test.ts against the
 * real constant); here we mock the flag OFF to verify the kill-switch still works:
 * a rollback request is rejected before it persists/forwards, while the 9 general
 * types are unaffected. Keeps every other client-requests export real.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  authMock: vi.fn(),
  ownsMock: vi.fn(),
  getStudioSessionMock: vi.fn(),
  getWorkspaceMock: vi.fn(),
  createRequestMock: vi.fn(),
  markForwardedMock: vi.fn(),
  configuredMock: vi.fn(),
  sendMock: vi.fn(),
  deriveMock: vi.fn(),
  enforceMock: vi.fn(),
  revalidateMock: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: h.authMock }));
vi.mock("@/lib/auth/ownership", () => ({ viewerOwnsStudioSession: h.ownsMock }));
vi.mock("@/lib/maxwell/repositories", () => ({
  getStudioSession: h.getStudioSessionMock,
  getClientWorkspaceBySession: h.getWorkspaceMock,
  createClientRequest: h.createRequestMock,
  markClientRequestForwarded: h.markForwardedMock,
}));
vi.mock("@/lib/noon-app-integration", () => ({
  isNoonAppProposalHandoffConfigured: h.configuredMock,
  sendClientRequestToNoonApp: h.sendMock,
  deriveSubmitterId: h.deriveMock,
  extractNoonAppRequestAck: () => ({ requestId: null, idempotent: false }),
}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidateMock }));
vi.mock("@/lib/server/rate-limit", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/server/rate-limit")>();
  return { ...actual, enforceRateLimit: h.enforceMock };
});
// The point of this file: force the rollback gate OFF, keep everything else real.
vi.mock("@/lib/maxwell/client-requests", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/maxwell/client-requests")>();
  return { ...actual, ROLLBACK_REQUEST_ENABLED: false };
});

import { submitRequestAction } from "@/app/[locale]/maxwell/workspace/[sessionId]/_actions/submit-request";

const SESSION_ID = "session-1";

beforeEach(() => {
  vi.clearAllMocks();
  h.authMock.mockResolvedValue({ user: { email: "owner@example.com" } });
  h.ownsMock.mockReturnValue(true);
  h.getStudioSessionMock.mockResolvedValue({ id: SESSION_ID, ownerEmail: "owner@example.com" });
  h.getWorkspaceMock.mockResolvedValue({ id: "ws-1", noonAppProjectId: "proj-1" });
  h.configuredMock.mockReturnValue(true);
  h.deriveMock.mockReturnValue("submitter-hash");
  h.createRequestMock.mockResolvedValue({
    id: "rq-1",
    clientWorkspaceId: "ws-1",
    type: "comment",
    clientPriority: "normal",
    body: "hi",
    versionRef: null,
    submittedBy: "submitter-hash",
    externalRequestId: "rq-1",
    forwardedAt: null,
    clientVisibleState: null,
    stateRevision: 0,
    stateUpdatedAt: null,
    createdAt: "2026-06-20T12:00:00.000Z",
  });
  h.markForwardedMock.mockResolvedValue(undefined);
  h.sendMock.mockResolvedValue({ idempotent: false, requestId: "app-1" });
  h.enforceMock.mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitRequestAction — rollback gate OFF (kill switch)", () => {
  it("rejects a rollback request even with a valid versionRef", async () => {
    const result = await submitRequestAction({
      sessionId: SESSION_ID,
      type: "rollback",
      clientPriority: "normal",
      body: "Please roll back to version 2.",
      versionRef: 2,
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(h.createRequestMock).not.toHaveBeenCalled();
    expect(h.sendMock).not.toHaveBeenCalled();
  });

  it("does not affect the 9 general types (a normal request still goes through)", async () => {
    const result = await submitRequestAction({
      sessionId: SESSION_ID,
      type: "comment",
      clientPriority: "normal",
      body: "hi",
      versionRef: 2,
    });
    expect(result).toEqual({ ok: true, requestId: "rq-1" });
    expect(h.createRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "comment", versionRef: 2 }),
    );
  });
});
