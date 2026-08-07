/**
 * lib/maxwell/asset-library.ts
 *
 * Fase A · E3.4 — NIVEL 0 de la cascada de recursos (spec §6): "librería
 * propia de Noon: solo coincidencias verificadas por slot y familia; cada
 * generación aprobada se archiva aquí → el coste se paga una vez y el
 * sistema se compone con el tiempo".
 *
 * What goes in: ONLY images the customs gate approved for a slot. A photo
 * that passed the six attributes plus crop survival for "artisan bakery
 * interior, warm morning light" is exactly the photo the next bakery needs
 * — and re-finding it costs a search and a vision call we already paid.
 *
 * What comes out: candidates for a slot of the SAME family and the SAME
 * role whose keywords overlap. Deliberately conservative — a near-miss
 * from the library would defeat the fidelity rule it exists to serve. The
 * customs gate still judges whatever this returns; the library is a
 * shortcut to candidates, never a bypass of verification.
 *
 * Storage: one JSON index under the same env-overridable data root as the
 * dossier cache. Small by design (capped), append-mostly, and rewritten
 * whole — at this scale a database would be ceremony.
 *
 * Never throws: any failure returns nothing and the cascade drops to the
 * next level, which is exactly what it would have done anyway.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { log } from "@/lib/server/logger";
import type { StockImage } from "@/lib/server/stock-images";
import type { ShotRole } from "./creative-order";

export type LibraryAsset = {
  url: string;
  urlLarge: string;
  alt: string;
  avgColor: string | null;
  role: ShotRole;
  familyId: string;
  /** Normalized words from the shot query — what makes a future match. */
  keywords: string[];
  addedAt: string;
};

const DEFAULT_DATA_DIR = path.join(".data", "maxwell", "dossiers");
const LIBRARY_FILE = "asset-library.json";
/** Ceiling: the library is a curated shortcut, not an archive of everything. */
const MAX_ENTRIES = 600;

/** Words that match everything and therefore mean nothing. */
const STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "with", "and", "for", "to",
  "photo", "image", "shot", "background", "modern", "beautiful", "nice",
]);

function libraryPath(): string {
  const fromEnv = process.env.MAXWELL_DOSSIER_CACHE_DIR?.trim();
  const root = fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_DATA_DIR;
  return path.join(root, LIBRARY_FILE);
}

/** Query → the words worth matching on. Exported for tests. */
export function keywordsOf(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
    ),
  );
}

async function readLibrary(): Promise<LibraryAsset[]> {
  try {
    const raw = await readFile(libraryPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LibraryAsset[]) : [];
  } catch {
    return [];
  }
}

/**
 * Candidates for one slot, best overlap first. Same family AND same role
 * are hard requirements: a portrait never stands in for a hero, and a
 * warm-artisanal photo never wanders into a fintech prototype.
 */
export async function lookupLibraryAssets(params: {
  familyId: string;
  role: ShotRole;
  query: string;
  limit?: number;
}): Promise<StockImage[]> {
  const { familyId, role, query, limit = 3 } = params;
  const wanted = keywordsOf(query);
  if (wanted.length === 0) return [];

  const library = await readLibrary();
  return library
    .filter((asset) => asset.familyId === familyId && asset.role === role)
    .map((asset) => ({
      asset,
      score: asset.keywords.filter((word) => wanted.includes(word)).length,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ asset }) => ({
      url: asset.url,
      urlLarge: asset.urlLarge,
      alt: asset.alt,
      avgColor: asset.avgColor,
    }));
}

/**
 * File a verified winner. Called after the customs gate, never before —
 * the library's whole value is that everything in it already passed.
 * Duplicates are ignored; the oldest entries fall off the end at the cap.
 */
export async function archiveLibraryAssets(
  entries: {
    image: StockImage;
    role: ShotRole;
    familyId: string;
    query: string;
  }[],
): Promise<void> {
  if (entries.length === 0) return;
  try {
    const library = await readLibrary();
    const known = new Set(library.map((asset) => `${asset.familyId}|${asset.role}|${asset.url}`));
    const now = new Date().toISOString();

    for (const entry of entries) {
      const key = `${entry.familyId}|${entry.role}|${entry.image.url}`;
      if (known.has(key)) continue;
      known.add(key);
      library.push({
        url: entry.image.url,
        urlLarge: entry.image.urlLarge,
        alt: entry.image.alt,
        avgColor: entry.image.avgColor,
        role: entry.role,
        familyId: entry.familyId,
        keywords: keywordsOf(entry.query),
        addedAt: now,
      });
    }

    const trimmed = library.slice(-MAX_ENTRIES);
    await mkdir(path.dirname(libraryPath()), { recursive: true });
    await writeFile(libraryPath(), JSON.stringify(trimmed), "utf8");
  } catch (error) {
    log.warn("maxwell.asset-library", "archive failed — the search path still works", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
