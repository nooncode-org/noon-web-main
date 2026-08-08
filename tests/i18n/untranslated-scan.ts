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

/**
 * The blind spot that made this guard say "clean" three times in one day while
 * a client read English.
 *
 * Both patterns above require the text to share a line with its tags. Real
 * prose does not: a sentence long enough to matter gets wrapped by the
 * formatter, and from then on it is invisible here. On 2026-08-08 that hid
 * FIFTY-FOUR sentences in the client's own screens — the membership-ended
 * notice, "this proposal has expired", "thanks, your payment went through" —
 * while the count for that area read zero.
 *
 * So: the same idea, allowed to span lines. Everything about it is a trade
 * between missing real copy and crying wolf, and the filters below are where
 * that trade lives. Measured on the client area when written: 117 raw matches,
 * 54 after filtering — the 63 dropped were all code, none were sentences.
 */
const MULTILINE_TEXT = />([^<>{}]{12,400}?)</g;

/**
 * A multi-line match is prose only if it looks like prose.
 *
 * Three words minimum with a lowercase letter among them: that clears type
 * parameters, enum-ish constants and one-word labels (already covered by the
 * single-line pattern). The code markers catch the rest — a function body split
 * across lines sits between a `>` and a `<` exactly like a paragraph does, and
 * `useState<string>(...)` spanning two lines is the commonest offender.
 */
function looksLikeProse(raw: string): boolean {
  if (!raw.includes("\n")) return false; // single-line: the patterns above own it
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length < 12) return false;
  if (!/[a-z]/.test(text)) return false;
  if (/^[.,;:)\]}]/.test(text)) return false;
  if (text.split(" ").filter((w) => /[A-Za-z]{2,}/.test(w)).length < 3) return false;
  if (/\b(const|let|return|useState|function|import|interface|typeof)\b/.test(text)) return false;
  if (/=>|===|!==|\.map\(|\.test\(|\);/.test(text)) return false;
  // A type annotation split across lines: `stopNotice: string | null; inputRef:
  // React.RefObject<…>`. No keyword to key off, so match the shape instead.
  if (/\w+:\s*(string|number|boolean|void|null|unknown|any)\b/.test(text)) return false;
  if (/\|\s*null\b|\bReact\.\w/.test(text)) return false;
  return !/[;{}]$/.test(text);
}

/** JSX comments are prose too, and they are not shipped. Strip before scanning. */
function stripComments(source: string): string {
  return source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Type syntax the first pattern mistakes for a sentence.
 *
 * `Promise<void>` split across lines leaves a literal `> Promise<`, which looks
 * exactly like JSX text between two tags. Nine of those were sitting in the
 * baseline on 2026-08-08, and because they clustered in the client-facing files
 * they made that area look ten times worse than it was: a count of eleven
 * "untranslated strings a client can read" turned out to be one real sentence
 * and ten generics. A guard whose number can't be trusted stops being read.
 *
 * Matching the KNOWN generic names, not "any single capitalised word" — the
 * loose version also swallowed real one-word labels like "Status" and
 * "Capabilities", which is the opposite failure and a worse one.
 */
const TYPE_SYNTAX =
  /^>\s*(?:Promise|Array|Record|Set|Map|Partial|Required|Readonly|Pick|Omit|Exclude|Extract|Awaited|ReturnType|Parameters|React|JSX|ComponentProps|ComponentPropsWithoutRef|Dispatch|SetStateAction|RefObject|MutableRefObject)</;

/**
 * Every file is counted, including ones that already read from the message
 * files.
 *
 * The first version skipped those, on the reasoning that a file using
 * `useTranslations` was finished. It isn't: the realistic failure is a
 * HALF-translated component — someone wires up ten strings, misses three, and
 * the file looks done from the outside. Skipping it would have made the guard
 * blind to exactly the mistake it exists to catch.
 *
 * The cost is that deliberately-English content inside a translated file (the
 * chat's demo conversation, which no client ever sees — the real portal passes
 * its own thread) sits in the baseline as accepted debt. That is the right
 * trade: an entry that never changes is silent, while a blind spot is not.
 */

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
  const code = stripComments(source);
  let total = 0;
  for (const pattern of VISIBLE_TEXT_PATTERNS) {
    for (const match of code.match(pattern) || []) {
      if (TYPE_SYNTAX.test(match.trim())) continue;
      total += 1;
    }
  }
  for (const match of code.matchAll(MULTILINE_TEXT)) {
    if (looksLikeProse(match[1])) total += 1;
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
    const count = countVisibleStrings(source);
    if (count > 0) {
      found.push({ file: toPosix(relative(REPO_ROOT, file)), count });
    }
  }
  return found.sort((a, b) => a.file.localeCompare(b.file));
}
