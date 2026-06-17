/**
 * lib/maxwell/preview-load-state.ts
 *
 * Pure policy + UI-state helpers for the Maxwell prototype preview iframe
 * (`components/maxwell/studio-preview-pane.tsx`).
 *
 * **Why this exists.** v0's preview URLs (vusercontent.net) are frequently
 * "cold" right after generation — the deployment is still warming up, so the
 * URL can serve a blank/holding page or be slow to respond. The iframe used to
 * mount the URL once with NO load handling and NO recovery, so a cold first
 * load left the client staring at a permanent blank screen (the only escape was
 * the "open in new tab" link, which is a fresh — warm — load).
 *
 * Two recovery mechanisms sit on top of these helpers:
 *   1. **Bounded auto-reload** — if `onLoad` has not fired within
 *      {@link PREVIEW_LOAD_TIMEOUT_MS}, the iframe is remounted (fresh fetch)
 *      up to {@link MAX_PREVIEW_AUTO_RELOADS} times. Catches the "never loads"
 *      case automatically.
 *   2. **Manual reload button** — always available in the toolbar. This is the
 *      ONLY recovery for a blank-but-`onLoad`-fired preview: the iframe is
 *      cross-origin + sandboxed, so the parent CANNOT read its document to
 *      detect blank content (a `SecurityError`). `onLoad` fires even for a cold
 *      blank page, so blank-detection is impossible from the parent — the user
 *      clicks reload and gets a fresh load against the now-warm URL.
 *
 * Pure module: no I/O, no env, no React/Next imports — testable in node env,
 * mirrors the shape of `lib/maxwell/polling-progress.ts`.
 */

/** Per-attempt watchdog: if `onLoad` has not fired by this, act (auto-reload or surface the slow hint). */
export const PREVIEW_LOAD_TIMEOUT_MS = 9_000;

/** Hard cap on silent auto-reloads before we stop and surface a manual-reload affordance. */
export const MAX_PREVIEW_AUTO_RELOADS = 2;

export type PreviewLoadStatus = "loading" | "loaded" | "error";

/**
 * What the overlay over the iframe should show. `hidden` once the preview has
 * loaded — note this cannot distinguish a real load from a cold/blank one
 * (cross-origin), which is why the toolbar reload button is always available.
 */
export type PreviewOverlayState = "hidden" | "loading" | "slow" | "error";

export function derivePreviewOverlay(
  status: PreviewLoadStatus,
  slowHintShown: boolean,
): PreviewOverlayState {
  if (status === "loaded") return "hidden";
  if (status === "error") return "error";
  return slowHintShown ? "slow" : "loading";
}

/**
 * When the per-attempt watchdog fires and the preview is still loading, should
 * we auto-reload (true) or stop and show the manual-reload hint (false)? Manual
 * reloads do NOT consume this budget — only the silent auto-reloads do.
 */
export function shouldAutoReloadPreview(autoReloadsUsed: number): boolean {
  return autoReloadsUsed < MAX_PREVIEW_AUTO_RELOADS;
}
