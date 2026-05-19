/**
 * lib/security/project-isolation.ts
 *
 * v3 prep — sanitise server-side objects before sending them to the
 * client. Acts as the single source of truth for "which fields are
 * operational / internal-only and must NOT cross the API boundary."
 *
 * Why this exists:
 *   Several FASE 1 routes return DB-shaped objects to the client
 *   (e.g. `getStudioSession` → JSON of `StudioSession`). That worked
 *   while every field was either harmless or had a deliberate UI use.
 *   v3 introduces operational fields (SLA timestamps, internal triage
 *   labels, raw provider payloads, internal versioning chains) that
 *   the client must never see — ad-hoc allowlists per route are
 *   error-prone and easy to forget when adding fields. Centralising
 *   the denylist + sanitiser means: add a field once to
 *   `INTERNAL_ONLY_FIELDS`, every sanitised payload silently loses it.
 *
 * Design:
 *   - Single declarative list `INTERNAL_ONLY_FIELDS` (camelCase keys
 *     that match the runtime shape — we serialise camelCase to JSON).
 *   - `sanitizeForClient<T>(payload: T): SanitisedForClient<T>` —
 *     recursive strip at every depth, returns a new object (no
 *     mutation). The output type is `T` minus the internal keys at
 *     every nesting level, so a downstream caller that tries to read
 *     `result.reviewerId` gets a compile error AND a runtime
 *     undefined.
 *   - `assertNoInternalFields(payload, ctx?)` — dev guardrail; throws
 *     when an internal field is present, with a descriptive message.
 *     Use in route tests + (optionally) in non-prod runtime to catch
 *     regressions BEFORE they ship.
 *
 * Scope (NON-breaking, additive):
 *   No existing route calls `sanitizeForClient` yet — this module is
 *   the contract. v3 wiring (one route at a time, with tests proving
 *   the response shape stays valid) lands incrementally in follow-up
 *   PRs. Until then the module is dormant but available.
 *
 * IMPORTANT — what this is NOT:
 *   - Not auth / not access control. Clients with access to a payload
 *     still get the payload; this just removes operational fields.
 *     RLS / route auth is separate.
 *   - Not encryption / not PII redaction. Use the hash helpers in
 *     `lib/server/audit/proposal-access.ts` for PII redaction.
 *   - Not a serialiser. Caller is still responsible for `JSON.stringify`
 *     / `NextResponse.json`. This just strips keys.
 */

/**
 * Catalog of operational fields that should never leave the server.
 *
 * Curation principle: HIGH-confidence internal fields only. When in
 * doubt about a field, leave it OUT and add it when a concrete
 * threat model materialises — accidental over-stripping breaks
 * client UIs in subtle ways (a missing `latestUpdateSummary` is harder
 * to debug than a leaked `reviewerId`).
 *
 * Each entry has a rationale comment so future readers know WHY it's
 * here. Remove + audit the audit-log if you ever drop one of these.
 *
 * Grouped by domain for review. Listed as a flat readonly tuple so
 * `typeof INTERNAL_ONLY_FIELDS[number]` gives a string-literal union
 * for the type machinery below.
 */
export const INTERNAL_ONLY_FIELDS = [
  // --- Proposal review SLA (ops-internal scheduling timestamps) -----------
  // These power the ops queue + SLA reminders but tell a client nothing
  // useful — a client knows "your proposal is being reviewed", not when
  // ops's escalation cron will fire.
  "reviewNotifiedAt",
  "reviewRemindedAt",
  "reviewEscalatedAt",
  "autoSendDueAt",

  // --- Proposal triage (internal classification + ownership) --------------
  "reviewerId",          // Internal staff id — leaking it is a footgun for social-eng.
  "reviewRequired",      // Boolean only meaningful inside the ops console.
  "caseClassification",  // "manual_review" / "auto_send" — internal routing only.

  // --- Proposal versioning chain (internal pointers) ----------------------
  // Clients see the current version; they don't need to know which row
  // superseded which (lets ops rebuild a chain without exposing the
  // graph + the implicit "we changed our mind N times" signal).
  "supersedesProposalRequestId",
  "supersededByProposalRequestId",

  // --- Payment provider internals -----------------------------------------
  // Stripe IDs are needed by ops + audit + the Stripe webhook
  // idempotency check. The client receipt surface shows AMOUNT +
  // CURRENCY + reference; the raw provider event id has no UI value
  // and exposing it confuses "what should I quote at support".
  "providerEventId",
  "providerSessionId",
  "providerPaymentIntentId",
  "stripeCheckoutSessionId",
  "stripePaymentIntentId",
  "payloadJson",         // Raw provider payload — never to a client.

  // --- Maxwell internals --------------------------------------------------
  "stylePackId",         // Internal style classification id (v0 prompt input).
] as const;

export type InternalOnlyField = (typeof INTERNAL_ONLY_FIELDS)[number];

const INTERNAL_FIELD_SET = new Set<string>(INTERNAL_ONLY_FIELDS);

/**
 * Recursive type-level strip. For each property at any depth, if the
 * key is in `INTERNAL_ONLY_FIELDS` it's removed from the output type;
 * otherwise the value type is recursed. Arrays and primitives pass
 * through.
 *
 * Why this matters at the type level (not just runtime): a route that
 * does `const safe = sanitizeForClient(session)` and then logs
 * `safe.reviewerId` SHOULD fail to compile — the field is gone from
 * the type, the editor's auto-complete won't suggest it, and the
 * route reviewer doesn't have to remember "is this field internal?".
 */
export type SanitisedForClient<T> = T extends Array<infer U>
  ? Array<SanitisedForClient<U>>
  : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<SanitisedForClient<U>>
    : T extends Date | null | undefined
      ? T
      : T extends object
        ? {
            [K in keyof T as K extends InternalOnlyField ? never : K]: SanitisedForClient<T[K]>;
          }
        : T;

/**
 * Strip every `INTERNAL_ONLY_FIELDS` key at every depth of `payload`.
 * Returns a new object — does NOT mutate the input (important: the
 * input may be a DB row reused by other code paths).
 *
 * Implementation notes:
 *   - Arrays: map each element through the sanitiser.
 *   - Plain objects: rebuild from entries, skipping internal keys.
 *   - Anything else (Date, primitive, null, undefined): passed through.
 *   - Plain object detection uses `Object.getPrototypeOf(x) === Object.prototype`
 *     so class instances (which can have non-data properties / getters)
 *     are passed through unchanged — caller should plain-objectify
 *     before sanitising if they need stripping inside a class.
 *
 * Cycle safety: this is intended for serialisable, tree-shaped DB
 * payloads. Cyclic graphs will recurse forever. We don't WeakSet-guard
 * because the cost is non-trivial and the input shape is bounded by
 * the JSON-serialisable contract our routes already follow.
 */
export function sanitizeForClient<T>(payload: T): SanitisedForClient<T> {
  return sanitiseAny(payload) as SanitisedForClient<T>;
}

function sanitiseAny(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(sanitiseAny);
  }

  // Pass through Date, Buffer, and other non-plain objects unchanged.
  // Rationale: stripping keys from a class instance breaks methods +
  // prototype chain; callers expecting a Date back should get a Date.
  if (typeof value !== "object") return value;
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (INTERNAL_FIELD_SET.has(key)) continue;
    result[key] = sanitiseAny(val);
  }
  return result;
}

/**
 * Dev-time guard: throws with a precise message if `payload`
 * (recursively) still contains any internal field. Use in route tests
 * to lock in "this response shape never leaks internals" — even
 * better, call it inside the route in non-production builds as a
 * smoke check. Production paths should already have called
 * `sanitizeForClient` so the assert is a no-op.
 *
 *   if (process.env.NODE_ENV !== "production") {
 *     assertNoInternalFields(responseBody, "GET /api/maxwell/session");
 *   }
 *
 * Path is included in the error so a reviewer reading the stack trace
 * sees `Internal field "reviewerId" leaked at proposal.reviewerId
 * (GET /api/maxwell/session)` instead of just a key name.
 */
export function assertNoInternalFields(payload: unknown, context?: string): void {
  const leak = findInternalFieldPath(payload, "");
  if (leak !== null) {
    const where = context ? ` (${context})` : "";
    throw new Error(
      `Internal field "${leak.key}" leaked at ${leak.path || "(root)"}${where}`,
    );
  }
}

function findInternalFieldPath(
  value: unknown,
  path: string,
): { key: string; path: string } | null {
  if (value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = findInternalFieldPath(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }

  if (typeof value !== "object") return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;

  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (INTERNAL_FIELD_SET.has(key)) {
      return { key, path: nextPath };
    }
    const found = findInternalFieldPath(val, nextPath);
    if (found) return found;
  }
  return null;
}

/**
 * Soft check — does `payload` contain ANY internal field anywhere in
 * its tree? Useful for unit tests + opt-in dev assertions where you
 * want a boolean instead of an exception.
 */
export function containsInternalFields(payload: unknown): boolean {
  return findInternalFieldPath(payload, "") !== null;
}
