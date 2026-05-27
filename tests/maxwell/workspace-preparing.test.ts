/**
 * tests/maxwell/workspace-preparing.test.ts
 *
 * Tests para B12 (workspace "preparing" intermediate state).
 *
 * Cubre `GET /api/maxwell/workspace` cuando todavía no existe ClientWorkspace
 * para la sesión: si la propuesta más reciente está en un estado del set
 * `WORKSPACE_PREPARING_PROPOSAL_STATUSES`, el endpoint debe responder
 * 200 con `workspace_status: "pending"` en vez del 404 anterior.
 *
 * Auth (`getReviewRequestAccess`, `getAuthenticatedViewer`) y los repositorios
 * de Maxwell van mockeados. El helper `isProposalAwaitingWorkspace` y la
 * constante `WORKSPACE_PREPARING_PROPOSAL_STATUSES` se importan reales (vía
 * `vi.importActual`) para ejercitar la lógica real, no un mock.
 *
 * Coverage matrix:
 *  - GET sin workspace + proposal en "payment_pending" → 200/pending
 *  - GET sin workspace + proposal en "payment_under_verification" → 200/pending
 *  - GET sin workspace + proposal en "paid" → 200/pending
 *  - GET sin workspace + sin propuesta → 404
 *  - GET sin workspace + proposal en "sent" (no preparing) → 404
 *  - GET con workspace existente → 200/ready (no se consulta la propuesta)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ClientWorkspace,
  ProposalRequest,
  ProposalStatus,
  StudioSession,
} from "@/lib/maxwell/repositories";

vi.mock("@/lib/auth/review", () => ({
  getReviewRequestAccess: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: vi.fn(),
}));

vi.mock("@/lib/auth/ownership", () => ({
  viewerOwnsStudioSession: vi.fn(() => true),
}));

vi.mock("@/lib/maxwell/repositories", async () => {
  const actual = await vi.importActual<typeof import("@/lib/maxwell/repositories")>(
    "@/lib/maxwell/repositories",
  );
  return {
    ...actual,
    getStudioSession: vi.fn(),
    getClientWorkspaceBySession: vi.fn(),
    getLatestProposalRequest: vi.fn(),
    getWorkspaceUpdates: vi.fn(async () => []),
    getPaymentEvents: vi.fn(async () => []),
  };
});

import * as auth from "@/lib/auth/review";
import * as authSession from "@/lib/auth/session";
import * as repos from "@/lib/maxwell/repositories";
import { GET } from "@/app/api/maxwell/workspace/route";

const ROUTE = "http://localhost/api/maxwell/workspace?session_id=session-1";

function fakeSession(overrides: Partial<StudioSession> = {}): StudioSession {
  return {
    id: "session-1",
    initialPrompt: "Build a thing",
    status: "converted",
    ownerEmail: "owner@noon.dev",
    ownerName: "Owner",
    ownerImage: null,
    projectType: null,
    goalSummary: "Build a thing",
    complexityHint: null,
    language: "en",
    correctionsUsed: 0,
    maxCorrections: 2,
    proposalRequestedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stylePackId: null,
    prototypeWorkspaceId: null,
    shareToken: null,
    shareTokenUrl: null,
    prototypeSharedAt: null,
    ...overrides,
  };
}

function fakeProposal(overrides: Partial<ProposalRequest> = {}): ProposalRequest {
  return {
    id: "proposal-1",
    studioSessionId: "session-1",
    versionNumber: 1,
    publicToken: "token-abc",
    status: "payment_pending",
    caseClassification: "normal",
    reviewRequired: true,
    reviewerId: null,
    draftContent: "body",
    deliveryChannel: "email",
    deliveryStatus: "sent",
    deliveryRecipient: "owner@noon.dev",
    approvedAmountUsd: null,
    approvedCurrency: null,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripePaidAt: null,
    sentAt: new Date().toISOString(),
    firstOpenedAt: null,
    expiresAt: null,
    reviewNotifiedAt: new Date().toISOString(),
    reviewRemindedAt: null,
    reviewEscalatedAt: null,
    autoSendDueAt: null,
    supersedesProposalRequestId: null,
    supersededByProposalRequestId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function fakeWorkspace(overrides: Partial<ClientWorkspace> = {}): ClientWorkspace {
  return {
    id: "workspace-1",
    studioSessionId: "session-1",
    paymentStatus: "confirmed",
    workspaceStatus: "active",
    latestUpdateSummary: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function getReq() {
  return new Request(ROUTE, { method: "GET" });
}

describe("GET /api/maxwell/workspace — B12 preparing state", () => {
  beforeEach(() => {
    vi.mocked(auth.getReviewRequestAccess).mockResolvedValue({
      authorized: false,
      reason: "sign_in_required",
      viewer: null,
    });
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue({
      email: "owner@noon.dev",
      name: "Owner",
      image: null,
    });
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(null);
    vi.mocked(repos.getLatestProposalRequest).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const preparingStatuses: ProposalStatus[] = [
    "payment_pending",
    "payment_under_verification",
    "paid",
  ];

  preparingStatuses.forEach((status) => {
    it(`returns 200 + workspace_status:pending when proposal is in "${status}" and workspace is not yet provisioned`, async () => {
      vi.mocked(repos.getLatestProposalRequest).mockResolvedValue(
        fakeProposal({ status }),
      );

      const res = await GET(getReq());

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        workspace: null,
        workspace_status: "pending",
        proposal_status: status,
        project_name: "Build a thing",
        message: "Workspace is being prepared.",
      });
    });
  });

  it("returns 404 when no proposal exists and no workspace", async () => {
    vi.mocked(repos.getLatestProposalRequest).mockResolvedValue(null);

    const res = await GET(getReq());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({ message: "Workspace not found." });
  });

  it("returns 404 when proposal exists but its status is not in the preparing set", async () => {
    vi.mocked(repos.getLatestProposalRequest).mockResolvedValue(
      fakeProposal({ status: "sent" }),
    );

    const res = await GET(getReq());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({ message: "Workspace not found." });
  });

  it("returns 200 + workspace_status:ready when workspace already exists (proposal is not consulted)", async () => {
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(fakeWorkspace());

    const res = await GET(getReq());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      workspace_status: "ready",
      workspace: expect.objectContaining({ id: "workspace-1" }),
    });
    expect(repos.getLatestProposalRequest).not.toHaveBeenCalled();
  });
});
