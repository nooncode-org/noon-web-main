/**
 * lib/maxwell/design-dossier.ts
 *
 * Fase A del Quality Layer v2 — the pre-generation resource gathering step.
 *
 * The owner's directive (2026-08-02): "antes de empezar a generar, se busquen
 * todos los recursos necesarios — así se le entrega a v0 algo realmente
 * completo, sin vacíos donde tenga que ser genérico". This module is that
 * step: it turns the classifier's domain queries + the style pack's aesthetic
 * into REAL, hotlinkable photography (hero, section support, people) so the
 * brief hands v0 concrete assets instead of hoping it invents good ones.
 *
 * Deterministic on purpose — no LLM call here. The classifier already
 * produced the domain queries; this is pure resource IO:
 *
 *   hero      → 2 landscape shots for the opening moment (domain query #1,
 *               flavored with the pack's aesthetic modifier)
 *   support   → 3 shots for section imagery (domain query #2 / #1)
 *   portraits → 4 people shots for testimonials / avatars / team rows
 *
 * Null-safe end to end: no PEXELS_API_KEY, network failure, or zero results
 * → `null` (or a partial dossier), and the brief simply omits the imagery
 * block. Generation NEVER blocks on imagery.
 */

import { searchStockImages, type StockImage } from "@/lib/server/stock-images";
import type { ShotSpec } from "./creative-order";
import type { StylePack } from "./style-packs";

export type DesignDossier = {
  hero: StockImage[];
  support: StockImage[];
  portraits: StockImage[];
};

/** One shot-list slot with its search candidates, awaiting verification. */
export type SlotCandidates = {
  slot: ShotSpec;
  candidates: StockImage[];
};

/** True when the dossier carries at least one usable image. */
export function dossierHasImagery(dossier: DesignDossier | null): dossier is DesignDossier {
  return (
    dossier !== null &&
    dossier.hero.length + dossier.support.length + dossier.portraits.length > 0
  );
}

/**
 * Gather the imagery for one prototype build.
 *
 * @param imageQueries  Domain search queries from the classifier (possibly []).
 * @param stylePack     The classified pack — its `token.imagery` flavors the
 *                      hero query and stands in when domain queries are empty.
 */
export async function buildDesignDossier(
  imageQueries: string[],
  stylePack: StylePack,
): Promise<DesignDossier | null> {
  const domainPrimary = imageQueries[0]?.trim();
  const domainSecondary = imageQueries[1]?.trim() || imageQueries[2]?.trim();

  // The aesthetic modifier's first fragment ("artisan craft", "calm wellness")
  // sharpens the hero search without drowning the domain terms.
  const aestheticSeed = stylePack.token.imagery.split(",")[0]?.trim() ?? "";

  const heroQuery = domainPrimary
    ? `${domainPrimary}, ${aestheticSeed}`
    : stylePack.token.imagery;
  const supportQuery = domainSecondary ?? domainPrimary ?? stylePack.token.imagery;

  // Three independent searches; each degrades to null on its own. Run in
  // parallel — combined wall time stays inside the single-search timeout.
  const [hero, support, portraits] = await Promise.all([
    searchStockImages({ query: heroQuery, count: 2, orientation: "landscape" }),
    searchStockImages({ query: supportQuery, count: 3 }),
    searchStockImages({
      query: "professional portrait headshot natural light",
      count: 4,
      orientation: "portrait",
    }),
  ]);

  if (!hero && !support && !portraits) return null;

  // De-dupe across buckets (Pexels can repeat a photo between related
  // queries; a duplicated hero/section image reads as a template bug).
  const seen = new Set<string>();
  const takeUnique = (images: StockImage[] | null): StockImage[] =>
    (images ?? []).filter((img) => {
      if (seen.has(img.url)) return false;
      seen.add(img.url);
      return true;
    });

  return {
    hero: takeUnique(hero),
    support: takeUnique(support),
    portraits: takeUnique(portraits),
  };
}

/** Ratio → Pexels orientation, so candidates arrive crop-compatible. */
function orientationForShot(slot: ShotSpec): "landscape" | "portrait" | "square" {
  if (slot.geometry.ratio === "1:1") return "square";
  const [w, h] = slot.geometry.ratio.split(":").map(Number);
  if (Number.isFinite(w) && Number.isFinite(h) && h > w) return "portrait";
  return "landscape";
}

/**
 * Fase A · Paso 6 — candidates per shot-list slot (Quality Layer v2).
 *
 * The creative order's shot list replaces the fixed hero/support/portrait
 * buckets: each slot searches with ITS query and orientation, several
 * candidates each, so the batch verifier (image-verify.ts) has real
 * options to accept or reject per slot.
 *
 * Degradation stays intact: when there is NO order (LLM down, unusable
 * reply), callers use `buildDesignDossier` above — today's behaviour,
 * the emergency net (Regla 0).
 *
 * Never throws; a slot whose search fails simply carries zero candidates
 * (the verifier maps it to an empty slot and the brief tells v0 to lean
 * on typography there).
 */
export async function gatherShotCandidates(
  shotList: ShotSpec[],
  candidatesPerSlot = 4,
): Promise<SlotCandidates[]> {
  const results = await Promise.all(
    shotList.map(async (slot) => {
      const images = await searchStockImages({
        query: slot.searchQuery,
        count: candidatesPerSlot,
        orientation: orientationForShot(slot),
      });
      return { slot, candidates: images ?? [] };
    }),
  );

  // De-dupe across slots — the same CDN photo answering two different
  // queries would read as a template bug in the prototype.
  const seen = new Set<string>();
  return results.map(({ slot, candidates }) => ({
    slot,
    candidates: candidates.filter((img) => {
      if (seen.has(img.url)) return false;
      seen.add(img.url);
      return true;
    }),
  }));
}
