#!/usr/bin/env node
/**
 * scripts/bundle-stats-summary.mjs
 *
 * Pretty-prints `.next/diagnostics/route-bundle-stats.json` after a
 * `next build --experimental-analyze` so a human can scan it without
 * opening JSON or a webpack treemap.
 *
 * Triggered by `npm run analyze` (see package.json):
 *   next build --experimental-analyze && node scripts/bundle-stats-summary.mjs
 *
 * Outputs:
 *   - Total + average + median + max first-load JS per route
 *   - Top N largest routes (default N=10)
 *   - Routes flagged over a soft budget (default 1 MB uncompressed)
 *
 * Exit codes:
 *   0  — report generated
 *   1  — bundle-stats file not found (probably forgot --experimental-analyze)
 *   2  — JSON parse error
 *
 * Why this exists:
 *   The 2026-05-19 bundle audit (docs/bundle-and-cve-audit-2026-05-19.md)
 *   confirmed the bundle is healthy, but had to compute totals by hand
 *   from the raw JSON. This script makes the same investigation a
 *   one-command operation, so quarterly perf reviews are cheap.
 *
 *   The webpack-based `@next/bundle-analyzer` does NOT work with
 *   Turbopack (Next 16 default), which is why we use Next's native
 *   `--experimental-analyze` flag + this summary instead.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const STATS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".next",
  "diagnostics",
  "route-bundle-stats.json",
);
const TOP_N = Number(process.env.BUNDLE_TOP_N ?? 10);
const SOFT_BUDGET_BYTES = Number(process.env.BUNDLE_SOFT_BUDGET_BYTES ?? 1_048_576); // 1 MB

function fmt(n) {
  return new Intl.NumberFormat("en-US").format(n);
}

function kb(bytes) {
  return (bytes / 1024).toFixed(1) + " KB";
}

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

if (!existsSync(STATS_PATH)) {
  console.error(
    `[bundle-stats] ${STATS_PATH} not found.\n` +
      `Run \`next build --experimental-analyze\` first (or just \`npm run analyze\`).`,
  );
  process.exit(1);
}

let stats;
try {
  stats = JSON.parse(readFileSync(STATS_PATH, "utf8"));
} catch (err) {
  console.error(`[bundle-stats] Could not parse ${STATS_PATH}: ${err.message}`);
  process.exit(2);
}

if (!Array.isArray(stats) || stats.length === 0) {
  console.log("[bundle-stats] No routes in the stats file. Build may have skipped them.");
  process.exit(0);
}

const sizes = stats.map((s) => s.firstLoadUncompressedJsBytes);
const total = sizes.reduce((a, b) => a + b, 0);
const avg = total / sizes.length;
const med = median(sizes);
const max = Math.max(...sizes);

console.log("");
console.log("┌─────────────────────────────────────────────────────────────────┐");
console.log("│           Bundle stats summary (uncompressed JS)                │");
console.log("│           Source: .next/diagnostics/route-bundle-stats.json     │");
console.log("└─────────────────────────────────────────────────────────────────┘");
console.log("");
console.log(`Routes analyzed: ${fmt(stats.length)}`);
console.log(`Average first-load JS: ${kb(avg)}`);
console.log(`Median  first-load JS: ${kb(med)}`);
console.log(`Max     first-load JS: ${kb(max)}`);
console.log(`Soft budget (per route): ${kb(SOFT_BUDGET_BYTES)} (override via BUNDLE_SOFT_BUDGET_BYTES)`);
console.log("");

// Top N largest
const sorted = [...stats].sort(
  (a, b) => b.firstLoadUncompressedJsBytes - a.firstLoadUncompressedJsBytes,
);
const topN = sorted.slice(0, TOP_N);

console.log(`Top ${TOP_N} largest routes:`);
console.log("");
const longestRouteName = Math.max(...topN.map((s) => s.route.length));
for (const s of topN) {
  const route = s.route.padEnd(longestRouteName);
  const bytes = kb(s.firstLoadUncompressedJsBytes).padStart(10);
  const flag = s.firstLoadUncompressedJsBytes > SOFT_BUDGET_BYTES ? " ⚠️  OVER BUDGET" : "";
  console.log(`  ${route}   ${bytes}${flag}`);
}
console.log("");

// Over-budget summary
const overBudget = stats.filter(
  (s) => s.firstLoadUncompressedJsBytes > SOFT_BUDGET_BYTES,
);
if (overBudget.length === 0) {
  console.log(`✅ Zero routes over the ${kb(SOFT_BUDGET_BYTES)} soft budget.`);
} else {
  console.log(
    `⚠️  ${overBudget.length} route(s) over the ${kb(SOFT_BUDGET_BYTES)} soft budget — consider dynamic imports, code splits, or trimming shared chunks.`,
  );
}
console.log("");
console.log("For full per-route detail (chunk paths, etc.), inspect:");
console.log(`  .next/diagnostics/route-bundle-stats.json`);
console.log(`  .next/diagnostics/analyze/data/routes.json`);
console.log("");
