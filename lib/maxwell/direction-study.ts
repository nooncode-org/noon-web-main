/**
 * lib/maxwell/direction-study.ts
 *
 * Fase A · E2.2 — builds the REAL confirmation card (spec §4) when the
 * client requests a prototype and the brain flag is on:
 *
 *   1. Selects up to 3 pool references from the classified family
 *      (client-provided references are E2.4; here: "sin referencia del
 *      cliente → pool de su familia", primary first).
 *   2. Ensures a QUALITY capture per reference — the ugly/missing capture
 *      is never shown, the reference rotates out (spec: "la captura fea
 *      no se enseña — rota").
 *   3. Warms the primary's ficha (studyReference) so the post-tap
 *      generation starts hot; secondaries study on demand if chosen.
 *
 * Returns null when fewer than ONE reference could be captured — the
 * caller degrades to today's direct generation (Regla 0: the client
 * never sees a broken card, they just get their prototype).
 */

import type { ReferenceDirectionData } from "@/components/maxwell/reference-direction-card";
import { log } from "@/lib/server/logger";
import { ensureCardCapture } from "./reference-study/card-capture";
import { studyReference } from "./reference-study/study";
import type { StylePack } from "./style-packs";

export type DirectionStudyResult = {
  /** Ready-to-render card payload (labels in the session's language). */
  card: ReferenceDirectionData;
  /** The system-recommended primary reference URL. */
  primaryUrl: string;
};

/** Card labels travel with the SESSION's language (the client's, not ours). */
export function directionCardLabels(language: string): ReferenceDirectionData["labels"] {
  if (language === "es") {
    return {
      continue: "Continuar con esta dirección",
      preferAnother: "Prefiero otra",
      useMine: "Usar mi referencia",
      primaryChip: "Primaria",
    };
  }
  return {
    continue: "Continue with this direction",
    preferAnother: "Show me another",
    useMine: "Use my reference",
    primaryChip: "Primary",
  };
}

export function directionCardTitle(language: string): string {
  return language === "es"
    ? "Dirección visual de tu prototipo"
    : "Visual direction for your prototype";
}

/** "https://www.poilane.com" → "poilane.com" — honest, compact tile name. */
function displayName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function toAbsoluteUrl(ref: string): string {
  return /^https?:\/\//.test(ref) ? ref : `https://${ref}`;
}

/**
 * Tiles per card. TWO on purpose: the card's grid is two columns (a third
 * tile orphans a row), the spec caps the direction at "1 primaria + 1-2
 * secundarias", and holding a reference back is what gives "Prefiero otra"
 * something to rotate to — each family ships exactly 3 references.
 */
const TILES_PER_CARD = 2;

/**
 * Build the card for a session. `captureBase` is the public route prefix
 * that serves cached captures (e.g. "/api/maxwell/studio/reference-capture").
 *
 * `exclude` powers "Prefiero otra": references already shown drop out. When
 * the family runs out the selection CYCLES back to the full set instead of
 * dead-ending — the client always gets a card, never an apology.
 */
export async function buildDirectionCard(params: {
  stylePack: StylePack;
  language: string;
  captureBase: string;
  exclude?: string[];
}): Promise<DirectionStudyResult | null> {
  const { stylePack, language, captureBase, exclude } = params;

  const all = stylePack.refs.map((ref) => ({
    url: toAbsoluteUrl(ref.url),
    why: ref.v0Hint ?? undefined,
  }));
  const excluded = new Set((exclude ?? []).map((url) => url.trim().toLowerCase()));
  const fresh = all.filter((candidate) => !excluded.has(candidate.url.toLowerCase()));
  const candidates = fresh.length > 0 ? fresh : all;

  // Capture in order, stopping as soon as the card is full: an ugly or
  // uncapturable reference simply never appears — it rotates out (spec §4),
  // and we never pay for captures the card won't show.
  const shown: { url: string; why?: string; captureId: string }[] = [];
  const queue = [...candidates];
  while (shown.length < TILES_PER_CARD && queue.length > 0) {
    const batch = queue.splice(0, TILES_PER_CARD - shown.length);
    const captured = await Promise.all(
      batch.map(async (candidate) => ({
        ...candidate,
        captureId: await ensureCardCapture(candidate.url),
      })),
    );
    for (const candidate of captured) {
      if (candidate.captureId) shown.push({ ...candidate, captureId: candidate.captureId });
    }
  }

  if (shown.length === 0) {
    log.warn("maxwell.direction-study", "no capturable references — degrading to direct path", {
      style_pack_id: stylePack.id,
    });
    return null;
  }

  const primaryUrl = shown[0].url;

  // Warm the primary's ficha in the background of THIS request (await: the
  // stages UI covers the wait; cache makes repeats instant). Failure is
  // fine — generation degrades to family tokens later.
  await studyReference(primaryUrl);

  return {
    card: {
      title: directionCardTitle(language),
      references: shown.map((ref, index) => ({
        name: displayName(ref.url),
        why: ref.why,
        imageUrl: `${captureBase}/${ref.captureId}`,
        primary: index === 0,
        refUrl: ref.url,
      })),
      labels: directionCardLabels(language),
    },
    primaryUrl,
  };
}
