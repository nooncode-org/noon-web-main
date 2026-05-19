/**
 * tests/maxwell/brief-extractor.test.ts
 *
 * Bloque 11 — extractAndSaveBrief is fire-and-forget. The contract:
 *
 *   - On success: a single upsertStudioBrief call with parsed fields.
 *   - On JSON parse failure: error logged, no upsert, no throw.
 *   - On OpenAI throw: error logged, no upsert, no throw.
 *   - When OPENAI_API_KEY is absent: silent skip (no LLM call, no log spam).
 *   - Markdown-fenced JSON replies are tolerated (gpt-4.1 sometimes adds ``` ).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractAndSaveBrief } from "@/lib/maxwell/brief-extractor";

vi.mock("@/lib/api-ia", () => ({
  chatWithOpenAI: vi.fn(),
}));

vi.mock("@/lib/maxwell/repositories", () => ({
  upsertStudioBrief: vi.fn(),
}));

import { chatWithOpenAI } from "@/lib/api-ia";
import { upsertStudioBrief } from "@/lib/maxwell/repositories";

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

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

describe("extractAndSaveBrief — happy path", () => {
  it("parses a clean JSON reply and upserts the brief", async () => {
    vi.mocked(chatWithOpenAI).mockResolvedValueOnce({
      reply: JSON.stringify({
        objective: "Reduce drop-off in KYC",
        users: "Crypto retail",
        primaryUser: "First-time investor",
        coreFlow: "Email → KYC → fund → trade",
        platform: "web",
        integrations: null,
        styleDirection: "Calm dark mode",
        constraints: null,
      }),
    });

    await extractAndSaveBrief("session-1", [
      { role: "user", content: "We want a crypto wallet" },
      { role: "assistant", content: "What platform?" },
    ]);

    expect(upsertStudioBrief).toHaveBeenCalledTimes(1);
    expect(upsertStudioBrief).toHaveBeenCalledWith(
      expect.objectContaining({
        studioSessionId: "session-1",
        objective: "Reduce drop-off in KYC",
        primaryUser: "First-time investor",
        platform: "web",
        styleDirection: "Calm dark mode",
      }),
    );
  });

  it("converts null JSON fields to undefined when passing to upsert", async () => {
    // Why: upsertStudioBrief uses COALESCE(${input.field ?? null}, field) which
    // would overwrite existing data with NULL if we passed null instead of
    // undefined. The extractor's null→undefined conversion preserves prior
    // data when this run can't extract a particular field.
    vi.mocked(chatWithOpenAI).mockResolvedValueOnce({
      reply: JSON.stringify({
        objective: "Goal",
        users: null,
        primaryUser: null,
        coreFlow: null,
        platform: null,
        integrations: null,
        styleDirection: null,
        constraints: null,
      }),
    });

    await extractAndSaveBrief("session-1", [{ role: "user", content: "hi" }]);

    const call = vi.mocked(upsertStudioBrief).mock.calls[0][0];
    expect(call.objective).toBe("Goal");
    expect(call.users).toBeUndefined();
    expect(call.primaryUser).toBeUndefined();
  });

  it("strips markdown ```json fences from the reply (gpt-4.1 quirk)", async () => {
    vi.mocked(chatWithOpenAI).mockResolvedValueOnce({
      reply: '```json\n{"objective":"x","users":null,"primaryUser":null,"coreFlow":null,"platform":null,"integrations":null,"styleDirection":null,"constraints":null}\n```',
    });

    await extractAndSaveBrief("session-1", [{ role: "user", content: "hi" }]);

    expect(upsertStudioBrief).toHaveBeenCalledWith(
      expect.objectContaining({ objective: "x" }),
    );
  });
});

describe("extractAndSaveBrief — error absorption (fire-and-forget contract)", () => {
  it("does NOT throw when the LLM call rejects", async () => {
    vi.mocked(chatWithOpenAI).mockRejectedValueOnce(new Error("OpenAI 503"));

    await expect(
      extractAndSaveBrief("session-1", [{ role: "user", content: "hi" }]),
    ).resolves.toBeUndefined();
    expect(upsertStudioBrief).not.toHaveBeenCalled();
  });

  it("does NOT throw when the reply is malformed JSON", async () => {
    vi.mocked(chatWithOpenAI).mockResolvedValueOnce({
      reply: "this is not json at all",
    });

    await expect(
      extractAndSaveBrief("session-1", [{ role: "user", content: "hi" }]),
    ).resolves.toBeUndefined();
    expect(upsertStudioBrief).not.toHaveBeenCalled();
  });

  it("does NOT throw when upsertStudioBrief rejects", async () => {
    vi.mocked(chatWithOpenAI).mockResolvedValueOnce({
      reply: JSON.stringify({
        objective: "x", users: null, primaryUser: null, coreFlow: null,
        platform: null, integrations: null, styleDirection: null, constraints: null,
      }),
    });
    vi.mocked(upsertStudioBrief).mockRejectedValueOnce(new Error("DB down"));

    await expect(
      extractAndSaveBrief("session-1", [{ role: "user", content: "hi" }]),
    ).resolves.toBeUndefined();
  });
});

describe("extractAndSaveBrief — env guard", () => {
  it("silently skips when OPENAI_API_KEY is absent (no LLM call, no log spam)", async () => {
    delete process.env.OPENAI_API_KEY;

    await extractAndSaveBrief("session-1", [{ role: "user", content: "hi" }]);

    expect(chatWithOpenAI).not.toHaveBeenCalled();
    expect(upsertStudioBrief).not.toHaveBeenCalled();
  });
});
