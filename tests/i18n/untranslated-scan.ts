/**
 * tests/i18n/untranslated-scan.ts
 *
 * Counts user-facing text that a component writes inline instead of reading
 * from the message files.
 *
 * WHY THIS EXISTS: the site was internationalised once already. The -rd
 * redesign then rebuilt every marketing page with its copy typed straight into
 * the JSX, and nothing complained — not the build, not the tests, not the
 * types. It surfaced months later as "the site promises Spanish and answers in
 * English", and only because someone looked.
 *
 * A translation pass fixes today. This fixes tomorrow: the count it produces is
 * frozen into a baseline, and the test beside it fails when the count RISES.
 * Translating is then the only direction the code can move.
 *
 * It is deliberately a heuristic, not a parser. A ratchet only has to detect
 * CHANGE, so a rough count that is consistently rough is enough — and a regex
 * that anyone can read beats an AST walk nobody maintains.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Repo root. `process.cwd()` rather than `__dirname`: vitest runs these as ES
 * modules, where `__dirname` does not exist, and vitest.config.ts sits at the
 * root so the working directory is the root.
 */
export const REPO_ROOT = process.cwd();

const SCAN_DIRS = ["app", "components"];

/**
 * Paths the ratchet ignores.
 *
 * `wspreview` / `tracepreview` / `lab` are internal playgrounds: wspreview is
 * the owner's permanent design bench (404s outside dev), the others are benches
 * too. No client ever reads them, so their copy is not a promise to anyone.
 */
const IGNORED = /node_modules|[\\/]\.next|wspreview|tracepreview|[\\/]lab[\\/]/;

/**
 * What counts as user-facing text:
 *   1. text sitting between JSX tags — `>Save changes<`
 *   2. attributes a person actually reads or hears — placeholder, aria-label,
 *      title, alt.
 *
 * Both require a capital letter and some length, which is what separates
 * "Save changes" from a class name, a key, or an icon glyph. Anything inside
 * braces is an expression, not literal copy, so `>{t("save")}<` never matches —
 * which is the whole point.
 */
const VISIBLE_TEXT_PATTERNS: readonly RegExp[] = [
  />\s*[A-Z][A-Za-z][^<>{}\n]{3,}</g,
  /(?:placeholder|aria-label|title|alt)="[A-Z][^"]{3,}"/g,
];

/** A file already reading from the message files is, by definition, done. */
const USES_TRANSLATIONS = /useTranslations|getTranslations/;

export interface UntranslatedFile {
  /** Repo-relative, forward slashes, so the baseline is the same on any OS. */
  file: string;
  count: number;
}

function toPosix(p: string): string {
  return p.split(sep).join("/");
}

function collectTsxFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (IGNORED.test(full)) continue;
    if (statSync(full).isDirectory()) {
      collectTsxFiles(full, out);
    } else if (full.endsWith(".tsx")) {
      out.push(full);
    }
  }
}

export function countVisibleStrings(source: string): number {
  let total = 0;
  for (const pattern of VISIBLE_TEXT_PATTERNS) {
    total += (source.match(pattern) || []).length;
  }
  return total;
}

/**
 * Every component that still writes its own copy, with how much of it.
 * Sorted by path so the baseline diffs cleanly.
 */
export function scanUntranslated(): UntranslatedFile[] {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    collectTsxFiles(join(REPO_ROOT, dir), files);
  }

  const found: UntranslatedFile[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    if (USES_TRANSLATIONS.test(source)) continue;
    const count = countVisibleStrings(source);
    if (count > 0) {
      found.push({ file: toPosix(relative(REPO_ROOT, file)), count });
    }
  }
  return found.sort((a, b) => a.file.localeCompare(b.file));
}
