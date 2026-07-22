/**
 * tests/maxwell/submit-request-action.test.ts
 *
 * Orchestration coverage for the §9 Slice A `submitRequestAction` server action:
 * auth + ownership gates, typed-field + body validation, per-client rate-limit
 * mapping, the payment-activated/bridge gate, opaque-submitter derivation, local
 * persist (source of truth), and best-effort forward with graceful degradation
 * (a forward failure must NOT fail the action).
 *
 * Mirrors tests/maxwell/submit-comment-action.test.ts.
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
  extractNoonAppRequestAck: (resp: unknown) => {
    const obj = resp && typeof resp === "object" ? (resp as Record<string, unknown>) : {};
    return {
      requestId: typeof obj.requestId === "string" ? obj.requestId : null,
      idempotent: obj.idempotent === true,
    };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidateMock }));
vi.mock("@/lib/server/rate-limit", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/server/rate-limit")>();
  return { ...actual, enforceRateLimit: h.enforceMock };
});

import { submitRequestAction } from "@/app/[locale]/maxwell/workspace/[sessionId]/_actions/submit-request";
import { RateLimitExceededError } from "@/lib/server/rate-limit";

const SESSION_ID = "session-1";
const VALID = { sessionId: SESSION_ID, type: "feature", clientPriority: "high", body: "Please add X" };

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
    type: "feature",
    clientPriority: "high",
    body: "Please add X",
    versionRef: null,
    submittedBy: "submitter-hash",
    externalRequestId: "rq-1",
    forwardedAt: null,
    clientVisibleState: null,
    stateRevision: 0,
    stateUpdatedAt: null,
    createdAt: "2026-06-17T12:00:00.000Z",
  });
  h.markForwardedMock.mockResolvedValue(undefined);
  h.sendMock.mockResolvedValue({ idempotent: false, requestId: "app-r-1" });
  h.enforceMock.mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitRequestAction — gates", () => {
  it("rejects an unauthenticated viewer without persisting", async () => {
    h.authMock.mockResolvedValue(null);
    const result = await submitRequestAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(h.createRequestMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid request type without persisting", async () => {
    const result = await submitRequestAction({ ...VALID, type: "nonsense" });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(h.createRequestMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid priority", async () => {
    const result = await submitRequestAction({ ...VALID, clientPriority: "urgent" });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(h.createRequestMock).not.toHaveBeenCalled();
  });

  it.each(["", "   ", "\n\t "])("rejects an empty/whitespace body (%j)", async (body) => {
    const result = await submitRequestAction({ ...VALID, body });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(h.createRequestMock).not.toHaveBeenCalled();
  });

  it("rejects a body over 4000 chars", async () => {
    const result = await submitRequestAction({ ...VALID, body: "x".repeat(4001) });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(h.createRequestMock).not.toHaveBeenCalled();
  });

  it("maps a rate-limit hit to RATE_LIMITED without persisting", async () => {
    h.enforceMock.mockImplementation(() => {
      throw new RateLimitExceededError(10, "maxwell.client-request");
    });
    const result = await submitRequestAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(h.createRequestMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when the viewer does not own the session", async () => {
    h.ownsMock.mockReturnValue(false);
    const result = await submitRequestAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.createRequestMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when there is no workspace yet", async () => {
    h.getWorkspaceMock.mockResolvedValue(null);
    const result = await submitRequestAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.createRequestMock).not.toHaveBeenCalled();
  });

  it("refuses (NOT_FOUND) when the project is not payment-activated (unmapped)", async () => {
    h.getWorkspaceMock.mockResolvedValue({ id: "ws-1", noonAppProjectId: null });
    const result = await submitRequestAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.createRequestMock).not.toHaveBeenCalled();
    expect(h.deriveMock).not.toHaveBeenCalled();
  });

  it("refuses (NOT_FOUND) when the cross-repo bridge is unconfigured", async () => {
    h.configuredMock.mockReturnValue(false);
    const result = await submitRequestAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.createRequestMock).not.toHaveBeenCalled();
  });

  // B.4 version-linking (rollback path enabled 2026-06-20)
  it("requires a versionRef for a rollback request", async () => {
    const result = await submitRequestAction({ ...VALID, type: "rollback", versionRef: null });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(h.createRequestMock).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, 100001, Number.NaN])(
    "rejects a malformed versionRef (%p) without persisting",
    async (versionRef) => {
      const result = await submitRequestAction({ ...VALID, versionRef });
      expect(result).toMatchObject({ ok: false, code: "INVALID" });
      expect(h.createRequestMock).not.toHaveBeenCalled();
    },
  );
});

describe("submitRequestAction — persist + forward", () => {
  it("derives the opaque submitter, persists (trimmed), forwards, and marks forwarded", async () => {
    const result = await submitRequestAction({ ...VALID, body: "  Please add X  " });

    expect(result).toEqual({ ok: true, requestId: "rq-1" });
    expect(h.deriveMock).toHaveBeenCalledWith("owner@example.com");
    expect(h.createRequestMock).toHaveBeenCalledWith({
      clientWorkspaceId: "ws-1",
      type: "feature",
      clientPriority: "high",
      body: "Please add X",
      versionRef: null,
      submittedBy: "submitter-hash",
    });
    expect(h.sendMock).toHaveBeenCalledWith({
      projectId: "proj-1",
      externalRequestId: "rq-1",
      submittedBy: "submitter-hash",
      type: "feature",
      clientPriority: "high",
      body: "Please add X",
      versionRef: null,
      at: "2026-06-17T12:00:00.000Z",
    });
    expect(h.markForwardedMock).toHaveBeenCalledWith("rq-1");
    expect(h.revalidateMock).toHaveBeenCalled();
  });

  it("still returns ok when the forward throws (request persists as a dead-letter)", async () => {
    h.sendMock.mockRejectedValue(new Error("App 503"));
    const result = await submitRequestAction(VALID);
    expect(result).toEqual({ ok: true, requestId: "rq-1" });
    expect(h.createRequestMock).toHaveBeenCalledTimes(1);
    expect(h.markForwardedMock).not.toHaveBeenCalled();
  });

  it("passes a versionRef through to persist + forward on a normal-type request (B.4)", async () => {
    h.createRequestMock.mockResolvedValue({
      id: "rq-2",
      clientWorkspaceId: "ws-1",
      type: "bug",
      clientPriority: "high",
      body: "Broken since v3",
      versionRef: 3,
      submittedBy: "submitter-hash",
      externalRequestId: "rq-2",
      forwardedAt: null,
      clientVisibleState: null,
      stateRevision: 0,
      stateUpdatedAt: null,
      createdAt: "2026-06-20T12:00:00.000Z",
    });

    const result = await submitRequestAction({
      ...VALID,
      type: "bug",
      body: "Broken since v3",
      versionRef: 3,
    });

    expect(result).toEqual({ ok: true, requestId: "rq-2" });
    expect(h.createRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "bug", versionRef: 3 }),
    );
    expect(h.sendMock).toHaveBeenCalledWith(expect.objectContaining({ versionRef: 3 }));
  });

  it("persists + forwards a rollback request with type rollback + versionRef (B.4)", async () => {
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

    const result = await submitRequestAction({
      ...VALID,
      type: "rollback",
      clientPriority: "normal",
      body: "Please roll back to version 2.",
      versionRef: 2,
    });

    expect(result).toEqual({ ok: true, requestId: "rq-rb" });
    expect(h.createRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "rollback", versionRef: 2 }),
    );
    expect(h.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "rollback", versionRef: 2 }),
    );
    expect(h.markForwardedMock).toHaveBeenCalledWith("rq-rb");
  });
});
