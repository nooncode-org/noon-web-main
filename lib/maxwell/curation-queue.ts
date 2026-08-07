/**
 * lib/maxwell/curation-queue.ts
 *
 * Fase A · E3.5 — the pool's own shopping list (spec §2: "el archivo se
 * auto-diagnostica: si cubre mal un caso ('funeraria moderna'), lo anota
 * en la cola de curación").
 *
 * The point is that a coverage gap stops being invisible. Today the pool
 * quietly falls back to a neutral family when nothing matches, and the
 * prototype comes out coherent but generic — and nobody ever learns which
 * kind of business we keep failing. Every fallback now leaves a note, and
 * the notes accumulate into "these are the references worth adding next".
 *
 * Deliberately NOT a scraper. Automatically harvesting Awwwards, Mobbin or
 * Godly is brittle and sits against their terms; this queue plus the
 * manual pool-extras path (lib/maxwell/pool-extras.ts) gets the same
 * result — a growing, curated pool — without taking what isn't ours.
 *
 * File-based like the rest of the study's data, and never throws: a lost
 * note is a lost note, never a failed prototype.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { log } from "@/lib/server/logger";

export type CurationGap = {
  /** The family we fell back to — where the hole is. */
  familyId: string;
  /** What the client actually asked for, in their words. */
  projectHint: string;
  /** Why it was logged ("classifier_fallback", "few_references"). */
  reason: string;
  seenAt: string;
};

const DEFAULT_DATA_DIR = path.join(".data", "maxwell", "dossiers");
const QUEUE_FILE = "curation-queue.json";
const MAX_ENTRIES = 300;

function queuePath(): string {
  const fromEnv = process.env.MAXWELL_DOSSIER_CACHE_DIR?.trim();
  const root = fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_DATA_DIR;
  return path.join(root, QUEUE_FILE);
}

export async function readCurationQueue(): Promise<CurationGap[]> {
  try {
    const raw = await readFile(queuePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CurationGap[]) : [];
  } catch {
    return [];
  }
}

/** Log a gap. Fire-and-forget by contract. */
export async function noteCoverageGap(gap: Omit<CurationGap, "seenAt">): Promise<void> {
  try {
    const queue = await readCurationQueue();
    queue.push({ ...gap, seenAt: new Date().toISOString() });
    await mkdir(path.dirname(queuePath()), { recursive: true });
    await writeFile(queuePath(), JSON.stringify(queue.slice(-MAX_ENTRIES)), "utf8");
  } catch (error) {
    log.warn("maxwell.curation-queue", "gap not recorded", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * The shopping list: which families keep coming up short, most pressing
 * first, with the client phrases that landed there. This is what someone
 * reads before deciding which references to add next.
 */
export async function summarizeCurationQueue(): Promise<
  { familyId: string; count: number; examples: string[] }[]
> {
  const queue = await readCurationQueue();
  const byFamily = new Map<string, { count: number; examples: string[] }>();

  for (const gap of queue) {
    const entry = byFamily.get(gap.familyId) ?? { count: 0, examples: [] };
    entry.count += 1;
    if (gap.projectHint && entry.examples.length < 5 && !entry.examples.includes(gap.projectHint)) {
      entry.examples.push(gap.projectHint);
    }
    byFamily.set(gap.familyId, entry);
  }

  return [...byFamily.entries()]
    .map(([familyId, entry]) => ({ familyId, ...entry }))
    .sort((a, b) => b.count - a.count);
}
