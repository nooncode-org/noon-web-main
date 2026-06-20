/**
 * tests/maxwell/submit-request-action-rollback.test.ts
 *
 * B.4 rollback path with the gate FLIPPED ON. The shipping default is
 * ROLLBACK_REQUEST_ENABLED = false (covered in submit-request-action.test.ts);
 * here we mock the flag on to verify the rollback-specific rules the flip PR will
 * activate: `versionRef` is REQUIRED for a rollback, and a valid rollback persists
 * + forwards with type "rollback" + the versionRef. Keeps every other
 * client-requests export real (guards, bounds, isValidVersionRef).
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
// The whole point of this file: flip the rollback gate on, keep everything else real.
vi.mock("@/lib/maxwell/client-requests", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/maxwell/client-requests")>();
  return { ...actual, ROLLBACK_REQUEST_ENABLED: true };
});

import { submitRequestAction } from "@/app/[locale]/maxwell/workspace/[sessionId]/_actions/submit-request";

const SESSION_ID = "session-1";
const ROLLBACK = {
  sessionId: SESSION_ID,
  type: "rollback",
  clientPriority: "normal",
  body: "Please roll back to version 2.",
  versionRef: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.authMock.mockResolvedValue({ user: { email: "owner@example.com" } });
  h.ownsMock.mockReturnValue(true);
  h.getStudioSessionMock.mockResolvedValue({ id: SESSION_ID, ownerEmail: "owner@example.com" });
  h.getWorkspaceMock.mockResolvedValue({ id: "ws-1", noonAppProjectId: "proj-1" });
  h.configuredMock.mockReturnValue(true);
  h.deriveMock.mockReturnValue("submitter-hash");
  h.createRequestMock.mockResolvedValue({
    id: "rq-rb",
    clientWorkspaceId: "ws-1",
    type: "rollback",
    clientPriority: "normal",
    body: "Please roll back to version 2.",
    versionRef: 2,
    submittedBy: "submitter-hash",
    externalRequestId: "rq-rb",
    forwardedAt: null,
    clientVisibleState: null,
    stateRevision: 0,
    stateUpdatedAt: null,
    createdAt: "2026-06-20T12:00:00.000Z",
  });
  h.markForwardedMock.mockResolvedValue(undefined);
  h.sendMock.mockResolvedValue({ idempotent: false, requestId: "app-rb-1" });
  h.enforceMock.mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitRequestAction — rollback (gate on)", () => {
  it("requires a versionRef for a rollback request", async () => {
    const result = await submitRequestAction({ ...ROLLBACK, versionRef: null });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(h.createRequestMock).not.toHaveBeenCalled();
  });

  it("rejects a rollback with a malformed versionRef (shape check first)", async () => {
    const result = await submitRequestAction({ ...ROLLBACK, versionRef: 0 });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(h.createRequestMock).not.toHaveBeenCalled();
  });

  it("persists + forwards a valid rollback with type rollback + versionRef", async () => {
    const result = await submitRequestAction(ROLLBACK);
    expect(result).toEqual({ ok: true });
    expect(h.createRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "rollback", versionRef: 2 }),
    );
    expect(h.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "rollback", versionRef: 2 }),
    );
    expect(h.markForwardedMock).toHaveBeenCalledWith("rq-rb");
  });
});
