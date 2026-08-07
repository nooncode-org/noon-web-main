/**
 * lib/maxwell/reference-study/refresh.ts
 *
 * Fase A · E3.3 — the periodic re-visit (spec §3, approved by the owner
 * 2026-08-04): "las páginas de referencia cambian con el tiempo, así que
 * cada ciertos meses el sistema las re-visita y actualiza sus análisis
 * automáticamente". Until now the cache only MARKED fichas as stale; this
 * is what actually refreshes them.
 *
 * Shape of the work: the pool is our own curated allowlist, so the refresh
 * walks it, keeps the ones whose ficha has expired, and re-studies them —
 * one at a time, oldest first, with a hard cap per run. A refresh is
 * housekeeping: it must never spike cost or hold a lock on anything a
 * client is waiting for.
 *
 * Never throws. A reference that fails to re-study keeps its old ficha
 * (stale beats none) and the next run tries again.
 */

import { log } from "@/lib/server/logger";
import { STYLE_PACKS } from "../style-packs";
import { isDossierStale, readCachedDossier } from "./dossier-cache";
import { measureReference } from "./measure";
import { buildReferenceDossier } from "./dossier";
import { writeCachedDossier } from "./dossier-cache";

export type RefreshReport = {
  checked: number;
  stale: number;
  refreshed: number;
  failed: number;
};

/** Cost ceiling per run: a few fresh studies, never the whole pool at once. */
const MAX_REFRESH_PER_RUN = 3;

function poolUrls(): string[] {
  const urls = new Set<string>();
  for (const pack of STYLE_PACKS) {
    for (const ref of pack.refs) {
      urls.add(/^https?:\/\//.test(ref.url) ? ref.url : `https://${ref.url}`);
    }
  }
  return [...urls];
}

/**
 * Re-study the pool references whose ficha has expired.
 * `limit` caps how many are refreshed in this run.
 */
export async function refreshStaleDossiers(
  limit = MAX_REFRESH_PER_RUN,
): Promise<RefreshReport> {
  const report: RefreshReport = { checked: 0, stale: 0, refreshed: 0, failed: 0 };

  // Only cached-and-expired entries qualify: a reference never studied is
  // not "stale", it is simply unvisited — the client path pays for that
  // one, on demand, when it is actually needed.
  const expired: { url: string; cachedAt: string }[] = [];
  for (const url of poolUrls()) {
    report.checked += 1;
    const cached = await readCachedDossier(url);
    if (cached && isDossierStale(cached.cachedAt)) {
      expired.push({ url, cachedAt: cached.cachedAt });
    }
  }
  report.stale = expired.length;

  // Oldest first — the ficha most likely to describe a page that no longer
  // exists gets fixed first.
  expired.sort((a, b) => Date.parse(a.cachedAt) - Date.parse(b.cachedAt));

  for (const entry of expired.slice(0, Math.max(0, limit))) {
    try {
      const measurements = await measureReference(entry.url);
      const dossier = await buildReferenceDossier(measurements);
      if (!dossier) {
        report.failed += 1;
        continue;
      }
      await writeCachedDossier(entry.url, dossier);
      report.refreshed += 1;
    } catch (error) {
      // The old ficha stays in place: stale beats none (Regla 0).
      report.failed += 1;
      log.warn("maxwell.reference-refresh", "re-study failed — keeping the old ficha", {
        url: entry.url,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return report;
}
