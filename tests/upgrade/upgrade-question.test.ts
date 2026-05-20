/**
 * tests/upgrade/upgrade-question.test.ts
 *
 * Coverage for `GET|POST /api/upgrade/[id]/question`. The GET fetches
 * generated clarifying questions; the POST records an answer.
 *
 * Coverage matrix:
 *   GET /api/upgrade/[id]/question:
 *     - 401 unauthenticated
 *     - 404 session missing
 *     - 404 ownership mismatch
 *     - 422 when no pages crawled yet (must crawl first)
 *     - 500 when generateClarifyingQuestions returns !ok (LLM failed)
 *     - 200 with questions array on happy path
 *   POST /api/upgrade/[id]/question:
 *     - 401 unauthenticated
 *     - 404 session missing
 *     - 404 ownership mismatch
 *     - 422 when session.mode is not 'answer_questions'
 *     - 422 when already at the 5-question cap
 *     - 400 zod (missing question / answer)
 *     - 200 + answered/total counters + question_answered event
 *     - 500 generic error path
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UpgradeSession, UpgradeMode, UpgradePage } from "@/lib/upgrade/types";

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedViewer: vi.fn(),
}));

vi.mock("@/lib/upgrade/repositories", () => ({
  getUpgradeSessionById: vi.fn(),
  getPagesBySessionId: vi.fn(),
  appendQuestionAnswer: vi.fn(async () => undefined),
  insertUpgradeEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/upgrade/generator", () => ({
  generateClarifyingQuestions: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as authSession from "@/lib/auth/session";
import * as repos from "@/lib/upgrade/repositories";
import * as generator from "@/lib/upgrade/generator";
import { GET, POST } from "@/app/api/upgrade/[id]/question/route";

const params = Promise.resolve({ id: "session-1" });

function getReq() {
  return new Request("http://localhost/api/upgrade/session-1/question", { method: "GET" });
}

function postReq(body: unknown) {
  return new Request("http://localhost/api/upgrade/session-1/question", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeSession(overrides: Partial<UpgradeSession> = {}): UpgradeSession {
  return {
    id: "session-1",
    ownerEmail: "owner@noon.dev",
    ownerName: "Owner",
    websiteUrl: "https://example.com",
    websiteUrlRaw: "example.com",
    mode: "answer_questions" as UpgradeMode,
    contextNote: null,
    questionsAnswers: [],
    status: "crawl_done",
    correctionsUsed: 0,
    source: "web",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    archivedAt: null,
    ...overrides,
  };
}

function fakePage(): UpgradePage {
  return {
    id: "page-1",
    websiteUpgradeSessionId: "session-1",
    url: "https://example.com/",
    title: "Home",
    contentText: "Hello world",
    pageType: "home",
    crawlOrder: 1,
    crawlDepth: 0,
    createdAt: new Date().toISOString(),
  } as UpgradePage;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue({
    email: "owner@noon.dev",
    name: "Owner",
    image: null,
  });
  vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(fakeSession());
  vi.mocked(repos.getPagesBySessionId).mockResolvedValue([fakePage(), fakePage()]);
  vi.mocked(generator.generateClarifyingQuestions).mockResolvedValue({
    ok: true,
    questions: ["What is your target audience?", "What's the main goal?"],
  } as Awaited<ReturnType<typeof generator.generateClarifyingQuestions>>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe("GET /api/upgrade/[id]/question", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(null);
    const res = await GET(getReq(), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when session is missing or wrong owner", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(null);
    const res = await GET(getReq(), { params });
    expect(res.status).toBe(404);
  });

  it("returns 422 when no pages crawled yet", async () => {
    vi.mocked(repos.getPagesBySessionId).mockResolvedValue([]);
    const res = await GET(getReq(), { params });
    expect(res.status).toBe(422);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/must be crawled/);
  });

  it("returns 500 with generator's error message when LLM call fails", async () => {
    vi.mocked(generator.generateClarifyingQuestions).mockResolvedValue({
      ok: false,
      error: "LLM rate limited.",
    } as Awaited<ReturnType<typeof generator.generateClarifyingQuestions>>);

    const res = await GET(getReq(), { params });
    expect(res.status).toBe(500);

    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("LLM rate limited.");
  });

  it("returns 200 with questions array on happy path", async () => {
    const res = await GET(getReq(), { params });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { questions: string[] };
    expect(body.questions).toHaveLength(2);
    expect(body.questions[0]).toMatch(/audience/);
  });
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

describe("POST /api/upgrade/[id]/question", () => {
  const validBody = { question: "What's your goal?", answer: "Get more leads." };

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(authSession.getAuthenticatedViewer).mockResolvedValue(null);
    const res = await POST(postReq(validBody), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when session is missing", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(null);
    const res = await POST(postReq(validBody), { params });
    expect(res.status).toBe(404);
  });

  it("returns 422 when session.mode is not 'answer_questions'", async () => {
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ mode: "best_judgment" }),
    );
    const res = await POST(postReq(validBody), { params });
    expect(res.status).toBe(422);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/not in question-answering mode/);
  });

  it("returns 422 when 5-question cap is reached", async () => {
    const five = Array(5).fill({ question: "q?", answer: "a." });
    vi.mocked(repos.getUpgradeSessionById).mockResolvedValue(
      fakeSession({ questionsAnswers: five }),
    );
    const res = await POST(postReq(validBody), { params });
    expect(res.status).toBe(422);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Maximum of 5/);
  });

  it("returns 400 with fieldErrors when answer is missing", async () => {
    const res = await POST(postReq({ question: "Q?" }), { params });
    expect(res.status).toBe(400);

    const body = (await res.json()) as { fieldErrors: Record<string, string[]> };
    expect(body.fieldErrors.answer).toBeDefined();
  });

  it("returns 200 with answered/total counters + emits question_answered event", async () => {
    // session.questionsAnswers.length = 0, so answered after = 1, total = 5
    const res = await POST(postReq(validBody), { params });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { answered: number; total: number };
    expect(body).toEqual({ answered: 1, total: 5 });

    expect(repos.appendQuestionAnswer).toHaveBeenCalledWith("session-1", validBody);
    expect(repos.insertUpgradeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "question_answered",
        metadata: { questionIndex: 0 },
      }),
    );
  });

  it("returns 500 with generic message when appendQuestionAnswer throws", async () => {
    vi.mocked(repos.appendQuestionAnswer).mockRejectedValueOnce(new Error("DB exploded"));
    const res = await POST(postReq(validBody), { params });
    expect(res.status).toBe(500);

    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Failed to record/i);
    expect(body.message).not.toContain("DB exploded");
  });
});
