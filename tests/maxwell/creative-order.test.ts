/**
 * tests/maxwell/creative-order.test.ts
 *
 * La orden (Fase A §5) — the JSON contract without an API key:
 * geometry always comes from the role table (deterministic, never
 * model-invented), load-bearing fields are enforced (shot list +
 * headline), roles are sanitized, and the parser survives fences and
 * garbage. The sofa-rule attributes travel through verbatim.
 */

import { describe, expect, it } from "vitest";

import { parseCreativeOrderReply } from "@/lib/maxwell/creative-order";

const VALID_REPLY = JSON.stringify({
  shotList: [
    {
      slotId: "hero",
      role: "hero",
      subject: "artisan sourdough loaves on a wooden counter",
      composition: "loaves front and center, baker blurred behind",
      context: "warm bakery interior, morning",
      light: "soft window light",
      perspective: "eye level",
      feeling: "warmth",
      searchQuery: "artisan sourdough bread wooden counter bakery",
    },
    {
      slotId: "section-1",
      role: "flying-car", // invalid role → sanitized to "section"
      subject: "baker shaping dough",
      searchQuery: "baker hands shaping dough",
    },
  ],
  copy: {
    headline: "Pan de masa madre, horneado cada mañana",
    subheadline: "Recogida en tienda o entrega por WhatsApp",
    primaryCta: "Pedir por WhatsApp",
    sections: [
      { name: "Nuestro pan", purpose: "show the daily range", body: "Cinco panes, una masa madre de 12 años." },
      { name: "", purpose: "dropped — no name", body: "x" },
    ],
  },
  data: [
    { label: "Hogaza clásica", value: "$4.50" },
    { label: "", value: "dropped" },
  ],
});

describe("parseCreativeOrderReply", () => {
  it("parses a valid order: geometry from role table, roles sanitized, empties dropped", () => {
    const order = parseCreativeOrderReply(VALID_REPLY, "es");
    expect(order).not.toBeNull();

    expect(order!.shotList).toHaveLength(2);
    expect(order!.shotList[0].geometry).toEqual({
      ratio: "16:9",
      minWidthPx: 1600,
      focalPoint: "center",
    });
    // Invalid role sanitized to "section" and given section geometry.
    expect(order!.shotList[1].role).toBe("section");
    expect(order!.shotList[1].geometry.ratio).toBe("4:3");
    // Sofa-rule attributes travel verbatim.
    expect(order!.shotList[0].context).toContain("warm bakery interior");

    expect(order!.copy.headline).toContain("masa madre");
    expect(order!.copy.sections).toHaveLength(1);
    expect(order!.data).toEqual([{ label: "Hogaza clásica", value: "$4.50" }]);
    expect(order!.language).toBe("es");
  });

  it("tolerates markdown fences", () => {
    expect(parseCreativeOrderReply("```json\n" + VALID_REPLY + "\n```", "es")).not.toBeNull();
  });

  it("rejects an order without shots or without a headline", () => {
    const noShots = JSON.stringify({ shotList: [], copy: { headline: "x" } });
    const noHeadline = JSON.stringify({
      shotList: [{ slotId: "hero", role: "hero", subject: "s", searchQuery: "q" }],
      copy: { headline: "" },
    });
    expect(parseCreativeOrderReply(noShots, "es")).toBeNull();
    expect(parseCreativeOrderReply(noHeadline, "es")).toBeNull();
  });

  it("drops shots missing subject or searchQuery (unsearchable = unusable)", () => {
    const reply = JSON.stringify({
      shotList: [
        { slotId: "hero", role: "hero", subject: "bread", searchQuery: "bread" },
        { slotId: "section-1", role: "section", subject: "", searchQuery: "q" },
        { slotId: "section-2", role: "section", subject: "s", searchQuery: "" },
      ],
      copy: { headline: "Hola" },
    });
    const order = parseCreativeOrderReply(reply, "en");
    expect(order!.shotList).toHaveLength(1);
  });

  it("rejects non-JSON garbage", () => {
    expect(parseCreativeOrderReply("Sorry, I cannot help with that.", "es")).toBeNull();
  });
});
