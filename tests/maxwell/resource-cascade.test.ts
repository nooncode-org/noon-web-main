/**
 * tests/maxwell/resource-cascade.test.ts
 *
 * Fase A · E3.4 — levels 2 and 3, and the judgement calls in them:
 *
 *   - a slot the earlier levels FILLED is never touched again;
 *   - illustrated avatars appear only where the family's tone asks for
 *     them — in a premium family a cartoon face is worse than no image;
 *   - heroes and section photography are never faked with a generated
 *     shape: those carry the promise;
 *   - generation is off by default, capped when on, and inherits the
 *     slot's six attributes as its order;
 *   - a slot that cannot be filled honestly stays empty on purpose.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-ia", () => ({ generateSlotImage: vi.fn() }));
import { generateSlotImage } from "@/lib/api-ia";

import {
  applyResourceCascade,
  isImageGenerationEnabled,
  slotImagePrompt,
} from "@/lib/maxwell/resource-cascade";
import type { VerifiedSlot } from "@/lib/maxwell/image-verify";
import type { StylePack } from "@/lib/maxwell/style-packs";

function pack(id: string): StylePack {
  return {
    id,
    name: id,
    feel: "feel",
    refs: [{ url: "a.com" }, { url: "b.com" }, { url: "c.com" }],
    token: {
      palette: { bg: "#FFFFFF", ink: "#111111", accent: "#0056FD" },
      fonts: { display: "Inter", body: "Inter" },
      imagery: "imagery",
    },
  };
}

function emptySlot(role: VerifiedSlot["slot"]["role"], slotId: string = role): VerifiedSlot {
  return {
    slot: {
      slotId,
      role,
      subject: "a baker shaping dough",
      composition: "hands in frame",
      context: "warm bakery interior",
      light: "soft window light",
      perspective: "eye level",
      feeling: "warmth",
      searchQuery: "baker shaping dough",
      geometry: { ratio: "4:3", minWidthPx: 900, focalPoint: "center" },
    },
    image: null,
    verdict: "empty",
  };
}

const SESSION = "session-1";

describe("slotImagePrompt", () => {
  it("carries the six attributes and forbids text or logos", () => {
    const prompt = slotImagePrompt(emptySlot("section").slot);
    expect(prompt).toContain("a baker shaping dough");
    expect(prompt).toContain("Setting: warm bakery interior.");
    expect(prompt).toContain("Light: soft window light.");
    expect(prompt).toContain("Feeling: warmth.");
    expect(prompt).toContain("no text, no logos");
  });
});

describe("resource cascade — levels 2 and 3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MAXWELL_IMAGE_GENERATION", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("leaves a slot that already has a photo untouched", async () => {
    const filled: VerifiedSlot = {
      ...emptySlot("hero"),
      image: { url: "u", urlLarge: "u", alt: "a", avgColor: null },
      verdict: "verified",
    };

    const out = await applyResourceCascade({
      slots: [filled],
      stylePack: pack("warm-artisanal"),
      sessionId: SESSION,
    });

    expect(out[0].verdict).toBe("verified");
    expect(generateSlotImage).not.toHaveBeenCalled();
  });

  it("gives playful families illustrated avatars, and premium ones nothing", async () => {
    const playful = await applyResourceCascade({
      slots: [emptySlot("portrait")],
      stylePack: pack("pets-veterinary"),
      sessionId: SESSION,
    });
    expect(playful[0].verdict).toBe("deterministic");
    expect(playful[0].image?.url).toContain("dicebear");

    const premium = await applyResourceCascade({
      slots: [emptySlot("portrait")],
      stylePack: pack("finance-fintech"),
      sessionId: SESSION,
    });
    expect(premium[0].verdict).toBe("empty");
    expect(premium[0].image).toBeNull();
  });

  it("composes a background from the family's own palette", async () => {
    const out = await applyResourceCascade({
      slots: [emptySlot("background")],
      stylePack: pack("finance-fintech"),
      sessionId: SESSION,
    });

    expect(out[0].verdict).toBe("deterministic");
    const svg = Buffer.from(out[0].image!.url.split(",")[1], "base64").toString();
    expect(svg).toContain("#0056FD"); // the family's accent, not a stock tone
    expect(out[0].image!.url.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("never fakes a hero or a section photograph", async () => {
    const out = await applyResourceCascade({
      slots: [emptySlot("hero"), emptySlot("section")],
      stylePack: pack("warm-artisanal"),
      sessionId: SESSION,
    });

    expect(out.every((slot) => slot.verdict === "empty")).toBe(true);
    expect(generateSlotImage).not.toHaveBeenCalled(); // generation is off
  });

  it("generation is off by default and only runs when switched on", async () => {
    expect(isImageGenerationEnabled()).toBe(false);
    vi.stubEnv("MAXWELL_IMAGE_GENERATION", "1");
    expect(isImageGenerationEnabled()).toBe(true);

    vi.mocked(generateSlotImage).mockResolvedValue("data:image/png;base64,AAA");
    const out = await applyResourceCascade({
      slots: [emptySlot("hero")],
      stylePack: pack("warm-artisanal"),
      sessionId: SESSION,
    });

    expect(out[0].verdict).toBe("generated");
    expect(vi.mocked(generateSlotImage).mock.calls[0][0].ratio).toBe("4:3");
  });

  it("caps generation at two per prototype — the last resort is not the habit", async () => {
    vi.stubEnv("MAXWELL_IMAGE_GENERATION", "1");
    vi.mocked(generateSlotImage).mockResolvedValue("data:image/png;base64,AAA");

    const out = await applyResourceCascade({
      slots: [
        emptySlot("hero", "s1"),
        emptySlot("section", "s2"),
        emptySlot("section", "s3"),
      ],
      stylePack: pack("warm-artisanal"),
      sessionId: SESSION,
    });

    expect(out.filter((slot) => slot.verdict === "generated")).toHaveLength(2);
    expect(out.filter((slot) => slot.verdict === "empty")).toHaveLength(1);
    expect(generateSlotImage).toHaveBeenCalledTimes(2);
  });

  it("a failed generation leaves the slot empty, never broken", async () => {
    vi.stubEnv("MAXWELL_IMAGE_GENERATION", "1");
    vi.mocked(generateSlotImage).mockResolvedValue(null);

    const out = await applyResourceCascade({
      slots: [emptySlot("hero")],
      stylePack: pack("warm-artisanal"),
      sessionId: SESSION,
    });

    expect(out[0].verdict).toBe("empty");
    expect(out[0].image).toBeNull();
  });
});
