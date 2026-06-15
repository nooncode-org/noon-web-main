/**
 * tests/maxwell/submit-comment-action.test.ts
 *
 * Orchestration coverage for the Slice 1b `submitCommentAction` server action:
 * auth + ownership gates, local validation, per-client rate-limit mapping,
 * local persist (source of truth), and best-effort forward with graceful
 * degradation (a forward failure must NOT fail the action).
 *
 * Dependencies are mocked via `vi.hoisted` so the mock fns exist before the
 * hoisted `vi.mock` factories run.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  authMock: vi.fn(),
  ownsMock: vi.fn(),
  getStudioSessionMock: vi.fn(),
  getWorkspaceMock: vi.fn(),
  createCommentMock: vi.fn(),
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
  createClientComment: h.createCommentMock,
  markClientCommentForwarded: h.markForwardedMock,
}));
vi.mock("@/lib/noon-app-integration", () => ({
  isNoonAppProposalHandoffConfigured: h.configuredMock,
  sendClientCommentToNoonApp: h.sendMock,
  extractNoonAppCommentId: (resp: unknown) => {
    const obj = resp && typeof resp === "object" ? (resp as Record<string, unknown>) : {};
    return {
      commentId: typeof obj.commentId === "string" ? obj.commentId : null,
      idempotent: obj.idempotent === true,
    };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidateMock }));
vi.mock("@/lib/server/rate-limit", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/server/rate-limit")>();
  return { ...actual, enforceRateLimit: h.enforceMock };
});

import { submitCommentAction } from "@/app/[locale]/maxwell/workspace/[sessionId]/_actions/submit-comment";
import { RateLimitExceededError } from "@/lib/server/rate-limit";

const SESSION_ID = "session-1";

beforeEach(() => {
  vi.clearAllMocks();
  h.authMock.mockResolvedValue({ user: { email: "owner@example.com" } });
  h.ownsMock.mockReturnValue(true);
  h.getStudioSessionMock.mockResolvedValue({ id: SESSION_ID, ownerEmail: "owner@example.com" });
  h.getWorkspaceMock.mockResolvedValue({ id: "ws-1", noonAppProjectId: "proj-1" });
  h.createCommentMock.mockResolvedValue({
    id: "cm-1",
    clientWorkspaceId: "ws-1",
    body: "Hi there",
    externalCommentId: "cm-1",
    noonAppCommentId: null,
    forwardedAt: null,
    createdAt: "2026-06-15T12:00:00.000Z",
  });
  h.markForwardedMock.mockResolvedValue(undefined);
  h.configuredMock.mockReturnValue(true);
  h.sendMock.mockResolvedValue({ idempotent: false, commentId: "app-c-1", requestId: "r" });
  h.enforceMock.mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitCommentAction — gates", () => {
  it("rejects an unauthenticated viewer without persisting", async () => {
    h.authMock.mockResolvedValue(null);

    const result = await submitCommentAction({ sessionId: SESSION_ID, body: "Hi" });

    expect(result).toEqual({
      ok: false,
      error: expect.any(String),
      code: "UNAUTHENTICATED",
    });
    expect(h.createCommentMock).not.toHaveBeenCalled();
  });

  it.each(["", "   ", "\n\t "])("rejects an empty/whitespace body (%j)", async (body) => {
    const result = await submitCommentAction({ sessionId: SESSION_ID, body });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(h.createCommentMock).not.toHaveBeenCalled();
  });

  it("rejects a body over 2000 chars", async () => {
    const result = await submitCommentAction({ sessionId: SESSION_ID, body: "x".repeat(2001) });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(h.createCommentMock).not.toHaveBeenCalled();
  });

  it("maps a rate-limit hit to RATE_LIMITED without persisting", async () => {
    h.enforceMock.mockImplementation(() => {
      throw new RateLimitExceededError(10, "maxwell.client-comment");
    });

    const result = await submitCommentAction({ sessionId: SESSION_ID, body: "Hi" });

    expect(result).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(h.createCommentMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when the viewer does not own the session", async () => {
    h.ownsMock.mockReturnValue(false);

    const result = await submitCommentAction({ sessionId: SESSION_ID, body: "Hi" });

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.createCommentMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when there is no workspace yet", async () => {
    h.getWorkspaceMock.mockResolvedValue(null);

    const result = await submitCommentAction({ sessionId: SESSION_ID, body: "Hi" });

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.createCommentMock).not.toHaveBeenCalled();
  });
});

describe("submitCommentAction — persist + forward", () => {
  it("persists (trimmed) then forwards and marks forwarded with App's comment id", async () => {
    const result = await submitCommentAction({ sessionId: SESSION_ID, body: "  Hi there  " });

    expect(result).toEqual({ ok: true });
    expect(h.createCommentMock).toHaveBeenCalledWith({ clientWorkspaceId: "ws-1", body: "Hi there" });
    expect(h.sendMock).toHaveBeenCalledWith({
      projectId: "proj-1",
      externalCommentId: "cm-1",
      body: "Hi there",
      at: "2026-06-15T12:00:00.000Z",
    });
    expect(h.markForwardedMock).toHaveBeenCalledWith("cm-1", "app-c-1");
    expect(h.revalidateMock).toHaveBeenCalled();
  });

  it("still returns ok when the forward throws (comment persists as a dead-letter)", async () => {
    h.sendMock.mockRejectedValue(new Error("App 503"));

    const result = await submitCommentAction({ sessionId: SESSION_ID, body: "Hi" });

    expect(result).toEqual({ ok: true });
    expect(h.createCommentMock).toHaveBeenCalledTimes(1);
    expect(h.markForwardedMock).not.toHaveBeenCalled();
  });

  it("persists without forwarding when the workspace has no App project id", async () => {
    h.getWorkspaceMock.mockResolvedValue({ id: "ws-1", noonAppProjectId: null });

    const result = await submitCommentAction({ sessionId: SESSION_ID, body: "Hi" });

    expect(result).toEqual({ ok: true });
    expect(h.createCommentMock).toHaveBeenCalledTimes(1);
    expect(h.sendMock).not.toHaveBeenCalled();
    expect(h.markForwardedMock).not.toHaveBeenCalled();
  });

  it("persists without forwarding when the bridge is unconfigured", async () => {
    h.configuredMock.mockReturnValue(false);

    const result = await submitCommentAction({ sessionId: SESSION_ID, body: "Hi" });

    expect(result).toEqual({ ok: true });
    expect(h.sendMock).not.toHaveBeenCalled();
  });
});
