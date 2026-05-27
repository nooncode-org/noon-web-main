/**
 * tests/maxwell/prototype.test.ts
 *
 * End-to-end tests for `POST /api/maxwell/prototype`.
 *
 * Mocks: auth (session + ownership), repositories, v0 SDK wrapper,
 * Maxwell quota + classifier + brief builder + style packs. The route's
 * own discriminated-union schema validation, error handling, and state
 * transitions run real.
 *
 * Coverage matrix:
 *   - Boot: missing V0_API_KEY → 503
 *   - Auth: viewer null → 401; ownership fail → 403
 *   - Session: missing → 404
 *   - Schema (discriminated union):
 *     - action: create → required messages + last_user_msg + last_assistant_msg
 *     - action: update → required chatId + prompt
 *     - Invalid action → 400
 *   - Create:
 *     - Quota exceeded → 403 with contact_agent flag
 *     - Happy path → Quality Layer pipeline (classify → setStylePackId →
 *       getStudioBrief → buildPrototypeBrief) → returns { pending,
 *       chatId, action: "create" }
 *     - v0 throws → resets session status from "generating_prototype" →
 *       "clarifying" + returns 500
 *   - Update:
 *     - Correction guard fails → 409 with MaxwellGuardError code
 *     - Happy path: uses stylePackId from session for buildCorrectionBrief,
 *       returns { pending, chatId, prompt, action: "update" }
 *     - Pre-Quality-Layer session (stylePackId null) → buildCorrectionBrief
 *       called without stylePack
 *     - v0 throws → resets session status → "prototype_ready" + 500
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioSession } from "@/lib/maxwell/repositories";
import type { StylePack } from "@/lib/maxwell/style-packs";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/api-ia", () => ({
  createV0Prototype: vi.fn(),
  updateV0Prototype: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: vi.fn(),
}));

vi.mock("@/lib/auth/ownership", () => ({
  viewerOwnsStudioSession: vi.fn(() => true),
}));

vi.mock("@/lib/maxwell/repositories", () => ({
  getStudioSession: vi.fn(),
  getStudioBrief: vi.fn(),
  setStylePackId: vi.fn(async () => undefined),
  createStudioVersion: vi.fn(),
  incrementCorrectionsUsed: vi.fn(),
  updateStudioSessionStatus: vi.fn(async () => undefined),
  appendStudioMessage: vi.fn(async () => undefined),
}));

vi.mock("@/lib/maxwell/studio-guards", async () => {
  class MaxwellGuardError extends Error {
    constructor(message: string, public readonly code: string) {
      super(message);
      this.name = "MaxwellGuardError";
    }
  }
  return {
    assertCanRequestCorrection: vi.fn(),
    MaxwellGuardError,
  };
});

vi.mock("@/lib/maxwell/prototype-quota", () => ({
  evaluateInitialPrototypeCreate: vi.fn(),
}));

vi.mock("@/lib/maxwell/style-classifier", () => ({
  classifyStylePack: vi.fn(),
}));

vi.mock("@/lib/maxwell/prototype-brief", () => ({
  buildPrototypeBrief: vi.fn(() => "BUILT BRIEF"),
  buildCorrectionBrief: vi.fn((prompt) => `CORRECTION: ${prompt}`),
}));

vi.mock("@/lib/maxwell/style-packs", () => ({
  getStylePackById: vi.fn(),
}));

import * as apiIa from "@/lib/api-ia";
import * as authSession from "@/lib/auth/session";
import * as ownership from "@/lib/auth/ownership";
import * as repos from "@/lib/maxwell/repositories";
import * as guards from "@/lib/maxwell/studio-guards";
import * as quota from "@/lib/maxwell/prototype-quota";
import * as classifier from "@/lib/maxwell/style-classifier";
import * as briefBuilder from "@/lib/maxwell/prototype-brief";
import * as stylePacks from "@/lib/maxwell/style-packs";
import { POST } from "@/app/api/maxwell/prototype/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROUTE = "http://localhost/api/maxwell/prototype";

function postReq(body: unknown) {
  return new Request(ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeSession(overrides: Partial<StudioSession> = {}): StudioSession {
  return {
    id: "session-1",
    initialPrompt: "Build a thing",
    status: "clarifying",
    ownerEmail: "owner@noon.dev",
    ownerName: "Owner",
    ownerImage: null,
    projectType: "landing",
    goalSummary: "Acme",
    complexityHint: "medio",
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

function fakeStylePack(): StylePack {
  return {
    id: "clean-professional",
    name: "Clean Professional",
    feel: "Minimal, B&W, professional.",
    refs: [
      { url: "https://example.com/a", v0Hint: "minimal" },
      { url: "https://example.com/b", v0Hint: "professional" },
      { url: "https://example.com/c" },
    ],
  };
}

const validCreateBody = {
  action: "create",
  messages: [
    { role: "user" as const, content: "I want a website" },
    { role: "assistant" as const, content: "What kind?" },
  ],
  last_user_msg: "A landing page for my bakery",
  last_assistant_msg: "Generating now.",
  session_id: "session-1",
};

const validUpdateBody = {
  action: "update",
  chatId: "v0-chat-abc",
  prompt: "Make the hero bigger",
  session_id: "session-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("V0_API_KEY", "test-v0-key");

  vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue({
    email: "owner@noon.dev",
    name: "Owner",
    image: null,
  });
  vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
  vi.mocked(repos.getStudioBrief).mockResolvedValue(null);
  vi.mocked(quota.evaluateInitialPrototypeCreate).mockResolvedValue(null);
  vi.mocked(classifier.classifyStylePack).mockResolvedValue(fakeStylePack());
  vi.mocked(stylePacks.getStylePackById).mockReturnValue(fakeStylePack());
  vi.mocked(apiIa.createV0Prototype).mockResolvedValue({
    chatId: "v0-new-chat",
    demoUrl: "https://v0.dev/preview/new",
  });
  vi.mocked(apiIa.updateV0Prototype).mockResolvedValue({
    chatId: "v0-chat-abc",
    demoUrl: "https://v0.dev/preview/upd",
  });
  vi.mocked(repos.incrementCorrectionsUsed).mockResolvedValue(
    fakeSession({ correctionsUsed: 1 }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Boot + auth
// ---------------------------------------------------------------------------

describe("POST /api/maxwell/prototype — boot + auth", () => {
  it("returns 503 when V0_API_KEY is not configured", async () => {
    vi.stubEnv("V0_API_KEY", "");
    const res = await POST(postReq(validCreateBody));
    expect(res.status).toBe(503);
  });

  it("returns 401 when viewer is not authenticated", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(null);
    const res = await POST(postReq(validCreateBody));
    expect(res.status).toBe(401);
  });

  it("returns 404 when session is not found", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(null);
    const res = await POST(postReq(validCreateBody));
    expect(res.status).toBe(404);
  });

  it("returns 403 when viewer does not own the session", async () => {
    vi.mocked(ownership.viewerOwnsStudioSession).mockReturnValueOnce(false);
    const res = await POST(postReq(validCreateBody));
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Zod validation
// ---------------------------------------------------------------------------

describe("POST /api/maxwell/prototype — schema validation", () => {
  it("returns 400 when action is not in the discriminated union", async () => {
    const res = await POST(postReq({ action: "delete", session_id: "s1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when create payload is missing last_user_msg", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { last_user_msg: _omit, ...rest } = validCreateBody;
    const res = await POST(postReq(rest));
    expect(res.status).toBe(400);
  });

  it("returns 400 when update payload is missing chatId", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { chatId: _omit, ...rest } = validUpdateBody;
    const res = await POST(postReq(rest));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Create — quota + happy path + failure
// ---------------------------------------------------------------------------

describe("POST /api/maxwell/prototype — action: create", () => {
  it("returns 403 + contact_agent=true when monthly user quota is exceeded", async () => {
    vi.mocked(quota.evaluateInitialPrototypeCreate).mockResolvedValueOnce({
      code: "USER_MONTHLY_PROTOTYPE_QUOTA",
      message: "Monthly quota reached.",
    });

    const res = await POST(postReq(validCreateBody));
    expect(res.status).toBe(403);

    const body = (await res.json()) as { code: string; contact_agent: boolean };
    expect(body.code).toBe("USER_MONTHLY_PROTOTYPE_QUOTA");
    expect(body.contact_agent).toBe(true);
  });

  it("runs the Quality Layer pipeline + returns pending=true on success", async () => {
    const res = await POST(postReq(validCreateBody));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { pending: boolean; chatId: string; action: string };
    expect(body).toEqual({
      pending: true,
      chatId: "v0-new-chat",
      session_id: "session-1",
      action: "create",
    });

    // Status transitioned to generating_prototype before v0 call
    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith(
      "session-1",
      "generating_prototype",
    );

    // Quality Layer pipeline ran in order
    expect(classifier.classifyStylePack).toHaveBeenCalled();
    expect(repos.setStylePackId).toHaveBeenCalledWith("session-1", "clean-professional");
    expect(repos.getStudioBrief).toHaveBeenCalledWith("session-1");
    expect(briefBuilder.buildPrototypeBrief).toHaveBeenCalled();

    // v0 called with the built brief + system prompt
    expect(apiIa.createV0Prototype).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "BUILT BRIEF" }),
    );
  });

  it("resets status to 'clarifying' and returns 500 when v0 throws (only if still stuck)", async () => {
    vi.mocked(apiIa.createV0Prototype).mockRejectedValueOnce(new Error("v0 503"));
    // Recovery check: getStudioSession is called twice — once at top, then
    // again in the error branch to check if the status is still stuck.
    vi.mocked(repos.getStudioSession)
      .mockResolvedValueOnce(fakeSession())
      .mockResolvedValueOnce(fakeSession({ status: "generating_prototype" }));

    const res = await POST(postReq(validCreateBody));
    expect(res.status).toBe(500);

    // The recovery code calls updateStudioSessionStatus a SECOND time with
    // "clarifying". First call was "generating_prototype" before the v0 attempt.
    const calls = vi.mocked(repos.updateStudioSessionStatus).mock.calls;
    expect(calls).toContainEqual(["session-1", "clarifying"]);
  });
});

// ---------------------------------------------------------------------------
// Update — guard + happy path + failure
// ---------------------------------------------------------------------------

describe("POST /api/maxwell/prototype — action: update", () => {
  it("returns 409 with code when correction guard rejects", async () => {
    vi.mocked(guards.assertCanRequestCorrection).mockImplementationOnce(() => {
      throw new guards.MaxwellGuardError(
        "Maximum corrections used.",
        "CORRECTION_QUOTA_REACHED",
      );
    });

    const res = await POST(postReq(validUpdateBody));
    expect(res.status).toBe(409);

    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("CORRECTION_QUOTA_REACHED");
  });

  it("uses session.stylePackId for buildCorrectionBrief when present", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValueOnce(
      fakeSession({ stylePackId: "clean-professional", status: "prototype_ready" }),
    );

    const res = await POST(postReq(validUpdateBody));
    expect(res.status).toBe(200);

    expect(stylePacks.getStylePackById).toHaveBeenCalledWith("clean-professional");
    expect(briefBuilder.buildCorrectionBrief).toHaveBeenCalledWith(
      "Make the hero bigger",
      expect.objectContaining({ id: "clean-professional" }),
    );
  });

  it("calls buildCorrectionBrief without stylePack when session has no stylePackId (pre-Quality-Layer)", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValueOnce(
      fakeSession({ stylePackId: null, status: "prototype_ready" }),
    );

    const res = await POST(postReq(validUpdateBody));
    expect(res.status).toBe(200);

    expect(stylePacks.getStylePackById).not.toHaveBeenCalled();
    expect(briefBuilder.buildCorrectionBrief).toHaveBeenCalledWith(
      "Make the hero bigger",
      undefined,
    );
  });

  it("returns pending=true + increments corrections on update happy path", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValueOnce(
      fakeSession({ status: "prototype_ready" }),
    );

    const res = await POST(postReq(validUpdateBody));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { pending: boolean; chatId: string; action: string; prompt: string };
    expect(body).toEqual({
      pending: true,
      chatId: "v0-chat-abc",
      session_id: "session-1",
      prompt: "Make the hero bigger",
      action: "update",
    });

    expect(repos.updateStudioSessionStatus).toHaveBeenCalledWith(
      "session-1",
      "revision_requested",
    );
    expect(repos.incrementCorrectionsUsed).toHaveBeenCalledWith("session-1");
  });

  it("resets status to 'prototype_ready' + returns 500 when update throws", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValueOnce(
      fakeSession({ status: "prototype_ready" }),
    );
    vi.mocked(apiIa.updateV0Prototype).mockRejectedValueOnce(new Error("v0 504"));

    const res = await POST(postReq(validUpdateBody));
    expect(res.status).toBe(500);

    const calls = vi.mocked(repos.updateStudioSessionStatus).mock.calls;
    expect(calls).toContainEqual(["session-1", "prototype_ready"]);
    expect(repos.incrementCorrectionsUsed).not.toHaveBeenCalled();
  });
});
