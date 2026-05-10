/**
 * tests/maxwell/payment-evidence.test.ts
 *
 * Coverage for the customer-facing `POST /api/maxwell/payment/evidence` route.
 * Auth (NextAuth viewer), repository calls and the route handler are mocked.
 * The Zod schema, ownership gate, state guard and side-effect order are
 * exercised for real.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: vi.fn(),
}));

vi.mock("@/lib/maxwell/repositories", () => ({
  getProposalRequest: vi.fn(),
  getStudioSession: vi.fn(),
  updateProposalRequestStatus: vi.fn(),
  appendProposalReviewEvent: vi.fn(),
}));

import * as authSession from "@/lib/auth/session";
import * as repos from "@/lib/maxwell/repositories";
import type { ProposalRequest, StudioSession } from "@/lib/maxwell/repositories";
import { POST } from "@/app/api/maxwell/payment/evidence/route";

const ROUTE_URL = "http://localhost/api/maxwell/payment/evidence";

function jsonRequest(body: unknown): Request {
  return new Request(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VIEWER = {
  email: "client@example.com",
  name: "Client",
  image: null,
};

// Partial fixtures cast to the full types. The route handler only reads a few
// fields (id, status, studioSessionId, ownerEmail) so the rest don't need to
// be populated for the assertions we care about.
const SESSION_OWNED = {
  id: "session-1",
  ownerEmail: "client@example.com",
} as unknown as StudioSession;

const PROPOSAL_PAYMENT_PENDING = {
  id: "proposal-1",
  studioSessionId: "session-1",
  status: "payment_pending",
} as unknown as ProposalRequest;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repos.updateProposalRequestStatus).mockImplementation(
    async (id, status) =>
      ({
        id,
        status,
      } as unknown as ProposalRequest),
  );
  vi.mocked(repos.appendProposalReviewEvent).mockResolvedValue(
    {} as Awaited<ReturnType<typeof repos.appendProposalReviewEvent>>,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/maxwell/payment/evidence — auth", () => {
  it("returns 401 when no viewer is authenticated", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(null);

    const res = await POST(jsonRequest({ proposal_request_id: "p-1" }));
    expect(res.status).toBe(401);
    expect(repos.getProposalRequest).not.toHaveBeenCalled();
  });

  it("returns 403 when the viewer does NOT own the studio session", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(VIEWER);
    vi.mocked(repos.getProposalRequest).mockResolvedValue(PROPOSAL_PAYMENT_PENDING);
    vi.mocked(repos.getStudioSession).mockResolvedValue({
      ...SESSION_OWNED,
      ownerEmail: "someone-else@example.com",
    });

    const res = await POST(jsonRequest({ proposal_request_id: "p-1" }));
    expect(res.status).toBe(403);
    expect(repos.updateProposalRequestStatus).not.toHaveBeenCalled();
  });
});

describe("POST /api/maxwell/payment/evidence — body validation", () => {
  beforeEach(() => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(VIEWER);
  });

  it("returns 400 on invalid JSON", async () => {
    const res = await POST(jsonRequest("not-json{"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when proposal_request_id is missing", async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when notes exceeds 1000 chars", async () => {
    const res = await POST(
      jsonRequest({
        proposal_request_id: "p-1",
        notes: "x".repeat(1001),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/maxwell/payment/evidence — lookups", () => {
  beforeEach(() => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(VIEWER);
  });

  it("returns 404 when the proposal does not exist", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(null);

    const res = await POST(jsonRequest({ proposal_request_id: "p-missing" }));
    expect(res.status).toBe(404);
    expect(repos.getStudioSession).not.toHaveBeenCalled();
  });

  it("returns 404 when the linked studio session is missing", async () => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue(PROPOSAL_PAYMENT_PENDING);
    vi.mocked(repos.getStudioSession).mockResolvedValue(null);

    const res = await POST(jsonRequest({ proposal_request_id: "p-1" }));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/maxwell/payment/evidence — proposal state gate", () => {
  beforeEach(() => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(VIEWER);
    vi.mocked(repos.getStudioSession).mockResolvedValue(SESSION_OWNED);
  });

  it.each([
    "pending_review",
    "under_review",
    "approved",
    "sent",
    "payment_under_verification",
    "paid",
    "expired",
    "returned",
    "escalated",
  ])("returns 409 when status is '%s'", async (status) => {
    vi.mocked(repos.getProposalRequest).mockResolvedValue({
      ...PROPOSAL_PAYMENT_PENDING,
      status: status as never,
    });

    const res = await POST(jsonRequest({ proposal_request_id: "p-1" }));
    expect(res.status).toBe(409);

    const json = (await res.json()) as { code: string; proposal_status: string };
    expect(json.code).toBe("INVALID_PROPOSAL_STATE");
    expect(json.proposal_status).toBe(status);
    expect(repos.updateProposalRequestStatus).not.toHaveBeenCalled();
  });
});

describe("POST /api/maxwell/payment/evidence — happy path", () => {
  beforeEach(() => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(VIEWER);
    vi.mocked(repos.getProposalRequest).mockResolvedValue(PROPOSAL_PAYMENT_PENDING);
    vi.mocked(repos.getStudioSession).mockResolvedValue(SESSION_OWNED);
  });

  it("transitions to payment_under_verification and audits the event", async () => {
    const res = await POST(
      jsonRequest({
        proposal_request_id: "p-1",
        notes: "wire transfer ref 99-XYZ",
      }),
    );

    expect(res.status).toBe(200);

    expect(repos.updateProposalRequestStatus).toHaveBeenCalledWith(
      "p-1",
      "payment_under_verification",
    );

    expect(repos.appendProposalReviewEvent).toHaveBeenCalledWith({
      proposalRequestId: "p-1",
      action: "client_evidence_submitted",
      actor: "client:client@example.com",
      notes: "wire transfer ref 99-XYZ",
    });

    const json = (await res.json()) as {
      proposal_status: string;
      message: string;
    };
    expect(json.proposal_status).toBe("payment_under_verification");
    expect(json.message).toMatch(/under verification/i);
  });

  it("succeeds without notes", async () => {
    const res = await POST(jsonRequest({ proposal_request_id: "p-1" }));

    expect(res.status).toBe(200);
    expect(repos.appendProposalReviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({ notes: undefined }),
    );
  });

  it("records the client email in the actor field", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue({
      ...VIEWER,
      email: "another.client@noon.dev",
    });
    // Override the session ownership so the new viewer passes the gate.
    vi.mocked(repos.getStudioSession).mockResolvedValue({
      ...SESSION_OWNED,
      ownerEmail: "another.client@noon.dev",
    } as unknown as StudioSession);

    await POST(jsonRequest({ proposal_request_id: "p-1" }));

    expect(repos.appendProposalReviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "client:another.client@noon.dev" }),
    );
  });
});

describe("POST /api/maxwell/payment/evidence — error handling", () => {
  beforeEach(() => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(VIEWER);
    vi.mocked(repos.getProposalRequest).mockResolvedValue(PROPOSAL_PAYMENT_PENDING);
    vi.mocked(repos.getStudioSession).mockResolvedValue(SESSION_OWNED);
  });

  it("returns 500 if the status update throws", async () => {
    vi.mocked(repos.updateProposalRequestStatus).mockRejectedValue(
      new Error("DB exploded"),
    );

    // Suppress expected console.error from the route handler
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(jsonRequest({ proposal_request_id: "p-1" }));
    expect(res.status).toBe(500);

    errSpy.mockRestore();
  });
});
