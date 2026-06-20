/**
 * tests/maxwell/submit-request-attachment-action.test.ts
 *
 * B.5b `submitRequestAttachmentAction` with the gate flipped ON (the shipping
 * default is ATTACHMENTS_ENABLED=false). Verifies mime/size validation, the
 * payment-activated + bridge + storage gates, upload → persist → forward, and the
 * dead-letter (a forward failure must NOT fail the action). Keeps the attachment
 * validators real; mocks storage + repo + the outbound forward.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  authMock: vi.fn(),
  ownsMock: vi.fn(),
  getStudioSessionMock: vi.fn(),
  getWorkspaceMock: vi.fn(),
  getRequestForWorkspaceMock: vi.fn(),
  createAttachmentMock: vi.fn(),
  markForwardedMock: vi.fn(),
  configuredMock: vi.fn(),
  storageConfiguredMock: vi.fn(),
  uploadMock: vi.fn(),
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
  createClientRequestAttachment: h.createAttachmentMock,
  markClientRequestAttachmentForwarded: h.markForwardedMock,
}));
vi.mock("@/lib/noon-app-integration", () => ({
  isNoonAppProposalHandoffConfigured: h.configuredMock,
  sendClientRequestAttachmentToNoonApp: h.sendMock,
  extractNoonAppRequestUpdateAck: (resp: unknown) => {
    const obj = resp && typeof resp === "object" ? (resp as Record<string, unknown>) : {};
    return {
      updateId: typeof obj.updateId === "string" ? obj.updateId : null,
      idempotent: obj.idempotent === true,
    };
  },
}));
vi.mock("@/lib/maxwell/attachment-storage", () => ({
  isAttachmentStorageConfigured: h.storageConfiguredMock,
  uploadAttachmentObject: h.uploadMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidateMock }));
vi.mock("@/lib/server/rate-limit", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/server/rate-limit")>();
  return { ...actual, enforceRateLimit: h.enforceMock };
});
// Flip the gate ON; keep validators real.
vi.mock("@/lib/maxwell/attachments", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/maxwell/attachments")>();
  return { ...actual, ATTACHMENTS_ENABLED: true };
});

import { submitRequestAttachmentAction } from "@/app/[locale]/maxwell/workspace/[sessionId]/_actions/submit-request-attachment";
import { RateLimitExceededError } from "@/lib/server/rate-limit";

function fakeFile(opts: { name: string; type: string; size: number }): File {
  return {
    name: opts.name,
    type: opts.type,
    size: opts.size,
    arrayBuffer: async () => new ArrayBuffer(Math.min(opts.size, 16)),
  } as unknown as File;
}

const SESSION_ID = "session-1";
const PNG = fakeFile({ name: "photo.png", type: "image/png", size: 1024 });
const VALID = { sessionId: SESSION_ID, requestId: "req-1", file: PNG };

beforeEach(() => {
  vi.clearAllMocks();
  h.authMock.mockResolvedValue({ user: { email: "owner@example.com" } });
  h.ownsMock.mockReturnValue(true);
  h.getStudioSessionMock.mockResolvedValue({ id: SESSION_ID, ownerEmail: "owner@example.com" });
  h.getWorkspaceMock.mockResolvedValue({ id: "ws-1", noonAppProjectId: "proj-1" });
  h.getRequestForWorkspaceMock.mockResolvedValue({ id: "req-1", externalRequestId: "req-1", clientWorkspaceId: "ws-1" });
  h.configuredMock.mockReturnValue(true);
  h.storageConfiguredMock.mockReturnValue(true);
  h.uploadMock.mockResolvedValue(undefined);
  h.createAttachmentMock.mockResolvedValue({
    id: "att-1",
    clientRequestId: "req-1",
    blobKey: "ws-1/uuid/photo.png",
    filename: "photo.png",
    mime: "image/png",
    sizeBytes: 1024,
    body: null,
    externalUpdateId: "att-1",
    forwardedAt: null,
    createdAt: "2026-06-20T12:00:00.000Z",
  });
  h.markForwardedMock.mockResolvedValue(undefined);
  h.sendMock.mockResolvedValue({ idempotent: false, updateId: "app-att-1" });
  h.enforceMock.mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitRequestAttachmentAction — validation + gates", () => {
  it("rejects an unauthenticated viewer without uploading", async () => {
    h.authMock.mockResolvedValue(null);
    const result = await submitRequestAttachmentAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(h.uploadMock).not.toHaveBeenCalled();
  });

  it("rejects a disallowed mime (e.g. SVG) without uploading", async () => {
    const svg = fakeFile({ name: "x.svg", type: "image/svg+xml", size: 100 });
    const result = await submitRequestAttachmentAction({ ...VALID, file: svg });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(h.uploadMock).not.toHaveBeenCalled();
  });

  it("rejects an oversize file without uploading", async () => {
    const big = fakeFile({ name: "big.pdf", type: "application/pdf", size: 10 * 1024 * 1024 + 1 });
    const result = await submitRequestAttachmentAction({ ...VALID, file: big });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
    expect(h.uploadMock).not.toHaveBeenCalled();
  });

  it("maps a rate-limit hit to RATE_LIMITED without uploading", async () => {
    h.enforceMock.mockImplementation(() => {
      throw new RateLimitExceededError(10, "maxwell.client-request-attachment");
    });
    const result = await submitRequestAttachmentAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(h.uploadMock).not.toHaveBeenCalled();
  });

  it("refuses (NOT_FOUND) when storage is not configured", async () => {
    h.storageConfiguredMock.mockReturnValue(false);
    const result = await submitRequestAttachmentAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.uploadMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when the parent request is not in the workspace", async () => {
    h.getRequestForWorkspaceMock.mockResolvedValue(null);
    const result = await submitRequestAttachmentAction(VALID);
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(h.uploadMock).not.toHaveBeenCalled();
  });
});

describe("submitRequestAttachmentAction — upload + persist + forward", () => {
  it("uploads, persists, forwards the reference, and marks forwarded", async () => {
    const result = await submitRequestAttachmentAction(VALID);

    expect(result).toEqual({ ok: true });
    expect(h.uploadMock).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "image/png" }),
    );
    expect(h.createAttachmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientRequestId: "req-1",
        filename: "photo.png",
        mime: "image/png",
        sizeBytes: 1024,
      }),
    );
    expect(h.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        externalRequestId: "req-1",
        updateId: "att-1",
        attachment: { id: "att-1", filename: "photo.png", mime: "image/png", size: 1024 },
      }),
    );
    expect(h.markForwardedMock).toHaveBeenCalledWith("att-1");
  });

  it("still returns ok when the forward throws (attachment persists as a dead-letter)", async () => {
    h.sendMock.mockRejectedValue(new Error("App 503"));
    const result = await submitRequestAttachmentAction(VALID);
    expect(result).toEqual({ ok: true });
    expect(h.uploadMock).toHaveBeenCalledTimes(1);
    expect(h.createAttachmentMock).toHaveBeenCalledTimes(1);
    expect(h.markForwardedMock).not.toHaveBeenCalled();
  });
});
