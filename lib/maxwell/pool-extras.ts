/**
 * lib/maxwell/pool-extras.ts
 *
 * Fase A · E3.5 — the manual way to grow the reference pool, and the
 * counterpart to the curation queue: the queue says WHICH family keeps
 * coming up short, this is where the answer gets added.
 *
 * Why a data file instead of editing `style-packs.ts`: the pool's 24
 * families are a typed tuple of exactly three references each — a
 * deliberate contract that keeps the direction focused. Extras live
 * beside it so adding a reference is a data change (one JSON line, no
 * deploy) while the curated core stays exactly as reviewed.
 *
 * Shape of `.data/maxwell/dossiers/pool-extras.json`:
 *   { "warm-artisanal": [ { "url": "poilane.com", "why": "Editorial, warm" } ] }
 *
 * Everything about it is optional: no file, bad JSON, unknown family →
 * empty list, and the pool behaves exactly as it always has.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { StyleReference } from "./style-packs";

const DEFAULT_DATA_DIR = path.join(".data", "maxwell", "dossiers");
const EXTRAS_FILE = "pool-extras.json";
/** Ceiling per family — extras widen the choice, they do not replace it. */
const MAX_PER_FAMILY = 6;

function extrasPath(): string {
  const fromEnv = process.env.MAXWELL_DOSSIER_CACHE_DIR?.trim();
  const root = fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_DATA_DIR;
  return path.join(root, EXTRAS_FILE);
}

/** Extra references curated for a family. Empty is the normal case. */
export async function readPoolExtras(familyId: string): Promise<StyleReference[]> {
  try {
    const raw = await readFile(extrasPath(), "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const list = parsed?.[familyId];
    if (!Array.isArray(list)) return [];

    return list
      .map((entry) => {
        const obj = (entry ?? {}) as Record<string, unknown>;
        const url = typeof obj.url === "string" ? obj.url.trim() : "";
        if (!url) return null;
        const why = typeof obj.why === "string" && obj.why.trim() ? obj.why.trim() : undefined;
        return { url, ...(why ? { v0Hint: why } : {}) } as StyleReference;
      })
      .filter((ref): ref is StyleReference => ref !== null)
      .slice(0, MAX_PER_FAMILY);
  } catch {
    return [];
  }
}
