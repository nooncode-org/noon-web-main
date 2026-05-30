import type { StudioStatus } from "./repositories";

/**
 * Local studio view (phase + failure flag) to apply when rehydrating a session.
 */
export type RehydratedStudioView = {
  phase: StudioStatus;
  prototypeFailed: boolean;
};

/**
 * Resolves how a rehydrated session should render.
 *
 * A session can be persisted in a transient in-flight phase
 * (`generating_prototype` / `revision_requested`) if the user navigated away
 * before the client-driven prototype poll resolved. On rehydrate the client is
 * NOT polling, so that work is orphaned — rendering the in-flight phase as-is
 * would leave the preview pane on an infinite "Building prototype..." spinner.
 *
 * Map the orphaned in-flight case to a terminal view instead:
 *   - a prototype version exists → fall back to it (`prototype_ready`)
 *   - nothing was produced       → retryable failure (`clarifying` + failed),
 *     which surfaces <PreviewFailed> ("Preview not available") with a retry CTA.
 *
 * Non-transient statuses pass through unchanged and never flag failure.
 */
export function resolveRehydratedStudioView(
  status: StudioStatus,
  versionCount: number,
): RehydratedStudioView {
  const isInFlight =
    status === "generating_prototype" || status === "revision_requested";

  if (isInFlight && versionCount === 0) {
    return { phase: "clarifying", prototypeFailed: true };
  }
  if (isInFlight) {
    return { phase: "prototype_ready", prototypeFailed: false };
  }
  return { phase: status, prototypeFailed: false };
}
