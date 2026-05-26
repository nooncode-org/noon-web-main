/**
 * lib/maxwell/prototipo-route-flag.ts
 *
 * Feature gate for the D-slice public route `/maxwell/prototipo/[token]`.
 *
 * Same pattern as `isLifecycleEmailsEnabled` in `email-config.ts`: the code
 * can land + be reviewed + be tested in CI long before the App-side backend
 * (POST handler + GET signed-read handler) goes live in production. Ops flips
 * `MAXWELL_PROTOTIPO_DECISION_ROUTE=1` after the bilateral smoke test passes,
 * without a redeploy.
 *
 * Default OFF — when unset, the route renders `notFound()` so accidental
 * pre-flip discovery is indistinguishable from a non-existent path.
 */

export function isPrototipoDecisionRouteEnabled(): boolean {
  return process.env.MAXWELL_PROTOTIPO_DECISION_ROUTE === "1";
}
