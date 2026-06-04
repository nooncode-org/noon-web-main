/**
 * lib/maxwell/prototype-poll-policy.ts
 *
 * Pure policy helpers that bound the v0 prototype poll loop. Shared by the
 * server route (`app/api/maxwell/prototype/poll/route.ts`) and the client
 * driver (`components/maxwell/studio-shell.tsx`) so both sides agree on a
 * single set of thresholds.
 *
 * **Why this exists.** The client re-polls `/api/maxwell/prototype/poll`
 * every 5s while v0 generates, and re-polls whenever the server answers
 * `pending`. There was no upper bound on that recursion, so two v0 misbehaviours
 * could loop forever:
 *
 *   1. Chat-mode signature instability — v0 keeps regenerating the
 *      `latestVersion` id between polls, so the route's two-poll
 *      "stabilization" guard (`confirmationToken === completionSignature`)
 *      never matches and the route returns `pending` indefinitely.
 *   2. A preview URL that never warms up to real HTML.
 *
 * The B28 progress copy ("taking longer than usual" at 90s) was cosmetic only
 * and never stopped the loop. These two thresholds make termination guaranteed:
 *
 *   - {@link MAX_PROTOTYPE_POLL_ATTEMPTS} — hard cap. Past this the loop gives
 *     up gracefully (server reverts the in-flight session, client stops
 *     recursing). ~3 min at the 5s client interval.
 *   - {@link POLL_RESCUE_AFTER_ATTEMPTS} — once we have polled this many times,
 *     stop *requiring* the signature to stabilize and accept the latest
 *     completed version anyway (the preview-ready gate still protects against
 *     committing a cold URL). ~1 min — long enough that a legitimately slow but
 *     stable generation still goes through the normal two-poll path first.
 *
 * Pure module: no I/O, no env reads, no React/Next imports — trivially testable
 * and safe to import from both server routes and "use client" components.
 */

/**
 * Hard cap on the number of poll cycles before the loop gives up.
 * 36 attempts × 5s client interval ≈ 3 minutes.
 */
export const MAX_PROTOTYPE_POLL_ATTEMPTS = 36;

/**
 * Attempt count after which the server stops requiring the completion
 * signature to stabilize and accepts the latest completed version.
 * 12 attempts × 5s ≈ 1 minute of tolerated signature instability.
 */
export const POLL_RESCUE_AFTER_ATTEMPTS = 12;

/**
 * Normalizes a (possibly string / NaN / negative) attempt value to a finite
 * 1-based integer. The client sends `attempt` as a query string; the route
 * passes it through here so the policy helpers always receive a clean number.
 */
export function normalizePollAttempt(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 1) {
    return 1;
  }
  return Math.floor(n);
}

/**
 * True once the poll loop has reached the hard cap and should give up.
 * Used by both the route (to revert + report failed) and the client (as a
 * defensive stop in case it talks to a server build that predates the cap).
 */
export function hasExceededPollBudget(attempt: number): boolean {
  return normalizePollAttempt(attempt) >= MAX_PROTOTYPE_POLL_ATTEMPTS;
}

/**
 * True once we have polled long enough that v0's chat-mode signature
 * instability should no longer block committing a completed version.
 */
export function shouldRescueUnstableCompletion(attempt: number): boolean {
  return normalizePollAttempt(attempt) >= POLL_RESCUE_AFTER_ATTEMPTS;
}
