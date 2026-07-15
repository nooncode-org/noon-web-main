/**
 * lib/maxwell/prototype-source-integrity.ts
 *
 * Pure content gate for v0 output, consumed by the prototype poll route.
 *
 * Why: v0 repeatedly emits `app/page.tsx` importing custom components it never
 * generates ("The file /components/hero-section cannot be found" — 3/3 initial
 * generations on 2026-07-14 were broken this way). The existing preview gate
 * (`isPreviewUrlReady` = HTTP 200 + text/html) cannot detect it because v0's
 * demo shell always serves HTML even when the compiled app is broken. A broken
 * deploy that commits a version burns the client's monthly prototype quota
 * (1/account/UTC-month) through no fault of their own.
 *
 * The check: every extensionless local import (`@/x`, `./x`, `../x`) across
 * the emitted files must resolve to another emitted file — EXCEPT the shadcn
 * registry paths v0's environment provides without emitting them:
 * `components/ui/*`, `lib/*`, `hooks/*`. Imports WITH an extension (css,
 * svg, json) are skipped too — v0 auto-provides e.g. `app/globals.css`.
 * Deliberately narrow so a false positive can never hold a healthy build in
 * the poll loop forever (the poll budget cap still bounds the worst case).
 */

import type { V0SourceFile } from "./serialize-v0-source";

const RESOLVABLE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mjs"];

/** Paths v0's runtime provides without emitting files (shadcn registry). */
const PROVIDED_PREFIXES = ["components/ui/", "lib/", "hooks/"];

/** import ... from "spec" | export ... from "spec" | import("spec") */
const IMPORT_SPECIFIER_RE =
  /(?:import|export)\s+[^'"]*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;

/** Resolve `../`/`./` segments against the importing file's directory. */
function resolveRelative(importerName: string, specifier: string): string {
  const baseSegments = importerName.split("/").slice(0, -1);
  for (const segment of specifier.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      baseSegments.pop();
    } else {
      baseSegments.push(segment);
    }
  }
  return baseSegments.join("/");
}

/** Normalize a specifier to a repo-root-relative path, or null if not local. */
function normalizeLocalSpecifier(importerName: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) return specifier.slice(2);
  if (specifier.startsWith("/")) return specifier.slice(1);
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return resolveRelative(importerName, specifier);
  }
  return null; // package import
}

/**
 * Returns the local import specifiers that do NOT resolve to any emitted file
 * (deduped, in first-seen order). Empty array = output is self-consistent.
 * `files` undefined/empty returns [] — nothing to verify, the caller decides
 * whether to gate on that separately.
 */
export function findMissingLocalImports(
  files: V0SourceFile[] | undefined | null,
): string[] {
  if (!files || files.length === 0) return [];

  const emitted = new Set(files.map((f) => f.name.replace(/^\/+/, "")));
  const resolves = (path: string): boolean => {
    if (emitted.has(path)) return true;
    for (const ext of RESOLVABLE_EXTENSIONS) {
      if (emitted.has(`${path}${ext}`) || emitted.has(`${path}/index${ext}`)) {
        return true;
      }
    }
    return false;
  };

  const missing: string[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const name = file.name.replace(/^\/+/, "");
    // Only scan code files — a stray "import" word in css/md must not match.
    if (!RESOLVABLE_EXTENSIONS.some((ext) => name.endsWith(ext))) continue;

    for (const match of file.content.matchAll(IMPORT_SPECIFIER_RE)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (!specifier) continue;

      const normalized = normalizeLocalSpecifier(name, specifier);
      if (!normalized) continue;
      // Skip imports with an extension (css/svg/json…) — the v0 environment
      // provides several of those (e.g. app/globals.css) without emitting them.
      if (/\.[a-z0-9]+$/i.test(normalized)) continue;
      if (PROVIDED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) continue;
      if (resolves(normalized)) continue;

      if (!seen.has(specifier)) {
        seen.add(specifier);
        missing.push(specifier);
      }
    }
  }

  return missing;
}
