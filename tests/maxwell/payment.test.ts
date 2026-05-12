/**
 * tests/maxwell/payment.test.ts
 *
 * End-to-end tests para `GET|POST /api/maxwell/payment`.
 *
 * Auth (`getReviewRequestAccess`), repositorios y handoff a Noon App
 * (`sendPaymentConfirmedToNoonApp`) van mockeados. Zod, las cinco acciones
 * del discriminated union y los guards de negocio (`assertSessionAwaitingPayment`,
 * `assertWorkspaceNotProvisioned`) se ejercitan reales.
 *
 * Coverage matrix:
 *  - Auth: sign_in_required → 401, not_allowed/not_configured → 403, ambos métodos
 *  - GET: missing session_id → 400, session ausente → 404, happy path
 *  - Zod: action desconocida / payload mal formado → 400
 *  - mark_payment_pending: proposal 404; status != "sent" → 409; ok → "payment_pending"
 *  - submit_payment_evidence: ok → "payment_under_verification"
 *  - verify_payment: proposal 404, session 404, guard SESSION_NOT_AWAITING_PAYMENT → 409,
 *    workspace ya provisionado → 200 con notify, happy path → activa workspace + notify
 *  - expire_proposal: ok → "expired"
 *  - confirm_payment: session 404; proposal ausente → 409;
 *    workspace ya provisionado → notify + 200; payment_status != confirmed → 200 sin activar;
 *    guard SESSION_NOT_AWAITING_PAYMENT → 409; happy path → activa + notify
 *  - NoonAppIntegrationError dentro de notify → 502 con code NOON_APP_PAYMENT_HANDOFF_FAILED
 *  - Auditoría: appendProposalReviewEvent con noon_app_payment_sent / failed
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ClientWorkspace,
  ProposalRequest,
  StudioSession,
} from "@/lib/maxwell/repositories";

vi.mock("@/lib/auth/review", () => ({
  getReviewRequestAccess: vi.fn(),
}));

vi.mock("@/lib/maxwell/repositories", () => ({
  appendProposalReviewEvent: vi.fn(async () => undefined),
  getProposalRequest: vi.fn(),
  getStudioSession: vi.fn(),
  getStudioVersions: vi.fn(async () => []),
  updateStudioSessionStatus: vi.fn(async () => undefined),
  getClientWorkspaceBySession: vi.fn(),
  createClientWorkspace: vi.fn(),
  activateClientWorkspace: vi.fn(),
  getLatestProposalRequest: vi.fn(),
  updateProposalRequestStatus: vi.fn(),
}));

vi.mock("@/lib/noon-app-integration", async () => {
  // NoonAppIntegrationError es un Error real usado para discriminar en el catch.
  class NoonAppIntegrationError extends Error {
    status: number;
    constructor(message: string, status = 502) {
      super(message);
      this.name = "NoonAppIntegrationError";
      this.status = status;
    }
  }
  return {
    NoonAppIntegrationError,
    sendPaymentConfirmedToNoonApp: vi.fn(async () => undefined),
  };
});

import * as auth from "@/lib/auth/review";
import * as repos from "@/lib/maxwell/repositories";
import * as noonApp from "@/lib/noon-app-integration";
import { GET, POST } from "@/app/api/maxwell/payment/route";

const ROUTE = "http://localhost/api/maxwell/payment";

function fakeProposal(overrides: Partial<ProposalRequest> = {}): ProposalRequest {
  return {
    id: "proposal-1",
    studioSessionId: "session-1",
    versionNumber: 1,
    publicToken: "token-abc",
    status: "sent",
    caseClassification: "normal",
    reviewRequired: true,
    reviewerId: null,
    draftContent: "body",
    deliveryChannel: "email",
    deliveryStatus: "sent",
    deliveryRecipient: "owner@noon.dev",
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

function fakeSession(overrides: Partial<StudioSession> = {}): StudioSession {
  return {
    id: "session-1",
    initialPrompt: "Build a thing",
    status: "proposal_sent",
    ownerEmail: "owner@noon.dev",
    ownerName: "Owner",
    ownerImage: null,
    projectType: null,
    goalSummary: null,
    complexityHint: null,
    language: "en",
    correctionsUsed: 0,
    maxCorrections: 2,
    proposalRequestedAt: null,
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

function postReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request(ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.getReviewRequestAccess).mockResolvedValue({
    authorized: true,
    via: "session",
    actor: "reviewer@noon.dev",
    viewer: { email: "reviewer@noon.dev", name: "Reviewer", image: null },
  });
  vi.mocked(repos.updateProposalRequestStatus).mockImplementation(async (id, status) => {
    return fakeProposal({ id, status });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ============================================================================
// Auth gating
// ============================================================================

describe("payment — auth gating", () => {
  it("GET 401 cuando reason=sign_in_required", async () => {
    vi.mocked(auth.getReviewRequestAccess).mockResolvedValue({
      authorized: false,
      reason: "sign_in_required",
      viewer: null,
    });
    const res = await GET(new Request(`${ROUTE}?session_id=s1`));
    expect(res.status).toBe(401);
  });

  it("GET 403 cuando reason=not_allowed", async () => {
    vi.mocked(auth.getReviewRequestAccess).mockResolvedValue({
      authorized: false,
      reason: "not_allowed",
      viewer: { email: "stranger@x.dev", name: null, image: null },
    });
    const res = await GET(new Request(`${ROUTE}?session_id=s1`));
    expect(res.status).toBe(403);
  });

  it("POST 401 cuando reason=sign_in_required", async () => {
    vi.mocked(auth.getReviewRequestAccess).mockResolvedValue({
      authorized: false,
      reason: "sign_in_required",
      viewer: null,
    });
    const res = await POST(postReq({ action: "expire_proposal", proposal_request_id: "p1" }));
    expect(res.status).toBe(401);
  });

  it("POST 403 cuando reason=not_configured", async () => {
    vi.mocked(auth.getReviewRequestAccess).mockResolvedValue({
      authorized: false,
      reason: "not_configured",
      viewer: null,
    });
    const res = await POST(postReq({ action: "expire_proposal", proposal_request_id: "p1" }));
    expect(res.status).toBe(403);
  });
});

// ============================================================================
// GET happy / errores
// ============================================================================

describe("payment — GET", () => {
  it("400 cuando falta session_id", async () => {
    const res = await GET(new Request(ROUTE));
    expect(res.status).toBe(400);
  });

  it("404 cuando la sesión no existe", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(null);
    const res = await GET(new Request(`${ROUTE}?session_id=s1`));
    expect(res.status).toBe(404);
  });

  it("devuelve estado, status de propuesta y workspace cuando existen", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(fakeWorkspace());
    vi.mocked(repos.getLatestProposalRequest).mockResolvedValue(fakeProposal({ status: "paid" }));

    const res = await GET(new Request(`${ROUTE}?session_id=session-1`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.session_id).toBe("session-1");
    expect(body.session_status).toBe("proposal_sent");
    expect(body.proposal_status).toBe("paid");
    expect(body.workspace).toMatchObject({ id: "workspace-1" });
  });
});

// ============================================================================
// Zod validation
// ============================================================================

describe("payment — Zod validation", () => {
  it("400 cuando el action no está en el discriminated union", async () => {
    const res = await POST(postReq({ action: "delete_everything" }));
    expect(res.status).toBe(400);
  });

  it("400 cuando falta proposal_request_id", async () => {
    const res = await POST(postReq({ action: "expire_proposal" }));
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// mark_payment_pending
// ============================================================================

describe("payment — mark_payment_pending", () => {
  it("404 cuando el proposal no existe", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(null);
    const res = await POST(postReq({
      action: "mark_payment_pending",
      proposal_request_id: "p1",
    }));
    expect(res.status).toBe(404);
  });

  it("409 cuando el proposal no está en estado 'sent'", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(
      fakeProposal({ status: "pending_review" }),
    );
    const res = await POST(postReq({
      action: "mark_payment_pending",
      proposal_request_id: "p1",
    }));
    expect(res.status).toBe(409);
  });

  it("happy path: actualiza a payment_pending", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal({ status: "sent" }));
    const res = await POST(postReq({
      action: "mark_payment_pending",
      proposal_request_id: "proposal-1",
    }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.proposal_status).toBe("payment_pending");
    expect(repos.updateProposalRequestStatus).toHaveBeenCalledWith(
      "proposal-1",
      "payment_pending",
    );
  });
});

// ============================================================================
// submit_payment_evidence
// ============================================================================

describe("payment — submit_payment_evidence", () => {
  it("happy path: pasa a payment_under_verification", async () => {
    const res = await POST(postReq({
      action: "submit_payment_evidence",
      proposal_request_id: "proposal-1",
      notes: "Sent via Wise",
    }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.proposal_status).toBe("payment_under_verification");
    expect(repos.updateProposalRequestStatus).toHaveBeenCalledWith(
      "proposal-1",
      "payment_under_verification",
    );
  });
});

// ============================================================================
// verify_payment
// ============================================================================

describe("payment — verify_payment", () => {
  it("404 cuando proposal no existe", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(null);
    const res = await POST(postReq({
      action: "verify_payment",
      proposal_request_id: "p1",
    }));
    expect(res.status).toBe(404);
  });

  it("404 cuando la session asociada no existe", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(null);
    const res = await POST(postReq({
      action: "verify_payment",
      proposal_request_id: "proposal-1",
    }));
    expect(res.status).toBe(404);
  });

  it("409 cuando la sesión no está en proposal_sent", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(
      fakeSession({ status: "clarifying" }),
    );
    const res = await POST(postReq({
      action: "verify_payment",
      proposal_request_id: "proposal-1",
    }));
    expect(res.status).toBe(409);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe("SESSION_NOT_AWAITING_PAYMENT");
  });

  it("workspace ya provisionado: retorna 200, NO crea workspace nuevo, sí notifica a Noon App", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(fakeWorkspace());

    const res = await POST(postReq({
      action: "verify_payment",
      proposal_request_id: "proposal-1",
      payment_reference: "REF-123",
    }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe("WORKSPACE_ALREADY_ACTIVE");
    expect(body.proposal_status).toBe("paid");
    expect(repos.createClientWorkspace).not.toHaveBeenCalled();
    expect(repos.activateClientWorkspace).not.toHaveBeenCalled();
    expect(noonApp.sendPaymentConfirmedToNoonApp).toHaveBeenCalled();
  });

  it("happy path: actualiza propuesta, sesión, crea workspace, lo activa y notifica", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(null);
    vi.mocked(repos.createClientWorkspace).mockResolvedValue(fakeWorkspace({ workspaceStatus: "in_preparation" }));
    vi.mocked(repos.activateClientWorkspace).mockResolvedValue(fakeWorkspace({ workspaceStatus: "active" }));

    const res = await POST(postReq({
      action: "verify_payment",
      proposal_request_id: "proposal-1",
      payment_reference: "REF-XYZ",
      summary: "Verified by Pedro",
    }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.session_status).toBe("converted");
    expect(body.proposal_status).toBe("paid");
    expect(repos.updateProposalRequestStatus).toHaveBeenCalledWith(
      "proposal-1",
      "paid",
      expect.objectContaining({ reviewerId: "reviewer@noon.dev" }),
    );
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith("session-1", "converted");
    expect(repos.createClientWorkspace).toHaveBeenCalledWith({
      studioSessionId: "session-1",
      paymentStatus: "confirmed",
    });
    expect(repos.activateClientWorkspace).toHaveBeenCalled();
    expect(noonApp.sendPaymentConfirmedToNoonApp).toHaveBeenCalled();
    // Auditoría OK del handoff
    expect(repos.appendProposalReviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "noon_app_payment_sent" }),
    );
  });

  it("usa el actor del payload si viene; si no, el del access", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(null);
    vi.mocked(repos.createClientWorkspace).mockResolvedValue(fakeWorkspace());
    vi.mocked(repos.activateClientWorkspace).mockResolvedValue(fakeWorkspace());

    await POST(postReq({
      action: "verify_payment",
      proposal_request_id: "proposal-1",
      actor: "override@noon.dev",
    }));

    expect(repos.updateProposalRequestStatus).toHaveBeenCalledWith(
      "proposal-1",
      "paid",
      expect.objectContaining({ reviewerId: "override@noon.dev" }),
    );
  });
});

// ============================================================================
// expire_proposal
// ============================================================================

describe("payment — expire_proposal", () => {
  it("happy path: pasa a expired", async () => {
    const res = await POST(postReq({
      action: "expire_proposal",
      proposal_request_id: "proposal-1",
    }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.proposal_status).toBe("expired");
    expect(repos.updateProposalRequestStatus).toHaveBeenCalledWith(
      "proposal-1",
      "expired",
      expect.objectContaining({ reviewerId: "reviewer@noon.dev" }),
    );
  });
});

// ============================================================================
// confirm_payment
// ============================================================================

describe("payment — confirm_payment", () => {
  it("404 cuando la session no existe", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(null);
    const res = await POST(postReq({
      action: "confirm_payment",
      session_id: "missing",
      payment_status: "confirmed",
    }));
    expect(res.status).toBe(404);
  });

  it("409 cuando no hay propuesta para esa sesión", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(null);
    vi.mocked(repos.getLatestProposalRequest).mockResolvedValue(null);

    const res = await POST(postReq({
      action: "confirm_payment",
      session_id: "session-1",
      payment_status: "confirmed",
    }));
    expect(res.status).toBe(409);
  });

  it("workspace ya provisionado: notify + 200 sin recrear", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(fakeWorkspace());
    vi.mocked(repos.getLatestProposalRequest).mockResolvedValue(fakeProposal());

    const res = await POST(postReq({
      action: "confirm_payment",
      session_id: "session-1",
      payment_status: "confirmed",
    }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe("WORKSPACE_ALREADY_ACTIVE");
    expect(repos.createClientWorkspace).not.toHaveBeenCalled();
    expect(noonApp.sendPaymentConfirmedToNoonApp).toHaveBeenCalled();
  });

  it("payment_status=failed: 200 sin activar workspace ni transicionar sesión", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(null);
    vi.mocked(repos.getLatestProposalRequest).mockResolvedValue(fakeProposal());

    const res = await POST(postReq({
      action: "confirm_payment",
      session_id: "session-1",
      payment_status: "failed",
    }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.message).toMatch(/payment failed/i);
    expect(repos.createClientWorkspace).not.toHaveBeenCalled();
    expect(repos.activateClientWorkspace).not.toHaveBeenCalled();
    expect(repos.updateStudioSessionStatus).not.toHaveBeenCalled();
    expect(noonApp.sendPaymentConfirmedToNoonApp).not.toHaveBeenCalled();
  });

  it("payment_status=confirmed pero session no en proposal_sent → 409", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(
      fakeSession({ status: "clarifying" }),
    );
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(null);
    vi.mocked(repos.getLatestProposalRequest).mockResolvedValue(fakeProposal());

    const res = await POST(postReq({
      action: "confirm_payment",
      session_id: "session-1",
      payment_status: "confirmed",
    }));
    expect(res.status).toBe(409);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe("SESSION_NOT_AWAITING_PAYMENT");
  });

  it("happy path: actualiza propuesta a paid, sesión a converted, activa workspace, notifica", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(null);
    vi.mocked(repos.getLatestProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.createClientWorkspace).mockResolvedValue(fakeWorkspace({ workspaceStatus: "in_preparation" }));
    vi.mocked(repos.activateClientWorkspace).mockResolvedValue(fakeWorkspace({ workspaceStatus: "active" }));

    const res = await POST(postReq({
      action: "confirm_payment",
      session_id: "session-1",
      payment_status: "confirmed",
      payment_reference: "REF-1",
      summary: "Auto-confirmed",
    }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.session_status).toBe("converted");
    expect(repos.updateProposalRequestStatus).toHaveBeenCalledWith(
      "proposal-1",
      "paid",
      expect.objectContaining({ reviewerId: "reviewer@noon.dev" }),
    );
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith("session-1", "converted");
    expect(repos.createClientWorkspace).toHaveBeenCalled();
    expect(repos.activateClientWorkspace).toHaveBeenCalled();
    expect(noonApp.sendPaymentConfirmedToNoonApp).toHaveBeenCalled();
  });
});

// ============================================================================
// Noon App handoff failures
// ============================================================================

describe("payment — Noon App handoff failure", () => {
  it("verify_payment: si Noon App falla → 502 con code NOON_APP_PAYMENT_HANDOFF_FAILED y registra noon_app_payment_failed", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(fakeProposal());
    vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(null);
    vi.mocked(repos.createClientWorkspace).mockResolvedValue(fakeWorkspace());
    vi.mocked(repos.activateClientWorkspace).mockResolvedValue(fakeWorkspace());

    const NoonAppErr = (noonApp as { NoonAppIntegrationError: new (m: string, s?: number) => Error & { status: number } }).NoonAppIntegrationError;
    vi.mocked(noonApp.sendPaymentConfirmedToNoonApp).mockRejectedValueOnce(
      new NoonAppErr("Noon App down", 502),
    );

    const res = await POST(postReq({
      action: "verify_payment",
      proposal_request_id: "proposal-1",
    }));

    expect(res.status).toBe(502);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe("NOON_APP_PAYMENT_HANDOFF_FAILED");
    expect(repos.appendProposalReviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "noon_app_payment_failed" }),
    );
  });
});
