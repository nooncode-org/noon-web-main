/**
 * lib/maxwell/correction-assets.ts
 *
 * Fase A · E3.5 — the mini-pipeline for a CORRECTION that asks for new
 * content (spec §9): "si el cambio pide algo nuevo ('añade testimonios')
 * → mini-pipeline solo para los slots nuevos: shot list de esos slots +
 * búsqueda + verificación en lote".
 *
 * Why it exists: E3.1 made corrections carry the design's blueprints, so a
 * new section now LOOKS right. But a section that needs faces still had no
 * faces — and v0 fills that void with invented people. This closes it:
 * the same cascade and the same customs gate that served the first
 * version serve the third correction.
 *
 * Deliberately narrow. It only runs when the change plainly asks for
 * imagery, and it derives the slots from a fixed table rather than an LLM
 * call: one extra model call per correction to guess "does this need
 * photos?" would cost more than it saves, and the table is honest about
 * what it covers.
 */

import type { ShotSpec } from "./creative-order";
import type { StylePack } from "./style-packs";

/**
 * Content asks that genuinely need imagery, and the shot each one implies.
 * Matched on the client's own words, in the two launch languages.
 */
const IMAGERY_ASKS: {
  match: RegExp;
  role: ShotSpec["role"];
  subject: string;
  query: string;
}[] = [
  {
    match: /testimoni|reseñ|review|opinion/i,
    role: "portrait",
    subject: "a customer of this business, warm and candid",
    query: "candid customer portrait natural light",
  },
  {
    match: /equipo|team|nosotros|about us|staff/i,
    role: "portrait",
    subject: "a member of this team at work",
    query: "professional at work portrait natural light",
  },
  {
    match: /galer[ií]a|gallery|portfolio|trabajos|our work/i,
    role: "section",
    subject: "the work this business produces, shown in use",
    query: "product in use editorial photography",
  },
  {
    // The word alone is not enough: "make the hero bigger" is a layout
    // change, not a request for a photograph. An imagery word must be
    // right there — which covers both adding one and swapping one.
    // Either order: English puts the section first ("hero image"), Spanish
    // puts the picture first ("foto de portada").
    match:
      /(hero|portada|cabecera|banner)[\s\w]{0,12}(image|photo|picture|imagen|foto)|(image|photo|picture|imagen|foto)[\s\w]{0,12}(hero|portada|cabecera|banner)/i,
    role: "hero",
    subject: "the opening image of this business",
    query: "editorial hero photography",
  },
];

/**
 * Slots a correction needs, or an empty list when the change is not about
 * imagery (most of them — "make the hero bigger" needs nothing new).
 *
 * `stylePack` flavours the search so the new photos land in the same world
 * as the ones already on the page.
 */
export function correctionShotList(
  correctionPrompt: string,
  stylePack: StylePack,
  maxSlots = 2,
): ShotSpec[] {
  const aesthetic = stylePack.token.imagery.split(",")[0]?.trim() ?? "";

  return IMAGERY_ASKS.filter((ask) => ask.match.test(correctionPrompt))
    .slice(0, maxSlots)
    .map((ask, index) => ({
      slotId: `correction-${index + 1}`,
      role: ask.role,
      subject: ask.subject,
      composition: "subject centred, room to crop",
      context: `${stylePack.feel}`,
      light: "natural, soft",
      perspective: "eye level",
      feeling: aesthetic || "authentic",
      searchQuery: aesthetic ? `${ask.query}, ${aesthetic}` : ask.query,
      geometry:
        ask.role === "portrait"
          ? { ratio: "1:1", minWidthPx: 400, focalPoint: "face centered" }
          : ask.role === "hero"
            ? { ratio: "16:9", minWidthPx: 1600, focalPoint: "center" }
            : { ratio: "4:3", minWidthPx: 900, focalPoint: "center" },
    }));
}

/** Imagery block appended to a correction brief, in the same shape v0 already reads. */
export function correctionImageryBlock(
  slots: { slot: ShotSpec; image: { url: string; urlLarge: string; alt: string } | null }[],
): string {
  const filled = slots.filter((entry) => entry.image);
  if (filled.length === 0) return "";

  return [
    "",
    "[Imagery for the new content — use ONLY these, never invent URLs or placeholder people]:",
    ...filled.map((entry) => {
      const url = entry.slot.role === "hero" ? entry.image!.urlLarge : entry.image!.url;
      return `${entry.slot.slotId} [${entry.slot.role}, ${entry.slot.geometry.ratio}]: ${url}  — alt: ${entry.image!.alt}`;
    }),
    "Crop with object-cover on the focal point. Sibling images render at identical sizes.",
  ].join("\n");
}
