/**
 * tests/maxwell/v3-isolation-wiring.test.ts
 *
 * v3 wiring smoke — proves the `assertNoInternalFields` dev guards
 * added in:
 *   - app/api/maxwell/studio/session/route.ts
 *   - app/api/maxwell/studio/sessions/route.ts
 *   - app/api/maxwell/workspace/route.ts (client path only)
 *
 * do NOT trip on the current hand-allowlisted response shapes.
 *
 * Why this matters as a SEPARATE test file:
 *   1. The guards run under `process.env.NODE_ENV !== "production"`,
 *      which is exactly the vitest default. So every existing test
 *      that hits these routes already exercises the asserts — if I
 *      regressed any current response, the existing suites would
 *      fail. The point of THIS file is to additionally lock in:
 *
 *      (a) realistic mock data with every field populated (not
 *          minimal happy paths) doesn't trip the guard,
 *      (b) if someone later swaps the manual allowlist for a raw
 *          DB-object return, the guard catches it before merge.
 *
 *   2. Future PRs that touch these routes will run this file and
 *      see clearly what "v3 isolation contract" means for each
 *      endpoint, in one place.
 *
 * What we don't cover here:
 *   - The negative case ("if I accidentally returned `proposal` raw,
 *     the guard would fire") — that requires modifying the route in
 *     the test, which is more invasive than the value warrants. The
 *     guard's own test in `tests/security/project-isolation.test.ts`
 *     already pins the assert's error-throwing behaviour.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ClientWorkspace,
  ProposalRequest,
  StudioSession,
  StudioSessionListItem,
} from "@/lib/maxwell/repositories";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: vi.fn(),
}));

vi.mock("@/lib/auth/ownership", () => ({
  viewerOwnsStudioSession: vi.fn(() => true),
}));

vi.mock("@/lib/auth/review", () => ({
  getReviewRequestAccess: vi.fn(),
}));

vi.mock("@/lib/maxwell/repositories", () => ({
  getStudioSession: vi.fn(),
  getStudioMessagesForViewer: vi.fn(async () => []),
  getStudioVersions: vi.fn(async () => []),
  getClientWorkspaceBySession: vi.fn(),
  getLatestProposalRequest: vi.fn(async () => null),
  listStudioSessionsForOwner: vi.fn(),
  softDeleteStudioSession: vi.fn(),
  getWorkspaceUpdates: vi.fn(async () => []),
  getPaymentEvents: vi.fn(async () => []),
  isProposalAwaitingWorkspace: vi.fn(() => false),
}));

import * as authSession from "@/lib/auth/session";
import * as reviewAuth from "@/lib/auth/review";
import * as repos from "@/lib/maxwell/repositories";

import { GET as getStudioSessionRoute } from "@/app/api/maxwell/studio/session/route";
import { GET as getStudioSessionsRoute } from "@/app/api/maxwell/studio/sessions/route";
import { GET as getWorkspaceRoute } from "@/app/api/maxwell/workspace/route";

// ---------------------------------------------------------------------------
// Fixtures — every field populated so the dev guard sees a realistic
// payload, not a sparse happy-path one. If a future PR forgets to
// strip a field that gets populated only in production, the realistic
// fixture catches it here.
// ---------------------------------------------------------------------------

function fullSession(): StudioSession {
  return {
    id: "session-1",
    initialPrompt: "Build a thing",
    status: "converted",
    ownerEmail: "owner@noon.dev",
    ownerName: "Owner",
    ownerImage: null,
    projectType: "landing",
    goalSummary: "Acme launchpad",
    complexityHint: "medio",
    language: "en",
    correctionsUsed: 1,
    maxCorrections: 3,
    proposalRequestedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stylePackId: "tech-digital", // ← internal — must NOT leak
    prototypeWorkspaceId: null,
    shareToken: null,
    shareTokenUrl: null,
    prototypeSharedAt: null,
  };
}

function fullWorkspace(): ClientWorkspace {
  return {
    id: "workspace-1",
    studioSessionId: "session-1",
    paymentStatus: "confirmed",
    workspaceStatus: "active",
    latestUpdateSummary: "Kickoff done",
    noonAppProjectId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function fullProposal(): ProposalRequest {
  return {
    id: "proposal-1",
    studioSessionId: "session-1",
    versionNumber: 1,
    publicToken: "token-abc",
    status: "paid",
    caseClassification: "special", // ← internal triage label — must NOT leak
    reviewRequired: true, // ← internal
    reviewerId: "ops-42", // ← internal
    draftContent: "body",
    deliveryChannel: "email",
    deliveryStatus: "sent",
    deliveryRecipient: "client@noon.dev",
    approvedAmountUsd: 1250,
    approvedCurrency: "USD",
    stripeCheckoutSessionId: "cs_test_1", // ← internal
    stripePaymentIntentId: "pi_test_1", // ← internal
    stripePaidAt: new Date().toISOString(),
    sentAt: new Date().toISOString(),
    firstOpenedAt: null,
    expiresAt: null,
    reviewNotifiedAt: new Date().toISOString(), // ← internal
    reviewRemindedAt: null, // ← internal
    reviewEscalatedAt: null, // ← internal
    autoSendDueAt: null, // ← internal
    supersedesProposalRequestId: null, // ← internal
    supersededByProposalRequestId: null, // ← internal
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function listItem(id: string): StudioSessionListItem {
  return {
    id,
    initialPrompt: `Build thing ${id}`,
    status: "prototype_ready",
    goalSummary: `Goal ${id}`,
    updatedAt: new Date().toISOString(),
    hasClientWorkspace: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue({
    email: "owner@noon.dev",
    name: "Owner",
    image: null,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// GET /api/maxwell/studio/session
// ---------------------------------------------------------------------------

describe("GET /api/maxwell/studio/session — v3 isolation guard", () => {
  it("returns 200 and no internal fields with a fully-populated session + proposal", async () => {
    // The fixture session has stylePackId set, the fixture proposal
    // has reviewerId + stripePaymentIntentId + reviewRequired etc.
    // If the route mistakenly serialised either object whole, the
    // dev guard would throw → the request would 500 → this test
    // would fail with a non-200.
    vi.mocked(repos.getStudioSession).mockResolvedValue(fullSession());
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(fullWorkspace());
    vi.mocked(repos.getLatestProposalRequest).mockResolvedValue(fullProposal());

    const res = await getStudioSessionRoute(
      new Request("http://localhost/api/maxwell/studio/session?session_id=session-1"),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    // Sanity: the response shape contract.
    expect(body.session).toMatchObject({
      id: "session-1",
      status: "converted",
      goalSummary: "Acme launchpad",
    });
    expect(body.workspace).toMatchObject({ id: "workspace-1" });
    expect(body.proposal_status).toBe("paid");

    // Explicit: no internal fields leaked through any nested path.
    expect(body).not.toHaveProperty("session.stylePackId");
    expect(body).not.toHaveProperty("workspace.reviewerId");
    expect(body).not.toHaveProperty("workspace.stripePaymentIntentId");
  });

  it("returns 401 without an authenticated viewer (guard never runs)", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(null);
    const res = await getStudioSessionRoute(
      new Request("http://localhost/api/maxwell/studio/session?session_id=session-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 with a missing session (guard never runs)", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(null);
    const res = await getStudioSessionRoute(
      new Request("http://localhost/api/maxwell/studio/session?session_id=missing"),
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/maxwell/studio/sessions
// ---------------------------------------------------------------------------

describe("GET /api/maxwell/studio/sessions — v3 isolation guard", () => {
  it("returns the mapped list with snake_case keys and no internal fields", async () => {
    vi.mocked(repos.listStudioSessionsForOwner).mockResolvedValue([
      listItem("a"),
      listItem("b"),
      listItem("c"),
    ]);

    const res = await getStudioSessionsRoute();
    expect(res.status).toBe(200);

    const body = (await res.json()) as { sessions: Record<string, unknown>[] };
    expect(body.sessions).toHaveLength(3);
    expect(body.sessions[0]).toMatchObject({
      id: "a",
      initial_prompt: "Build thing a",
      status: "prototype_ready",
      goal_summary: "Goal a",
      has_client_workspace: true,
    });
    // The list item shape only has these 6 keys (Slice 1d added
    // `has_client_workspace`) — no internal fields could leak — but the guard
    // still runs (defense-in-depth) so a future PR adding
    // `reviewer_id: s.reviewerId` would fail loud.
  });

  it("returns 401 when unauthenticated (guard never runs)", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(null);
    const res = await getStudioSessionsRoute();
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/maxwell/workspace — client path
// ---------------------------------------------------------------------------

describe("GET /api/maxwell/workspace — v3 isolation guard (client path)", () => {
  it("returns 200 + clean payload for a non-internal viewer with a ready workspace", async () => {
    // Non-internal viewer: reviewAccess.authorized = false → isInternal = false.
    vi.mocked(reviewAuth.getReviewRequestAccess).mockResolvedValue({
      authorized: false,
      reason: "not_allowed",
      viewer: { email: "owner@noon.dev", name: "Owner", image: null },
    });
    vi.mocked(repos.getStudioSession).mockResolvedValue(fullSession());
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(fullWorkspace());

    const res = await getWorkspaceRoute(
      new Request("http://localhost/api/maxwell/workspace?session_id=session-1"),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.workspace_status).toBe("ready");
    expect(body.project_name).toBe("Acme launchpad");
    expect(body.workspace).toMatchObject({ id: "workspace-1" });
    // Critical: payment_events MUST NOT be present on the client path.
    expect(body).not.toHaveProperty("payment_events");
  });

  it("internal viewer path includes payment_events (guard intentionally skipped)", async () => {
    // Internal/ops viewer DOES get payment_events with the full
    // Stripe identifiers — that's the ops dashboard contract. The
    // guard is bypassed on this path because those ARE internal
    // fields BY DESIGN here.
    vi.mocked(reviewAuth.getReviewRequestAccess).mockResolvedValue({
      authorized: true,
      via: "session",
      actor: "ops@noon.dev",
      viewer: { email: "ops@noon.dev", name: "Ops", image: null },
    });
    vi.mocked(repos.getStudioSession).mockResolvedValue(fullSession());
    vi.mocked(repos.getClientWorkspaceBySession).mockResolvedValue(fullWorkspace());
    vi.mocked(repos.getPaymentEvents).mockResolvedValue([
      {
        id: "pe-1",
        studioSessionId: "session-1",
        eventType: "confirmed",
        amountUsd: 1250,
        reference: "pi_test_1",
        notes: null,
        provider: "stripe",
        providerEventId: "stripe_evt_1",
        providerSessionId: null,
        providerPaymentIntentId: "pi_test_1",
        currency: "USD",
        payloadJson: { raw: "kept for ops" },
        createdBy: "stripe-webhook",
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await getWorkspaceRoute(
      new Request("http://localhost/api/maxwell/workspace?session_id=session-1"),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("payment_events");
    const events = body.payment_events as Array<Record<string, unknown>>;
    expect(events).toHaveLength(1);
    // Internal fields ARE present on the ops path — that's the contract.
    expect(events[0]).toHaveProperty("providerEventId", "stripe_evt_1");
    expect(events[0]).toHaveProperty("payloadJson");
  });
});
