/**
 * tests/maxwell/submit-request-update-action.test.ts
 *
 * Orchestration coverage for the §9 B.5a `submitRequestUpdateAction` server
 * action: auth + ownership gates, body validation, per-client rate-limit, the
 * payment-activated/bridge gate, parent-request scoping, local persist (durable
 * record), and best-effort forward with graceful degradation (a forward failure
 * must NOT fail the action). Mirrors tests/maxwell/submit-request-action.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  authMock: vi.fn(),
  ownsMock: vi.fn(),
  getStudioSessionMock: vi.fn(),
  getWorkspaceMock: vi.fn(),
  getRequestForWorkspaceMock: vi.fn(),
  createUpdateMock: vi.fn(),
  markForwardedMock: vi.fn(),
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
  getClientRequestForWorkspace: h.getRequestForWorkspaceMock,
  createClientRequestUpdate: h.createUpdateMock,
  markClientRequestUpdateForwarded: h.markForwardedMock,
}));
vi.mock("@/lib/noon-app-integration", () => ({
  isNoonAppProposalHandoffConfigured: h.configuredMock,
  sendClientRequestUpdateToNoonApp: h.sendMock,
  extractNoonAppRequestUpdateAck: (resp: unknown) => {
    const obj = resp && typeof resp === "object" ? (resp as Record<string, unknown>) : {};
    return {
      updateId: typeof obj.updateId === "string" ? obj.updateId : null,
      idempotent: obj.idempotent === true,
    };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidateMock }));
vi.mock("@/lib/server/rate-limit", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/server/rate-limit")>();
  return { ...actual, enforceRateLimit: h.enforceMock };
});

import { submitRequestUpdateAction } from "@/app/[locale]/maxwell/workspace/[sessionId]/_actions/submit-request-update";
import { RateLimitExceededError } from "@/lib/server/rate-limit";

const SESSION_ID = "session-1";
const VALID = { sessionId: SESSION_ID, requestId: "req-1", body: "Here is the clarification" };

beforeEach(() => {
  vi.clearAllMocks();
  h.authMock.mockResolvedValue({ user: { email: "owner@example.com" } });
  h.ownsMock.mockReturnValue(true);
  h.getStudioSessionMock.mockResolvedValue({ id: SESSION_ID, ownerEmail: "owner@example.com" });
  h.getWorkspaceMock.mockResolvedValue({ id: "ws-1", noonAppProjectId: "proj-1" });
  h.getRequestForWorkspaceMock.mockResolvedValue({
    id: "req-1",
    externalRequestId: "req-1",
    clientWorkspaceId: "ws-1",
  });
  h.configuredMock.mockReturnValue(true);
  h.createUpdateMock.mockResolvedValue({
    id: "upd-1",
    clientRequestId: "req-1",
    kind: "clarification",
    body: "Here is the clarification",
    externalUpdateId: "upd-1",
    forwardedAt: null,
    createdAt: "2026-06-20T12:00:00.000Z",
  });
  h.markForwardedMock.mockResolvedValue(undefined);
  h.sendMock.mockResolvedValue({ idempotent: false, updateId: "app-u-1" });
  h.enforceMock.mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitRequestUpdateAction — gates", () => {
  it("rejects an unauthenticated viewer without persisting", async () => {
    h.authMock.mockResolvedValue(null);
    const result = await submitRequestUpdateAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(h.createUpdateMock).not.toHaveBeenCalled();
  });

  it.each(["", "   ", "\n\t "])("rejects an empty/whitespace body (%j)", async (body) => {
    const result = await submitRequestUpdateAction({ ...VALID, body });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(h.createUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects a body over 4000 chars", async () => {
    const result = await submitRequestUpdateAction({ ...VALID, body: "x".repeat(4001) });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(h.createUpdateMock).not.toHaveBeenCalled();
  });

  it("maps a rate-limit hit to RATE_LIMITED without persisting", async () => {
    h.enforceMock.mockImplementation(() => {
      throw new RateLimitExceededError(10, "maxwell.client-request-update");
    });
    const result = await submitRequestUpdateAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(h.createUpdateMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when the viewer does not own the session", async () => {
    h.ownsMock.mockReturnValue(false);
    const result = await submitRequestUpdateAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.createUpdateMock).not.toHaveBeenCalled();
  });

  it("refuses (NOT_FOUND) when the project is not payment-activated (unmapped)", async () => {
    h.getWorkspaceMock.mockResolvedValue({ id: "ws-1", noonAppProjectId: null });
    const result = await submitRequestUpdateAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.createUpdateMock).not.toHaveBeenCalled();
  });

  it("refuses (NOT_FOUND) when the cross-repo bridge is unconfigured", async () => {
    h.configuredMock.mockReturnValue(false);
    const result = await submitRequestUpdateAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.createUpdateMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when the parent request is not in the viewer's workspace", async () => {
    h.getRequestForWorkspaceMock.mockResolvedValue(null);
    const result = await submitRequestUpdateAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.createUpdateMock).not.toHaveBeenCalled();
  });
});

describe("submitRequestUpdateAction — persist + forward", () => {
  it("persists the reply (trimmed), forwards keyed by parent + updateId, marks forwarded", async () => {
    const result = await submitRequestUpdateAction({ ...VALID, body: "  Here is the clarification  " });

    expect(result).toEqual({ ok: true });
    expect(h.createUpdateMock).toHaveBeenCalledWith({
      clientRequestId: "req-1",
      kind: "clarification",
      body: "Here is the clarification",
    });
    expect(h.sendMock).toHaveBeenCalledWith({
      externalRequestId: "req-1",
      updateId: "upd-1",
      body: "Here is the clarification",
      kind: "clarification",
      at: "2026-06-20T12:00:00.000Z",
    });
    expect(h.markForwardedMock).toHaveBeenCalledWith("upd-1");
    expect(h.revalidateMock).toHaveBeenCalled();
  });

  it("still returns ok when the forward throws (reply persists as a dead-letter)", async () => {
    h.sendMock.mockRejectedValue(new Error("App 503"));
    const result = await submitRequestUpdateAction(VALID);
    expect(result).toEqual({ ok: true });
    expect(h.createUpdateMock).toHaveBeenCalledTimes(1);
    expect(h.markForwardedMock).not.toHaveBeenCalled();
  });
});
