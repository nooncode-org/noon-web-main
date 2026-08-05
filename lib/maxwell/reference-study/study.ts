/**
 * lib/maxwell/reference-study/study.ts
 *
 * Fase A — the study's front door: cache → measure → judge → cache.
 *
 * `studyReference(url)` is what the harness (and later the pipeline)
 * calls per reference. Cheap when the ficha exists (one file read — the
 * system speeds up week by week), full price only for the never-seen.
 *
 * Regla 0 end to end: every failure returns `{ dossier: null }` and the
 * caller falls back to family tokens. A stale ficha is still served
 * (better than none) and flagged so the debt is visible; refreshing it
 * is Entrega 3's offline pass.
 */

import { log } from "@/lib/server/logger";
import { buildReferenceDossier, type ReferenceDossier } from "./dossier";
import {
  isDossierStale,
  readCachedDossier,
  writeCachedDossier,
} from "./dossier-cache";
import { measureReference } from "./measure";

export type StudyResult = {
  dossier: ReferenceDossier | null;
  /** "cache" | "fresh" | "none" — the harness reports it, counters count it. */
  source: "cache" | "fresh" | "none";
  /** True when served from cache past its expiry (E3 refreshes these). */
  stale: boolean;
};

export async function studyReference(url: string): Promise<StudyResult> {
  const cached = await readCachedDossier(url);
  if (cached) {
    const stale = isDossierStale(cached.cachedAt);
    if (stale) {
      log.warn("maxwell.reference-study", "serving stale ficha (E3 pass will refresh)", {
        url,
        cached_at: cached.cachedAt,
      });
    }
    return { dossier: cached.dossier, source: "cache", stale };
  }

  try {
    const measurements = await measureReference(url);
    const dossier = await buildReferenceDossier(measurements);
    if (!dossier) return { dossier: null, source: "none", stale: false };

    await writeCachedDossier(url, dossier);
    return { dossier, source: "fresh", stale: false };
  } catch (error) {
    // Navigation/browser failure — the reference stays unstudied and the
    // pipeline continues on family tokens.
    log.error("maxwell.reference-study", error, { url });
    return { dossier: null, source: "none", stale: false };
  }
}
