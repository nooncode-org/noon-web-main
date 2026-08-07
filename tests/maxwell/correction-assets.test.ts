/**
 * tests/maxwell/correction-assets.test.ts
 *
 * Fase A · E3.5 — the correction mini-pipeline. Its whole job is that a
 * change asking for new CONTENT ("añade testimonios") arrives with real
 * photography instead of leaving v0 to invent people. So:
 *
 *   - asks that need imagery produce slots, in both launch languages;
 *   - ordinary changes ("make the hero bigger") produce none — a
 *     correction must not go shopping for photos it does not need;
 *   - the slots inherit the family's world, so the new section belongs to
 *     the same prototype;
 *   - the imagery block forbids invented URLs and placeholder people, and
 *     stays silent when nothing was found.
 */

import { describe, expect, it } from "vitest";

import {
  correctionImageryBlock,
  correctionShotList,
} from "@/lib/maxwell/correction-assets";
import type { StylePack } from "@/lib/maxwell/style-packs";

const pack: StylePack = {
  id: "warm-artisanal",
  name: "Warm Artisanal",
  feel: "Bakery, workshop, maker.",
  refs: [{ url: "a.com" }, { url: "b.com" }, { url: "c.com" }],
  token: {
    palette: { bg: "#FFFFFF", ink: "#111111", accent: "#8a6f4d" },
    fonts: { display: "Inter", body: "Inter" },
    imagery: "artisan craft, warm materials",
  },
};

describe("correctionShotList", () => {
  it("turns an ask for testimonials into a portrait slot in the family's world", () => {
    const slots = correctionShotList("añade una sección de testimonios", pack);

    expect(slots).toHaveLength(1);
    expect(slots[0].role).toBe("portrait");
    expect(slots[0].geometry).toEqual({
      ratio: "1:1",
      minWidthPx: 400,
      focalPoint: "face centered",
    });
    // The new photos belong to the same prototype, not to stock-photo land.
    expect(slots[0].searchQuery).toContain("artisan craft");
    expect(slots[0].context).toContain("Bakery");
  });

  it("works in both launch languages", () => {
    expect(correctionShotList("add a team section", pack)).toHaveLength(1);
    expect(correctionShotList("añade la sección de equipo", pack)).toHaveLength(1);
    expect(correctionShotList("add a gallery of our work", pack)[0].role).toBe("section");
  });

  it("stays silent for changes that need no new imagery", () => {
    for (const prompt of [
      // Naming a section is not asking for a photograph of it.
      "make the hero bigger",
      "haz el hero más alto",
      "cambia el color del botón",
      "remove the second CTA",
    ]) {
      expect(correctionShotList(prompt, pack), prompt).toEqual([]);
    }
  });

  it("but DOES act when the change is about the picture itself", () => {
    expect(correctionShotList("change the hero image", pack)[0].role).toBe("hero");
    expect(correctionShotList("cambia la foto de portada", pack)[0].role).toBe("hero");
  });

  it("caps how many slots one correction can open", () => {
    const slots = correctionShotList(
      "añade testimonios, el equipo, una galería y una portada nueva",
      pack,
    );
    expect(slots.length).toBeLessThanOrEqual(2);
  });
});

describe("correctionImageryBlock", () => {
  const slot = correctionShotList("add testimonials", pack)[0];

  it("lists what was found and closes the door on invention", () => {
    const block = correctionImageryBlock([
      {
        slot,
        image: {
          url: "https://cdn.example/p.jpg",
          urlLarge: "https://cdn.example/p@2x.jpg",
          alt: "a customer",
        },
      },
    ]);

    expect(block).toContain("https://cdn.example/p.jpg");
    expect(block).toContain("alt: a customer");
    expect(block).toContain("never invent URLs or placeholder people");
    expect(block).toContain("Sibling images render at identical sizes");
  });

  it("says nothing when nothing was found — an empty slot is not a broken one", () => {
    expect(correctionImageryBlock([{ slot, image: null }])).toBe("");
    expect(correctionImageryBlock([])).toBe("");
  });
});
