/**
 * tests/maxwell/image-verify.test.ts
 *
 * La aduana (Fase A §6) — batch mechanics without vision calls:
 * deterministic 1-based numbering with the 20-image cap, pick-mapping
 * back to candidates, "none pass" → null image (fuera aunque sea
 * bonita), and the Regla-0 degradations: verifier unusable or key
 * missing → first candidate per slot (today's behaviour), empty
 * candidates → "empty" without spending.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ShotSpec } from "@/lib/maxwell/creative-order";
import type { SlotCandidates } from "@/lib/maxwell/design-dossier";
import {
  buildBatchIndex,
  parseVerifyReply,
  verifyShotCandidates,
} from "@/lib/maxwell/image-verify";
import type { StockImage } from "@/lib/server/stock-images";

vi.mock("@/lib/api-ia", () => ({ chatWithOpenAI: vi.fn() }));
import { chatWithOpenAI } from "@/lib/api-ia";

function shot(slotId: string, role: ShotSpec["role"] = "section"): ShotSpec {
  return {
    slotId,
    role,
    subject: `subject ${slotId}`,
    composition: "c",
    context: "ctx",
    light: "soft",
    perspective: "eye level",
    feeling: "calm",
    searchQuery: `query ${slotId}`,
    geometry: { ratio: "4:3", minWidthPx: 900, focalPoint: "center" },
  };
}

function img(n: number): StockImage {
  return {
    url: `https://cdn.example/photo-${n}.jpg`,
    urlLarge: `https://cdn.example/photo-${n}@2x.jpg`,
    alt: `photo ${n}`,
    avgColor: null,
  };
}

function slots(): SlotCandidates[] {
  return [
    { slot: shot("hero", "hero"), candidates: [img(1), img(2)] },
    { slot: shot("section-1"), candidates: [img(3), img(4), img(5)] },
  ];
}

describe("buildBatchIndex", () => {
  it("numbers images 1-based across slots in order", () => {
    const { imageUrls, imageIndexBySlot } = buildBatchIndex(slots());
    expect(imageUrls).toHaveLength(5);
    expect(imageIndexBySlot.get("hero")).toEqual([1, 2]);
    expect(imageIndexBySlot.get("section-1")).toEqual([3, 4, 5]);
  });

  it("caps the batch at 20 images", () => {
    const many: SlotCandidates[] = Array.from({ length: 6 }, (_, i) => ({
      slot: shot(`s-${i}`),
      candidates: [img(i * 10), img(i * 10 + 1), img(i * 10 + 2), img(i * 10 + 3)],
    }));
    const { imageUrls, imageIndexBySlot } = buildBatchIndex(many);
    expect(imageUrls).toHaveLength(20);
    // The last slot got what fit and nothing more.
    expect(imageIndexBySlot.get("s-5")).toEqual([]);
  });
});

describe("parseVerifyReply", () => {
  it("maps picks back to candidates and honors null (none pass)", () => {
    const s = slots();
    const { imageIndexBySlot } = buildBatchIndex(s);
    const picks = parseVerifyReply(
      JSON.stringify({ slots: [{ slotId: "hero", best: 2 }, { slotId: "section-1", best: null }] }),
      s,
      imageIndexBySlot,
    );
    expect(picks!.get("hero")!.url).toBe("https://cdn.example/photo-2.jpg");
    expect(picks!.get("section-1")).toBeNull();
  });

  it("ignores unknown slots and out-of-range indexes", () => {
    const s = slots();
    const { imageIndexBySlot } = buildBatchIndex(s);
    const picks = parseVerifyReply(
      JSON.stringify({
        slots: [
          { slotId: "ghost", best: 1 },
          { slotId: "hero", best: 99 },
        ],
      }),
      s,
      imageIndexBySlot,
    );
    // hero addressed with a bogus index → null pick; ghost dropped.
    expect(picks!.size).toBe(1);
    expect(picks!.get("hero")).toBeNull();
  });

  it("returns null on garbage or empty coverage", () => {
    const s = slots();
    const { imageIndexBySlot } = buildBatchIndex(s);
    expect(parseVerifyReply("not json", s, imageIndexBySlot)).toBeNull();
    expect(parseVerifyReply(JSON.stringify({ slots: [] }), s, imageIndexBySlot)).toBeNull();
  });
});

describe("verifyShotCandidates", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.mocked(chatWithOpenAI).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("one call for the whole batch; verified picks and rejections mapped", async () => {
    vi.mocked(chatWithOpenAI).mockResolvedValueOnce({
      reply: JSON.stringify({
        slots: [
          { slotId: "hero", best: 2 },
          { slotId: "section-1", best: null },
        ],
      }),
    });

    const result = await verifyShotCandidates(slots());

    expect(vi.mocked(chatWithOpenAI)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(chatWithOpenAI).mock.calls[0][0];
    expect(call.imageUrls).toHaveLength(5);
    expect(call.category).toBe("image_verify");

    const hero = result.find((r) => r.slot.slotId === "hero")!;
    const section = result.find((r) => r.slot.slotId === "section-1")!;
    expect(hero.verdict).toBe("verified");
    expect(hero.image!.url).toBe("https://cdn.example/photo-2.jpg");
    // No coincide = fuera, aunque sea bonita.
    expect(section.verdict).toBe("empty");
    expect(section.image).toBeNull();
  });

  it("degrades to first candidates when the verifier reply is unusable", async () => {
    vi.mocked(chatWithOpenAI).mockResolvedValueOnce({ reply: "I refuse." });

    const result = await verifyShotCandidates(slots());

    for (const r of result) {
      expect(r.verdict).toBe("fallback");
      expect(r.image!.url).toBe(r.slot.slotId === "hero"
        ? "https://cdn.example/photo-1.jpg"
        : "https://cdn.example/photo-3.jpg");
    }
  });

  it("degrades without spending when the key is missing", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("OPENAI_API_KEY", "");

    const result = await verifyShotCandidates(slots());

    expect(vi.mocked(chatWithOpenAI)).not.toHaveBeenCalled();
    expect(result.every((r) => r.verdict === "fallback")).toBe(true);
  });

  it("empty-candidate slots come back 'empty' and cost nothing", async () => {
    const result = await verifyShotCandidates([{ slot: shot("dry"), candidates: [] }]);
    expect(vi.mocked(chatWithOpenAI)).not.toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({ verdict: "empty", image: null }),
    ]);
  });
});
