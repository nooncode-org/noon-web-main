/**
 * F5-05 (auditoría 2026-07) — reaper compartido de pipelines fire-and-forget.
 *
 * Pinnea: el mapping de reverts, el mapping estado-colgado→event-type, el
 * re-forward del outbox con marca de forwarded, el skip completo cuando el
 * bridge App no está configurado, el aislamiento de errores por fase, y que
 * un forward fallido NO marca la fila (sigue dead-letter para la próxima).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/maxwell/repositories", () => ({
  revertStaleInFlightStudioSessions: vi.fn(async () => []),
  listUnforwardedClientComments: vi.fn(async () => []),
  listUnforwardedClientRequests: vi.fn(async () => []),
  listUnforwardedClientRequestUpdates: vi.fn(async () => []),
  listUnforwardedClientRequestAttachments: vi.fn(async () => []),
  markClientCommentForwarded: vi.fn(async () => undefined),
  markClientRequestForwarded: vi.fn(async () => undefined),
  markClientRequestUpdateForwarded: vi.fn(async () => undefined),
  markClientRequestAttachmentForwarded: vi.fn(async () => undefined),
}));

vi.mock("@/lib/upgrade/repositories", () => ({
  failStaleInFlightUpgradeSessions: vi.fn(async () => []),
  archiveStaleUpgradeSessions: vi.fn(async () => 0),
  insertUpgradeEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/noon-app-integration", () => ({
  isNoonAppProposalHandoffConfigured: vi.fn(() => true),
  sendClientCommentToNoonApp: vi.fn(async () => ({ commentId: "app-c1" })),
  sendClientRequestToNoonApp: vi.fn(async () => ({ requestId: "app-r1" })),
  sendClientRequestUpdateToNoonApp: vi.fn(async () => ({ updateId: "app-u1" })),
  sendClientRequestAttachmentToNoonApp: vi.fn(async () => ({ updateId: "app-a1" })),
  extractNoonAppCommentId: vi.fn(() => ({ commentId: "app-c1", idempotent: false })),
}));

vi.mock("@/lib/server/rate-limit-distributed", () => ({
  sweepRateLimitCounters: vi.fn(async () => 0),
}));

vi.mock("@/lib/server/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as maxwellRepos from "@/lib/maxwell/repositories";
import * as upgradeRepos from "@/lib/upgrade/repositories";
import * as integration from "@/lib/noon-app-integration";
import { runReaper } from "@/lib/maxwell/reaper";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(integration.isNoonAppProposalHandoffConfigured).mockReturnValue(true);
});

describe("runReaper", () => {
  it("reverts stale studio sessions and reports the count", async () => {
    vi.mocked(maxwellRepos.revertStaleInFlightStudioSessions).mockResolvedValue([
      { id: "s1", status: "clarifying" },
      { id: "s2", status: "prototype_ready" },
    ] as Awaited<ReturnType<typeof maxwellRepos.revertStaleInFlightStudioSessions>>);

    const report = await runReaper();
    expect(report.studioSessionsReverted).toBe(2);
    // El umbral pasa como cutoff ISO en el pasado.
    const cutoff = vi.mocked(maxwellRepos.revertStaleInFlightStudioSessions).mock.calls[0][0];
    expect(new Date(cutoff).getTime()).toBeLessThan(Date.now());
  });

  it("fails stuck upgrade sessions and maps the stuck status to the right event type", async () => {
    vi.mocked(upgradeRepos.failStaleInFlightUpgradeSessions).mockResolvedValue([
      { id: "u1", stuckStatus: "crawling" },
      { id: "u2", stuckStatus: "analyzing" },
      { id: "u3", stuckStatus: "generating" },
    ] as Awaited<ReturnType<typeof upgradeRepos.failStaleInFlightUpgradeSessions>>);

    const report = await runReaper();
    expect(report.upgradeSessionsFailed).toBe(3);

    const events = vi.mocked(upgradeRepos.insertUpgradeEvent).mock.calls.map((c) => c[0]);
    expect(events).toEqual([
      expect.objectContaining({ sessionId: "u1", eventType: "crawl_failed" }),
      expect.objectContaining({ sessionId: "u2", eventType: "audit_failed" }),
      expect.objectContaining({ sessionId: "u3", eventType: "generate_failed" }),
    ]);
    expect(events[0].metadata).toMatchObject({ reaped: true, stuck_status: "crawling" });
  });

  it("re-forwards outbox dead-letters and marks them forwarded", async () => {
    vi.mocked(maxwellRepos.listUnforwardedClientComments).mockResolvedValue([
      {
        id: "c1",
        body: "hola",
        externalCommentId: "ext-c1",
        createdAt: "2026-07-08T00:00:00.000Z",
        noonAppProjectId: "proj-1",
      },
    ]);
    vi.mocked(maxwellRepos.listUnforwardedClientRequests).mockResolvedValue([
      {
        id: "r1",
        type: "bug",
        clientPriority: "normal",
        body: "req",
        versionRef: 2,
        submittedBy: "opaque-id",
        externalRequestId: "ext-r1",
        createdAt: "2026-07-08T00:00:00.000Z",
        noonAppProjectId: "proj-1",
      },
    ] as Awaited<ReturnType<typeof maxwellRepos.listUnforwardedClientRequests>>);

    const report = await runReaper();

    expect(integration.sendClientCommentToNoonApp).toHaveBeenCalledWith({
      projectId: "proj-1",
      externalCommentId: "ext-c1",
      body: "hola",
      at: "2026-07-08T00:00:00.000Z",
    });
    expect(maxwellRepos.markClientCommentForwarded).toHaveBeenCalledWith("c1", "app-c1");

    expect(integration.sendClientRequestToNoonApp).toHaveBeenCalledWith(
      expect.objectContaining({ externalRequestId: "ext-r1", versionRef: 2 }),
    );
    expect(maxwellRepos.markClientRequestForwarded).toHaveBeenCalledWith("r1");

    expect(report.outbox).toMatchObject({
      comments: { forwarded: 1, failed: 0 },
      requests: { forwarded: 1, failed: 0 },
    });
  });

  it("a failed forward does NOT mark the row and does not stop the batch", async () => {
    vi.mocked(maxwellRepos.listUnforwardedClientComments).mockResolvedValue([
      { id: "c1", body: "a", externalCommentId: "e1", createdAt: "t", noonAppProjectId: "p" },
      { id: "c2", body: "b", externalCommentId: "e2", createdAt: "t", noonAppProjectId: "p" },
    ]);
    vi.mocked(integration.sendClientCommentToNoonApp)
      .mockRejectedValueOnce(new Error("App 503"))
      .mockResolvedValueOnce({ commentId: "app-c2" });

    const report = await runReaper();

    expect(maxwellRepos.markClientCommentForwarded).toHaveBeenCalledTimes(1);
    expect(maxwellRepos.markClientCommentForwarded).toHaveBeenCalledWith("c2", "app-c1");
    expect(report.outbox).toMatchObject({ comments: { forwarded: 1, failed: 1 } });
    expect(report.errors.length).toBeGreaterThan(0);
  });

  it("skips the whole outbox sweep when the App bridge is unconfigured", async () => {
    vi.mocked(integration.isNoonAppProposalHandoffConfigured).mockReturnValue(false);

    const report = await runReaper();
    expect(report.outbox).toEqual({ skipped: "bridge_unconfigured" });
    expect(maxwellRepos.listUnforwardedClientComments).not.toHaveBeenCalled();
    expect(integration.sendClientCommentToNoonApp).not.toHaveBeenCalled();
  });

  it("isolates phase errors: a throwing phase is reported but the others still run", async () => {
    vi.mocked(maxwellRepos.revertStaleInFlightStudioSessions).mockRejectedValue(
      new Error("db down"),
    );
    vi.mocked(upgradeRepos.archiveStaleUpgradeSessions).mockResolvedValue(4);

    const report = await runReaper();
    expect(report.errors.some((e) => e.startsWith("studio:"))).toBe(true);
    expect(report.upgradeSessionsArchived).toBe(4);
    expect(upgradeRepos.failStaleInFlightUpgradeSessions).toHaveBeenCalled();
  });
});
