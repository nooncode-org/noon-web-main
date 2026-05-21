# Cross-repo v3 contracts — App-nooncode mirror spec

**Purpose:** hand the App-side dev (or another agent session
working in `App-nooncode`) the EXACT module contents they need to
mirror so the v3 contracts work as a true cross-repo agreement, not
a Web-only artifact.

**Web-side reference:**
- Merge: `a3ca787` (PR `chore/v3-contracts-prep`)
- Modules: `lib/constants/project-types.ts` + `lib/security/project-isolation.ts`
- Tests (+42): `tests/constants/project-types.test.ts` + `tests/security/project-isolation.test.ts`

**Status when this doc was written (2026-05-19):** Web is the
authoritative source. App has not yet implemented either module.

**Update 2026-05-21:** Mel decidió **unificar** el vocabulario de
project-types al spelling de App. Web migró su lado (código rebautizado
+ migration `20260521_018_project_types_unify.sql`). Esta spec ya
refleja el set unificado abajo — App puede reutilizar sus nombres
existentes (`landing | ecommerce | webapp | mobile | saas_ai`) tal
cual, **sin capa de traducción** entre lados.

---

## Why this exists separately from "just copy the file"

A naive "git format-patch | apply on App" doesn't work because:

1. **TypeScript path aliases differ.** Web uses `@/lib/...`, App uses
   `@/server/...` (per `App-nooncode/tsconfig.json`). The imports
   need rewriting.
2. **App owns `proposal-rules` separately** — Web imports
   `PROJECT_CATEGORIES` from `lib/maxwell/proposal-rules`. App has
   its own pricing rules; the canonical project-type list should be
   declared in `lib/constants/project-types.ts` on the App side too
   and the existing App pricing module should be refactored to
   import from there (or, simpler v1: hand-duplicate the 5-tuple
   with a TODO comment to consolidate later).
3. **App may have different INTERNAL_ONLY_FIELDS.** Web's list (16
   fields) reflects Web's response surfaces. App probably has its
   own set (e.g. PM queue internals, internal user assignment ids).
   The denylist catalog should be merged thoughtfully, not blindly
   copied.

This doc gives the App dev:
- The Web canonical list (so they don't have to read the Web repo)
- The conceptual contract (what both sides must agree on for
  serialised payloads to decode cleanly)
- The minimum App must implement to call themselves "v3-aware"

---

## Contract — what BOTH sides MUST agree on

These are the cross-repo invariants. Anything else is per-repo
detail.

### Project type vocabulary

Both repos use the same 5 canonical strings (unificado 2026-05-21):

```
landing
ecommerce
webapp
mobile
saas_ai
```

Both repos provide a `normalizeProjectType(input: string | null | undefined): CanonicalProjectType | null`
helper that:
- Returns the input if it's already canonical (case-sensitive match)
- Maps legacy `platform` values (`web`/`mobile`/`both`/`unknown`)
  case-INsensitively → canonical:
  - `web` → `landing`
  - `mobile` → `mobile`
  - `both` → `webapp`
  - `unknown` → `null`
- Returns `null` for ANY other input (does NOT silently default)
- Trims whitespace before matching

Both repos provide `canonicalToLegacyPlatform(canonical): "web" | "mobile" | "both"`
with the same lossy mapping for backwards-compat scenarios:
- `landing`, `ecommerce`, `saas_ai` → `web`
- `webapp` → `both`
- `mobile` → `mobile`

**Why both directions:** Web→App messages should serialise canonical;
App→Web (or App→legacy clients) may need the legacy bucket. Having
both functions in both repos means neither side has to invent the
mapping ad-hoc.

### Operational fields denylist

Each repo maintains its OWN `INTERNAL_ONLY_FIELDS` list because the
operational surfaces differ. The CONTRACT is:

> Any field name added to `INTERNAL_ONLY_FIELDS` on EITHER side is
> stripped (or asserted-absent) before crossing any API boundary
> where the recipient is a client — never an internal ops surface.

Coordinate additions: when one repo adds a field to its denylist,
notify the other so they can decide whether the same field exists
in their schema and should also be added.

### Sanitiser semantics

Both repos provide:
- `sanitizeForClient<T>(payload: T): SanitisedForClient<T>` —
  recursive strip, no mutation, type-level removal of denylist keys
- `assertNoInternalFields(payload, ctx?)` — dev guardrail with
  path-aware error message
- `containsInternalFields(payload)` — boolean variant

Same names. Same semantics. Different denylist contents are fine.

---

## Recommended App-side implementation

### Step 1 — Determine the App equivalent of these paths

Adjust based on App's `tsconfig.json` path aliases:

| Web path | App equivalent (verify with App's tsconfig) |
|---|---|
| `lib/constants/project-types.ts` | `lib/constants/project-types.ts` (same) — fits Web/App convention |
| `lib/security/project-isolation.ts` | `lib/security/project-isolation.ts` (same) |
| `tests/constants/project-types.test.ts` | App test path per its runner setup |
| `tests/security/project-isolation.test.ts` | Same |
| Web's `@/lib/maxwell/proposal-rules` import | Replace with App's own pricing module (or, simpler v1: hand-duplicate the 5-tuple) |

### Step 2 — Create `lib/constants/project-types.ts` on App

**File contents below.** Copy verbatim AFTER adjusting the
`PROJECT_CATEGORIES` import to match App's pricing module location
(or use the inline literal in Option B).

#### Option A — App imports from its own pricing module

```typescript
/**
 * lib/constants/project-types.ts (App-side mirror of noon-web-main a3ca787)
 *
 * See docs/cross-repo-v3-contracts-app-mirror.md in noon-web-main
 * for the cross-repo contract rationale.
 */

import {
  PROJECT_CATEGORIES, // ← from App's pricing module — adjust import path
  type ProjectCategory,
} from "@/<app-path-to-pricing-module>";

export type CanonicalProjectType = ProjectCategory;

export const CANONICAL_PROJECT_TYPES = Object.keys(
  PROJECT_CATEGORIES,
) as readonly CanonicalProjectType[];

export const LEGACY_PLATFORM_TO_PROJECT_TYPE: Readonly<
  Record<string, CanonicalProjectType | null>
> = {
  web: "landing",
  mobile: "mobile",
  both: "webapp",
  unknown: null,
};

export function isCanonicalProjectType(
  input: unknown,
): input is CanonicalProjectType {
  return (
    typeof input === "string" &&
    Object.prototype.hasOwnProperty.call(PROJECT_CATEGORIES, input)
  );
}

export function normalizeProjectType(
  input: string | null | undefined,
): CanonicalProjectType | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (isCanonicalProjectType(trimmed)) return trimmed;
  const legacy = LEGACY_PLATFORM_TO_PROJECT_TYPE[trimmed.toLowerCase()];
  if (legacy !== undefined) return legacy;
  return null;
}

export function canonicalToLegacyPlatform(
  canonical: CanonicalProjectType,
): "web" | "mobile" | "both" {
  switch (canonical) {
    case "mobile":
      return "mobile";
    case "webapp":
      return "both";
    case "landing":
    case "ecommerce":
    case "saas_ai":
      return "web";
  }
}
```

#### Option B — App declares the list inline (no cross-import)

Use this if App doesn't have a pricing module that exports
`PROJECT_CATEGORIES`, or you want a hard boundary against App's
internal modules touching the v3 contract.

Replace the `import { PROJECT_CATEGORIES, ... }` block with:

```typescript
// Inline canonical set — keep IDENTICAL to noon-web-main's
// PROJECT_CATEGORIES keys. Cross-repo sync rule: any change here
// requires a coordinated PR in both repos AND a Web-side update of
// lib/maxwell/proposal-rules.ts (pricing rows must cover every
// canonical type).
const PROJECT_CATEGORIES = {
  landing: "Web básica / Landing / Corporate",
  ecommerce: "E-commerce",
  webapp: "Web App / Sistema",
  mobile: "Mobile",
  saas_ai: "SaaS / AI / Automation",
} as const;

export type CanonicalProjectType = keyof typeof PROJECT_CATEGORIES;
```

### Step 3 — Create `lib/security/project-isolation.ts` on App

Copy verbatim from `noon-web-main/lib/security/project-isolation.ts`.

**Then audit `INTERNAL_ONLY_FIELDS` against App's schema.** Likely
fields to consider adding (App-specific, NOT in Web's list):
- PM queue assignment fields (`assignedPmId`, `assignedAt`)
- Internal triage labels
- App-internal feature flag overrides per session
- Any field named `internal*` or ending in `*Token` (other than
  `publicToken`)

**Likely fields to REMOVE from Web's list if App doesn't have
them:** none — Web's 16 are all proposal/payment/maxwell concepts
that should exist symmetrically on App side. Confirm field-by-field.

### Step 4 — Tests on App side

The test files in noon-web-main are vitest-based. Translate to App's
test runner (likely Node's native test runner per
`App-nooncode/tests/server/*` precedent — see
`App-nooncode/lib/server/website-webhook-auth.ts` test for the
pattern).

**Minimum test surface (do not ship without these):**

For `project-types.test.ts`:
- `normalizeProjectType("web")` → `"landing"`
- `normalizeProjectType("mobile")` → `"mobile"`
- `normalizeProjectType("both")` → `"webapp"`
- `normalizeProjectType("unknown")` → `null`
- `normalizeProjectType("random nonsense")` → `null` (NOT a default)
- `normalizeProjectType("WEB")` → `"landing"` (case-insensitive legacy)
- `normalizeProjectType("  landing  ")` → `"landing"` (trim)
- `canonicalToLegacyPlatform` returns valid bucket for every canonical type

For `project-isolation.test.ts`:
- Catalog has no duplicates
- `sanitizeForClient` strips at root + nested + arrays
- `sanitizeForClient` does NOT mutate input
- `sanitizeForClient` passes through Date / class instances unchanged
- `assertNoInternalFields` includes the leak path in the error
- `assertNoInternalFields` includes optional context label

---

## Coordination rules going forward

### When adding a NEW canonical project type

1. Coordinate with the other repo BEFORE merging. The 5-tuple must
   stay in sync.
2. Order: Web merges first (it owns the pricing table that must
   accommodate the new type). App merges within 48h.
3. Update this doc with the new value + rationale.

### When adding a field to `INTERNAL_ONLY_FIELDS`

1. The repo that needs the field adds it first.
2. Notify the other repo. They evaluate whether the same field
   exists in their schema.
3. If yes, they mirror the addition; if no, they document why their
   denylist diverges in their own copy.

### When changing the legacy `platform → canonical` mapping

DON'T. Once shipped, the mapping is part of the wire contract.
Adding a new legacy value is fine; changing an existing mapping
breaks every payload in flight or in queues.

### When deprecating a canonical type

1. Mark the type as deprecated in BOTH repos in the same release
   window.
2. Keep it in `CANONICAL_PROJECT_TYPES` for 1 year minimum.
3. Add a migration plan for sessions/proposals already using it.

---

## What this doc is NOT

- It's not the final cross-repo contract document. That would live
  on a shared knowledge base (Notion / wiki) once it exists.
- It's not authorisation to start App-side coordination — it's the
  spec you'd hand the App dev IF that coordination is happening.
- It's not a substitute for the actual code review. The App dev
  should read `noon-web-main/lib/constants/project-types.ts` and
  `noon-web-main/lib/security/project-isolation.ts` end-to-end
  before mirroring; this doc summarises but doesn't reproduce the
  full docblocks + edge-case comments in those files.
