/**
 * scripts/pool-curation.mjs — la lista de compras del archivo de referencias.
 *
 * Deliberately manual (Fase A · E3.5). Scraping the design galleries would
 * be brittle and sits against their terms; instead the pool tells us where
 * it keeps falling short, a human picks the answer, and one line of JSON
 * adds it — no deploy, no code change.
 *
 *   node scripts/pool-curation.mjs                    # what the pool is missing
 *   node scripts/pool-curation.mjs add <family> <url> ["why"]
 *
 * Extras live in `<data>/pool-extras.json` (same root as the study cache,
 * overridable with MAXWELL_DOSSIER_CACHE_DIR) and are read by
 * lib/maxwell/pool-extras.ts at selection time.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR =
  process.env.MAXWELL_DOSSIER_CACHE_DIR?.trim() ||
  path.join(".data", "maxwell", "dossiers");
const QUEUE = path.join(DATA_DIR, "curation-queue.json");
const EXTRAS = path.join(DATA_DIR, "pool-extras.json");

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function showQueue() {
  const [queue, extras] = await Promise.all([readJson(QUEUE, []), readJson(EXTRAS, {})]);

  if (queue.length === 0) {
    console.log("La cola está vacía: el archivo cubrió todo lo que le llegó.\n");
  } else {
    const byFamily = new Map();
    for (const gap of queue) {
      const entry = byFamily.get(gap.familyId) ?? { count: 0, examples: [] };
      entry.count += 1;
      if (gap.projectHint && entry.examples.length < 5 && !entry.examples.includes(gap.projectHint)) {
        entry.examples.push(gap.projectHint);
      }
      byFamily.set(gap.familyId, entry);
    }

    console.log(`\nHUECOS DE COBERTURA (${queue.length} anotaciones)\n`);
    for (const [familyId, entry] of [...byFamily].sort((a, b) => b[1].count - a[1].count)) {
      console.log(`  ${familyId}  —  ${entry.count} veces`);
      for (const example of entry.examples) console.log(`      · ${example}`);
    }
  }

  const families = Object.keys(extras);
  console.log(
    families.length === 0
      ? "\nSin referencias añadidas a mano todavía.\n"
      : `\nREFERENCIAS AÑADIDAS A MANO:\n${families
          .map((f) => `  ${f}: ${extras[f].map((r) => r.url).join(", ")}`)
          .join("\n")}\n`,
  );
}

async function addReference(familyId, url, why) {
  if (!familyId || !url) {
    console.error('Uso: node scripts/pool-curation.mjs add <family> <url> ["por qué"]');
    process.exit(1);
  }
  const extras = await readJson(EXTRAS, {});
  const list = Array.isArray(extras[familyId]) ? extras[familyId] : [];

  if (list.some((ref) => ref.url === url)) {
    console.log(`Ya estaba: ${url} en ${familyId}`);
    return;
  }

  list.push({ url, ...(why ? { why } : {}) });
  extras[familyId] = list;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(EXTRAS, JSON.stringify(extras, null, 2), "utf8");
  console.log(`Añadida a ${familyId}: ${url}${why ? ` — ${why}` : ""}`);
}

const [command, ...args] = process.argv.slice(2);
if (command === "add") {
  await addReference(args[0], args[1], args[2]);
} else {
  await showQueue();
}
