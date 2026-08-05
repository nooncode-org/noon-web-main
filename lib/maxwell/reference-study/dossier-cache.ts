/**
 * lib/maxwell/reference-study/dossier-cache.ts
 *
 * Fase A §3 — "la ficha se cachea por referencia: se paga una vez en la
 * vida del sistema". File-based cache keyed by normalized URL hash.
 *
 * Storage: JSON files under `.data/maxwell/dossiers/` (`.data/` is
 * gitignored). Overridable via MAXWELL_DOSSIER_CACHE_DIR — the harness
 * and tests point it at temp dirs; whatever runtime Entrega 2/3 chooses
 * for production can point it at a mounted path or replace this module
 * behind the same three functions.
 *
 * Expiry: fichas caducan (spec §3, approved 2026-08-04). This module
 * only ANSWERS staleness (`isDossierStale`); the periodic re-visit that
 * refreshes stale fichas is Entrega 3's offline pass. Readers today keep
 * serving a stale ficha (better than none — Regla 0) while flagging it
 * so callers can log the debt.
 *
 * Never throws: read errors → null (re-analyze), write errors → logged
 * and absorbed (the study just pays again next time).
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { log } from "@/lib/server/logger";
import type { ReferenceDossier } from "./dossier";

const DEFAULT_CACHE_DIR = path.join(".data", "maxwell", "dossiers");
/** Spec: "cada ciertos meses" — 120 days ≈ 4 months. */
const STALE_AFTER_DAYS = 120;

export type CachedDossier = {
  dossier: ReferenceDossier;
  cachedAt: string;
};

function cacheDir(): string {
  const fromEnv = process.env.MAXWELL_DOSSIER_CACHE_DIR?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_CACHE_DIR;
}

/** Normalize enough that trailing slashes / fragments don't split the cache. */
export function normalizeReferenceUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    u.search = "";
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function cachePathFor(url: string): string {
  const key = createHash("sha256").update(normalizeReferenceUrl(url)).digest("hex").slice(0, 20);
  return path.join(cacheDir(), `${key}.json`);
}

export function isDossierStale(cachedAt: string, now: Date = new Date()): boolean {
  const t = Date.parse(cachedAt);
  if (!Number.isFinite(t)) return true;
  return now.getTime() - t > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

export async function readCachedDossier(url: string): Promise<CachedDossier | null> {
  try {
    const raw = await readFile(cachePathFor(url), "utf8");
    const parsed = JSON.parse(raw) as Partial<CachedDossier>;
    if (!parsed.dossier || parsed.dossier.version !== 1 || !parsed.cachedAt) return null;
    return { dossier: parsed.dossier, cachedAt: parsed.cachedAt };
  } catch {
    // Missing file or corrupt JSON — same answer: analyze fresh.
    return null;
  }
}

export async function writeCachedDossier(
  url: string,
  dossier: ReferenceDossier,
): Promise<void> {
  try {
    await mkdir(cacheDir(), { recursive: true });
    const payload: CachedDossier = { dossier, cachedAt: new Date().toISOString() };
    await writeFile(cachePathFor(url), JSON.stringify(payload), "utf8");
  } catch (error) {
    log.warn("maxwell.dossier-cache", "cache write failed — study will re-pay next time", {
      url,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
