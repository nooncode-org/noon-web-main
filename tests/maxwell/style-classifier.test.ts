/**
 * tests/maxwell/style-classifier.test.ts
 *
 * Bloque 11 — classifier behaviour around the 3-tier fallback chain:
 *
 *   1. LLM succeeds with a recognised id → return that pack.
 *   2. LLM returns unknown id / throws → fall back by projectType.
 *   3. No projectType match + no LLM → final fallback to clean-professional.
 *
 * We mock `lib/api-ia` so vitest never touches OpenAI. Each test asserts the
 * pack id the classifier picked, the fallback path it took, and (in error
 * tests) that errors are absorbed rather than thrown.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyStylePack } from "@/lib/maxwell/style-classifier";
import type { StudioSession } from "@/lib/maxwell/repositories";

vi.mock("@/lib/api-ia", () => ({
  chatWithOpenAI: vi.fn(),
}));

import { chatWithOpenAI } from "@/lib/api-ia";

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

function fakeSession(overrides: Partial<StudioSession> = {}): StudioSession {
  return {
    id: "session-1",
    initialPrompt: "test",
    status: "clarifying",
    ownerEmail: "x@y.com",
    ownerName: null,
    ownerImage: null,
    projectType: null,
    goalSummary: null,
    complexityHint: null,
    language: "en",
    correctionsUsed: 0,
    maxCorrections: 3,
    proposalRequestedAt: null,
    createdAt: "2026-05-17T00:00:00Z",
    updatedAt: "2026-05-17T00:00:00Z",
    stylePackId: null,
    ...overrides,
  };
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
  vi.clearAllMocks();
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = ORIGINAL_KEY;
  }
});

describe("classifyStylePack — tier 1 (LLM success)", () => {
  it("returns the pack matching the LLM's id reply", async () => {
    vi.mocked(chatWithOpenAI).mockResolvedValueOnce({ reply: "tech-digital" });

    const pack = await classifyStylePack(fakeSession(), "I want a Linear clone");
    expect(pack.id).toBe("tech-digital");
  });

  it("accepts a reply with surrounding whitespace and quotes", async () => {
    vi.mocked(chatWithOpenAI).mockResolvedValueOnce({ reply: '  "warm-artisanal"  \n' });

    const pack = await classifyStylePack(fakeSession(), "Bakery landing");
    expect(pack.id).toBe("warm-artisanal");
  });

  it("is case-insensitive on the LLM reply", async () => {
    vi.mocked(chatWithOpenAI).mockResolvedValueOnce({ reply: "TECH-DIGITAL" });

    const pack = await classifyStylePack(fakeSession(), "dev tool");
    expect(pack.id).toBe("tech-digital");
  });
});

describe("classifyStylePack — tier 2 (projectType fallback)", () => {
  it("falls back by projectType when LLM returns an unknown id", async () => {
    vi.mocked(chatWithOpenAI).mockResolvedValueOnce({ reply: "totally-made-up-pack" });

    const pack = await classifyStylePack(
      fakeSession({ projectType: "ecommerce" }),
      "",
    );
    expect(pack.id).toBe("commerce-retail");
  });

  it("falls back by projectType when LLM throws", async () => {
    vi.mocked(chatWithOpenAI).mockRejectedValueOnce(new Error("network down"));

    const pack = await classifyStylePack(
      fakeSession({ projectType: "webapp" }),
      "",
    );
    expect(pack.id).toBe("tech-digital");
  });

  it("maps landing → clean-professional (per fallback table)", async () => {
    vi.mocked(chatWithOpenAI).mockRejectedValueOnce(new Error("down"));

    const pack = await classifyStylePack(
      fakeSession({ projectType: "landing" }),
      "",
    );
    expect(pack.id).toBe("clean-professional");
  });

  it("maps mobile → tech-digital", async () => {
    vi.mocked(chatWithOpenAI).mockRejectedValueOnce(new Error("down"));

    const pack = await classifyStylePack(
      fakeSession({ projectType: "mobile" }),
      "",
    );
    expect(pack.id).toBe("tech-digital");
  });
});

describe("classifyStylePack — tier 3 (final default)", () => {
  it("returns clean-professional when no projectType and LLM unavailable", async () => {
    delete process.env.OPENAI_API_KEY;

    const pack = await classifyStylePack(
      fakeSession({ projectType: null }),
      "vague hint",
    );
    expect(pack.id).toBe("clean-professional");
  });

  it("returns clean-professional when projectType is unknown to fallback table", async () => {
    vi.mocked(chatWithOpenAI).mockRejectedValueOnce(new Error("down"));

    const pack = await classifyStylePack(
      fakeSession({ projectType: "exotic-unknown-type" }),
      "",
    );
    expect(pack.id).toBe("clean-professional");
  });
});

describe("classifyStylePack — error handling", () => {
  it("never throws even when LLM throws AND no fallback matches", async () => {
    vi.mocked(chatWithOpenAI).mockRejectedValueOnce(new Error("network"));

    await expect(
      classifyStylePack(fakeSession({ projectType: null }), ""),
    ).resolves.toBeDefined();
  });

  it("skips the LLM call entirely when OPENAI_API_KEY is absent", async () => {
    delete process.env.OPENAI_API_KEY;

    await classifyStylePack(fakeSession({ projectType: "ecommerce" }), "");
    expect(chatWithOpenAI).not.toHaveBeenCalled();
  });
});
