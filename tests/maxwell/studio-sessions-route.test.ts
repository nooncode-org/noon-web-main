/**
 * tests/maxwell/studio-sessions-route.test.ts
 *
 * GET /api/maxwell/studio/sessions — v3 client portal Slice 1d.
 *
 * The session list now carries a `has_client_workspace` boolean per row, which
 * drives the Studio "Open workspace" re-entry affordances (list link + in-chat
 * banner). Auth + repository are mocked; the route handler, the hand-allowlisted
 * body map, and the dev-only `assertNoInternalFields` tripwire run for real, so
 * a regression that leaks an internal field would fail here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedViewer } from "@/lib/auth/session";
import type { StudioSessionListItem } from "@/lib/maxwell/repositories";

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: vi.fn(),
}));

vi.mock("@/lib/maxwell/repositories", () => ({
  listStudioSessionsForOwner: vi.fn(),
  softDeleteStudioSession: vi.fn(),
}));

import { getAuthenticatedViewer } from "@/lib/auth/session";
import { listStudioSessionsForOwner } from "@/lib/maxwell/repositories";
import { GET } from "@/app/api/maxwell/studio/sessions/route";

const mockViewer = vi.mocked(getAuthenticatedViewer);
const mockList = vi.mocked(listStudioSessionsForOwner);

const viewer: AuthenticatedViewer = {
  email: "client@example.com",
  name: null,
  image: null,
};

const rows: StudioSessionListItem[] = [
  {
    id: "s-with",
    initialPrompt: "build me a store",
    status: "converted",
    goalSummary: "Online store",
    updatedAt: "2026-06-17T00:00:00.000Z",
    hasClientWorkspace: true,
    proposalPublicToken: "tok-with",
  },
  {
    id: "s-without",
    initialPrompt: "just a draft",
    status: "intake",
    goalSummary: null,
    updatedAt: "2026-06-16T00:00:00.000Z",
    hasClientWorkspace: false,
    proposalPublicToken: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/maxwell/studio/sessions", () => {
  it("401s when unauthenticated and never queries", async () => {
    mockViewer.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("surfaces has_client_workspace per row (snake_case allowlist)", async () => {
    mockViewer.mockResolvedValue(viewer);
    mockList.mockResolvedValue(rows);

    const res = await GET();
    const body = (await res.json()) as {
      sessions: Array<Record<string, unknown>>;
    };

    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(viewer.email);
    expect(body.sessions).toEqual([
      {
        id: "s-with",
        initial_prompt: "build me a store",
        status: "converted",
        goal_summary: "Online store",
        updated_at: "2026-06-17T00:00:00.000Z",
        has_client_workspace: true,
        proposal_public_token: "tok-with",
      },
      {
        id: "s-without",
        initial_prompt: "just a draft",
        status: "intake",
        goal_summary: null,
        updated_at: "2026-06-16T00:00:00.000Z",
        has_client_workspace: false,
        proposal_public_token: null,
      },
    ]);
  });

  it("never lets the list payload carry an unexpected key", async () => {
    mockViewer.mockResolvedValue(viewer);
    mockList.mockResolvedValue(rows);

    const res = await GET();
    const body = (await res.json()) as {
      sessions: Array<Record<string, unknown>>;
    };

    // The map is a hand-written allowlist; this pins the exact key set so a
    // future change that spreads the raw row (and could leak owner_email or
    // other internal columns) trips the test, mirroring the route's own
    // `assertNoInternalFields` guard.
    for (const row of body.sessions) {
      expect(Object.keys(row).sort()).toEqual([
        "goal_summary",
        "has_client_workspace",
        "id",
        "initial_prompt",
        "proposal_public_token",
        "status",
        "updated_at",
      ]);
    }
  });
});
