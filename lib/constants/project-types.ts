/**
 * lib/constants/project-types.ts
 *
 * v3 prep — canonical project-type vocabulary shared across the
 * Web↔App boundary. The codebase has had TWO different vocabularies
 * since FASE 1:
 *
 *   1. `session.projectType` (DB column `studio_session.project_type`)
 *      populated with one of the 5 `PROJECT_CATEGORIES` from
 *      `lib/maxwell/proposal-rules.ts` — used by pricing, the prototype
 *      brief router, and the style-pack fallback.
 *
 *   2. `studio_brief.platform` (populated by the brief extractor)
 *      with values "web" | "mobile" | "both" | "unknown" — coarse
 *      delivery-platform hint extracted from free-text conversation.
 *
 * v3 needs a SINGLE canonical vocabulary that both repos agree on so
 * payloads serialised on one side decode cleanly on the other (Web
 * sends `{ projectType: "web_landing" }`, App reads
 * `projectType === "web_landing"` — no string-compare drift). The 5
 * existing `PROJECT_CATEGORIES` ARE the canonical set; this file
 * re-exports them under a stable name + adds normalisation helpers so
 * the legacy `platform` strings still resolve to something useful
 * during the migration window.
 *
 * Why this file lives in `lib/constants/` (not `lib/maxwell/`):
 *   The cross-repo contract treats project types as a top-level
 *   protocol vocabulary, not a Maxwell-internal detail. App-side will
 *   eventually mirror this file at the same import path. Keeping it
 *   out of `lib/maxwell/` signals "this is the boundary contract" to
 *   future readers and prevents accidental coupling to Maxwell-only
 *   logic (e.g. pricing rules) when callers reach for the canonical
 *   list.
 *
 * Scope (intentional, NON-breaking):
 *   - Re-exports the canonical type + tuple — no behaviour change for
 *     existing imports.
 *   - Adds `LEGACY_PLATFORM_TO_PROJECT_TYPE` for brief-extractor →
 *     canonical translation.
 *   - Adds `normalizeProjectType` that accepts canonical, legacy
 *     platform, or arbitrary string and returns a canonical value or
 *     null. Does NOT do keyword extraction (use
 *     `resolveProjectCategory` from proposal-rules for that).
 *   - Adds `isCanonicalProjectType` type guard for runtime narrowing.
 *
 * This file does NOT touch `proposal-rules.ts` or any existing caller.
 * The cross-repo follow-up (when ready) is: switch
 * `noon-app-integration` payload serialisation to call
 * `normalizeProjectType` so the App receives canonical values even if
 * the legacy `platform` ever leaks into a session's projectType field.
 */

import {
  PROJECT_CATEGORIES,
  type ProjectCategory,
} from "@/lib/maxwell/proposal-rules";

/**
 * Canonical project-type strings used across the cross-repo contract.
 * This is the SAME 5-tuple as `keyof typeof PROJECT_CATEGORIES`; the
 * alias exists so consumers can import a stable name without coupling
 * to Maxwell pricing internals.
 */
export type CanonicalProjectType = ProjectCategory;

/**
 * Source-of-truth list of canonical project types as a tuple. Derived
 * via `as const` from the pricing categories so adding / removing a
 * category in `proposal-rules.ts` automatically reflects here at
 * compile time — no two-place edits.
 */
export const CANONICAL_PROJECT_TYPES = Object.keys(
  PROJECT_CATEGORIES,
) as readonly CanonicalProjectType[];

/**
 * Brief-extractor legacy values → canonical project type. The
 * extractor produces "web" | "mobile" | "both" | "unknown" via the
 * `platform` field in the structured brief. Mapping rules:
 *
 *   - "web"     → "web_landing"      (most-common, conservative default)
 *   - "mobile"  → "mobile"           (exact match)
 *   - "both"    → "webapp_system"    (cross-platform usually means an app)
 *   - "unknown" → null               (caller decides default; do not silently
 *                                    pick a category — the proposal rules
 *                                    fall back to `webapp_system` on null
 *                                    if pricing is needed)
 *
 * Why "web" → "web_landing" and not "webapp_system": pre-Maxwell
 * traffic that just says "we need a website" is overwhelmingly
 * landing/corporate ("show what we do") rather than a custom app
 * ("operate the business"). Picking landing keeps the default cheap +
 * fast; sessions that actually need a system get re-classified by
 * `resolveProjectCategory` from the goal summary anyway.
 */
export const LEGACY_PLATFORM_TO_PROJECT_TYPE: Readonly<
  Record<string, CanonicalProjectType | null>
> = {
  web: "web_landing",
  mobile: "mobile",
  both: "webapp_system",
  unknown: null,
};

/**
 * Runtime type guard. Useful both for narrowing untrusted input
 * (incoming webhook payload) and for defensive checks before calling
 * code that expects a canonical value.
 */
export function isCanonicalProjectType(
  input: unknown,
): input is CanonicalProjectType {
  return (
    typeof input === "string" &&
    Object.prototype.hasOwnProperty.call(PROJECT_CATEGORIES, input)
  );
}

/**
 * Normalise an arbitrary string to a canonical project type, or null
 * when there's no safe mapping.
 *
 * Order of resolution:
 *   1. Already canonical → return as-is.
 *   2. Known legacy platform value → translate via
 *      `LEGACY_PLATFORM_TO_PROJECT_TYPE`.
 *   3. Anything else (random free text, typo, "ecomerce" with a
 *      missing 'm') → null. Caller decides whether to fall back to a
 *      default category or refuse the request — silently picking a
 *      category here would hide bugs.
 *
 * Case-insensitive on the legacy values (the brief extractor emits
 * lowercase but historical data + user-typed overrides might capitalise).
 * Canonical values are exact-match because they appear in DB columns;
 * any case drift there is a bug we want to surface, not paper over.
 *
 * NOTE: this is NOT a substitute for `resolveProjectCategory` in
 * proposal-rules.ts, which does keyword extraction from free text
 * (e.g. "we want an ecommerce store" → `ecommerce`). Use that when
 * the input is a goal summary; use this when the input is supposed to
 * already be one of the known vocabulary values.
 */
export function normalizeProjectType(
  input: string | null | undefined,
): CanonicalProjectType | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  if (isCanonicalProjectType(trimmed)) {
    return trimmed;
  }

  const legacyMapped = LEGACY_PLATFORM_TO_PROJECT_TYPE[trimmed.toLowerCase()];
  if (legacyMapped !== undefined) {
    return legacyMapped;
  }

  return null;
}

/**
 * Inverse mapping helper — given a canonical project type, return the
 * closest legacy `platform` value. Useful for the migration window
 * where some App-side consumers still emit/expect the legacy `platform`
 * field; new code on the Web side should always serialise the canonical
 * value and let the consumer downgrade if needed.
 *
 *   "web_landing"        → "web"
 *   "ecommerce"          → "web"     (ecommerce sites are web)
 *   "webapp_system"      → "both"    (web-first but mobile-friendly)
 *   "mobile"             → "mobile"
 *   "saas_ai_automation" → "web"     (SaaS dashboards are web)
 *
 * The lossy direction is intentional — the canonical set is richer
 * than the legacy. Use only where backward-compat requires it.
 */
export function canonicalToLegacyPlatform(
  canonical: CanonicalProjectType,
): "web" | "mobile" | "both" {
  switch (canonical) {
    case "mobile":
      return "mobile";
    case "webapp_system":
      return "both";
    case "web_landing":
    case "ecommerce":
    case "saas_ai_automation":
      return "web";
  }
}
