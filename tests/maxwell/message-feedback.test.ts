/**
 * tests/maxwell/message-feedback.test.ts
 *
 * Coverage for `POST /api/maxwell/message-feedback` — the thumbs up/down
 * mechanism for Maxwell assistant responses.
 *
 * Mocked: auth (session + ownership), repos (getStudioMessage,
 * getStudioSession, setStudioMessageFeedback). Schema, gating logic
 * (assistant + chat only), and error handling run real.
 *
 * Coverage matrix:
 *   - Auth: viewer null → 401
 *   - Schema: missing message_id → 400 (zod with fieldErrors)
 *   - Schema: invalid feedback value → 400
 *   - Message: not found → 404
 *   - Message: not assistant → 400 (feedback only valid on Maxwell responses)
 *   - Message: assistant but wrong messageType (e.g. system_event) → 400
 *   - Session: missing → 404
 *   - Ownership: viewer not owner → 403
 *   - Happy path up → returns { message_id, feedback: "up" }
 *   - Happy path down → returns { message_id, feedback: "down" }
 *   - Happy path null (clear) → returns { message_id, feedback: null }
 *   - Storage failure → 500 with generic message (no leak)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  StudioMessage,
  StudioSession,
  MessageFeedback,
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

vi.mock("@/lib/maxwell/repositories", () => ({
  getStudioMessage: vi.fn(),
  getStudioSession: vi.fn(),
  setStudioMessageFeedback: vi.fn(),
}));

import * as authSession from "@/lib/auth/session";
import * as ownership from "@/lib/auth/ownership";
import * as repos from "@/lib/maxwell/repositories";
import { POST } from "@/app/api/maxwell/message-feedback/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROUTE = "http://localhost/api/maxwell/message-feedback";

function postReq(body: unknown) {
  return new Request(ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeMessage(overrides: Partial<StudioMessage> = {}): StudioMessage {
  return {
    id: "msg-1",
    studioSessionId: "session-1",
    role: "assistant",
    messageType: "chat",
    content: "Maxwell reply",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function fakeSession(overrides: Partial<StudioSession> = {}): StudioSession {
  return {
    id: "session-1",
    initialPrompt: "Build a thing",
    status: "clarifying",
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
    stylePackId: null,
    prototypeWorkspaceId: null,
    shareToken: null,
    shareTokenUrl: null,
    prototypeSharedAt: null,
    ...overrides,
  };
}

// MessageFeedback is just "up" | "down" — the route returns whatever the
// repo returns. For "cleared" feedback the repo returns null, which the
// route forwards as-is in `{ feedback: null }`.
function fakeFeedback(feedback: "up" | "down" | null): MessageFeedback | null {
  return feedback;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue({
    email: "owner@noon.dev",
    name: "Owner",
    image: null,
  });
  vi.mocked(repos.getStudioMessage).mockResolvedValue(fakeMessage());
  vi.mocked(repos.getStudioSession).mockResolvedValue(fakeSession());
  vi.mocked(repos.setStudioMessageFeedback).mockResolvedValue(fakeFeedback("up"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Auth + schema
// ---------------------------------------------------------------------------

describe("POST /api/maxwell/message-feedback — auth + schema", () => {
  it("returns 401 when viewer is not authenticated", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(null);

    const res = await POST(postReq({ message_id: "msg-1", feedback: "up" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 with fieldErrors when message_id is missing", async () => {
    const res = await POST(postReq({ feedback: "up" }));
    expect(res.status).toBe(400);

    const body = (await res.json()) as { fieldErrors: Record<string, string[]> };
    expect(body.fieldErrors.message_id).toBeDefined();
  });

  it("returns 400 with fieldErrors when feedback is not 'up'/'down'/null", async () => {
    const res = await POST(postReq({ message_id: "msg-1", feedback: "maybe" }));
    expect(res.status).toBe(400);

    const body = (await res.json()) as { fieldErrors: Record<string, string[]> };
    expect(body.fieldErrors.feedback).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Resource gating
// ---------------------------------------------------------------------------

describe("POST /api/maxwell/message-feedback — resource gating", () => {
  it("returns 404 when message is not found", async () => {
    vi.mocked(repos.getStudioMessage).mockResolvedValue(null);

    const res = await POST(postReq({ message_id: "missing", feedback: "up" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when message role is not 'assistant'", async () => {
    vi.mocked(repos.getStudioMessage).mockResolvedValue(
      fakeMessage({ role: "user" }),
    );

    const res = await POST(postReq({ message_id: "msg-1", feedback: "up" }));
    expect(res.status).toBe(400);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Maxwell responses/);
  });

  it("returns 400 when messageType is not 'chat' (e.g. system_event)", async () => {
    vi.mocked(repos.getStudioMessage).mockResolvedValue(
      fakeMessage({ role: "assistant", messageType: "system_event" }),
    );

    const res = await POST(postReq({ message_id: "msg-1", feedback: "up" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when session attached to the message is missing", async () => {
    vi.mocked(repos.getStudioSession).mockResolvedValue(null);

    const res = await POST(postReq({ message_id: "msg-1", feedback: "up" }));
    expect(res.status).toBe(404);
  });

  it("returns 403 when viewer does not own the session", async () => {
    vi.mocked(ownership.viewerOwnsStudioSession).mockReturnValueOnce(false);

    const res = await POST(postReq({ message_id: "msg-1", feedback: "up" }));
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe("POST /api/maxwell/message-feedback — happy paths", () => {
  it("records 'up' and returns { feedback: 'up' }", async () => {
    vi.mocked(repos.setStudioMessageFeedback).mockResolvedValue("up");

    const res = await POST(postReq({ message_id: "msg-1", feedback: "up" }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { message_id: string; feedback: MessageFeedback | null };
    expect(body.message_id).toBe("msg-1");
    expect(body.feedback).toBe("up");

    expect(repos.setStudioMessageFeedback).toHaveBeenCalledWith({
      studioMessageId: "msg-1",
      studioSessionId: "session-1",
      viewerEmail: "owner@noon.dev",
      feedback: "up",
    });
  });

  it("records 'down' and returns { feedback: 'down' }", async () => {
    vi.mocked(repos.setStudioMessageFeedback).mockResolvedValue("down");

    const res = await POST(postReq({ message_id: "msg-1", feedback: "down" }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { feedback: MessageFeedback | null };
    expect(body.feedback).toBe("down");
  });

  it("clears feedback (feedback: null) and returns { feedback: null }", async () => {
    vi.mocked(repos.setStudioMessageFeedback).mockResolvedValue(null);

    const res = await POST(postReq({ message_id: "msg-1", feedback: null }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { feedback: MessageFeedback | null };
    expect(body.feedback).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Storage failure
// ---------------------------------------------------------------------------

describe("POST /api/maxwell/message-feedback — storage failure", () => {
  it("returns 500 with a generic message when setStudioMessageFeedback throws", async () => {
    vi.mocked(repos.setStudioMessageFeedback).mockRejectedValue(new Error("DB down"));

    const res = await POST(postReq({ message_id: "msg-1", feedback: "up" }));
    expect(res.status).toBe(500);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/could not update/i);
    expect(body.message).not.toContain("DB"); // internal error not leaked
  });
});
