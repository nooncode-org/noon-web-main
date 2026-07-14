/**
 * approvePrototypeAction — persisting the client's explicit approval.
 *
 * Covers auth, the merged NOT_FOUND (missing OR non-owned — no existence
 * leak), the approvable-status guard (prototype_ready + legacy
 * prototype_shared + idempotent re-approve), the success write + revalidate,
 * and clean degradation when the repository throws.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedViewer: vi.fn(),
  viewerOwnsStudioSession: vi.fn(),
  getStudioSession: vi.fn(),
  updateStudioSessionStatus: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: mocks.getAuthenticatedViewer,
}));

vi.mock("@/lib/auth/ownership", () => ({
  viewerOwnsStudioSession: mocks.viewerOwnsStudioSession,
}));

vi.mock("@/lib/maxwell/repositories", () => ({
  getStudioSession: mocks.getStudioSession,
  updateStudioSessionStatus: mocks.updateStudioSessionStatus,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/server/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { approvePrototypeAction } from "@/app/[locale]/maxwell/_actions/approve-prototype";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedViewer.mockResolvedValue({ email: "client@noon.test" });
  mocks.viewerOwnsStudioSession.mockReturnValue(true);
  mocks.getStudioSession.mockResolvedValue({
    id: "session-1",
    status: "prototype_ready",
  });
  mocks.updateStudioSessionStatus.mockResolvedValue({
    id: "session-1",
    status: "approved_for_proposal",
  });
});

describe("approvePrototypeAction", () => {
  it("persists approved_for_proposal for an owned prototype_ready session", async () => {
    const res = await approvePrototypeAction({ sessionId: "session-1" });

    expect(res).toEqual({ ok: true });
    expect(mocks.updateStudioSessionStatus).toHaveBeenCalledWith(
      "session-1",
      "approved_for_proposal",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/[locale]/maxwell", "page");
  });

  it("rejects an unauthenticated viewer", async () => {
    mocks.getAuthenticatedViewer.mockResolvedValue(null);
    const res = await approvePrototypeAction({ sessionId: "session-1" });
    expect(res).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(mocks.updateStudioSessionStatus).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a non-owner (no existence leak)", async () => {
    mocks.viewerOwnsStudioSession.mockReturnValue(false);
    const res = await approvePrototypeAction({ sessionId: "session-1" });
    expect(res).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(mocks.updateStudioSessionStatus).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a missing session", async () => {
    mocks.getStudioSession.mockResolvedValue(null);
    const res = await approvePrototypeAction({ sessionId: "nope" });
    expect(res).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(mocks.updateStudioSessionStatus).not.toHaveBeenCalled();
  });

  it("rejects non-approvable states with ILLEGAL_STATE", async () => {
    mocks.getStudioSession.mockResolvedValue({
      id: "session-1",
      status: "proposal_pending_review",
    });
    const res = await approvePrototypeAction({ sessionId: "session-1" });
    expect(res).toMatchObject({ ok: false, code: "ILLEGAL_STATE" });
    expect(mocks.updateStudioSessionStatus).not.toHaveBeenCalled();
  });

  it("approves from legacy prototype_shared rows", async () => {
    mocks.getStudioSession.mockResolvedValue({
      id: "session-1",
      status: "prototype_shared",
    });
    const res = await approvePrototypeAction({ sessionId: "session-1" });
    expect(res).toEqual({ ok: true });
    expect(mocks.updateStudioSessionStatus).toHaveBeenCalledWith(
      "session-1",
      "approved_for_proposal",
    );
  });

  it("treats an already-approved session as an idempotent success", async () => {
    mocks.getStudioSession.mockResolvedValue({
      id: "session-1",
      status: "approved_for_proposal",
    });
    const res = await approvePrototypeAction({ sessionId: "session-1" });
    expect(res).toEqual({ ok: true });
    // Same-status write is a validated no-op server-side.
    expect(mocks.updateStudioSessionStatus).toHaveBeenCalledWith(
      "session-1",
      "approved_for_proposal",
    );
  });

  it("degrades to UNKNOWN when the status write throws", async () => {
    mocks.updateStudioSessionStatus.mockRejectedValue(new Error("db down"));
    const res = await approvePrototypeAction({ sessionId: "session-1" });
    expect(res).toMatchObject({ ok: false, code: "UNKNOWN" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
