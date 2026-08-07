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
import { cardCaptureId, ensureCardCapture } from "./reference-study/card-capture";
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
 * Build the card for a session. `captureBase` is the public route prefix
 * that serves cached captures (e.g. "/api/maxwell/studio/reference-capture").
 */
export async function buildDirectionCard(params: {
  stylePack: StylePack;
  language: string;
  captureBase: string;
}): Promise<DirectionStudyResult | null> {
  const { stylePack, language, captureBase } = params;

  const candidates = stylePack.refs.slice(0, 3).map((ref) => ({
    url: toAbsoluteUrl(ref.url),
    why: ref.v0Hint ?? undefined,
  }));

  // Captures in parallel — each failure just drops that reference.
  const captured = await Promise.all(
    candidates.map(async (candidate) => ({
      ...candidate,
      captureId: await ensureCardCapture(candidate.url),
    })),
  );
  const usable = captured.filter(
    (c): c is typeof c & { captureId: string } => c.captureId !== null,
  );

  if (usable.length === 0) {
    log.warn("maxwell.direction-study", "no capturable references — degrading to direct path", {
      style_pack_id: stylePack.id,
    });
    return null;
  }

  const shown = usable.slice(0, 3);
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
        imageUrl: `${captureBase}/${ref.captureId ?? cardCaptureId(ref.url)}`,
        primary: index === 0,
        refUrl: ref.url,
      })),
      labels: directionCardLabels(language),
    },
    primaryUrl,
  };
}
