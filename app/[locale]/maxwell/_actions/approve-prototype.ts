/**
 * app/[locale]/maxwell/_actions/approve-prototype.ts
 *
 * Server Action behind the studio's "Approve prototype" CTA. Completes the
 * design already documented in lib/maxwell/studio-guards.ts, where
 * `approved_for_proposal` is described as "normal path (client approved
 * explicitly)": the button used to be client-side only — the approval was
 * lost on reload and never recorded — while the backend expected the status
 * to be written. Persisting it here means:
 *
 *   - the approval survives reloads (rehydrate passes `approved_for_proposal`
 *     through unchanged and the CTA already renders the approved panel),
 *   - a record exists of the client having approved (status + updated_at),
 *   - further adjustments are locked (no approved → revision transition),
 *   - requesting the proposal stays a SEPARATE step — the Noon-App handoff
 *     still fires there, unchanged (owner decision 2026-07-14). The proposal
 *     route simply skips its ready/shared → approved bridge when the status
 *     is already `approved_for_proposal` (legal transition, same guard).
 */

"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import { log } from "@/lib/server/logger";
import {
  getStudioSession,
  updateStudioSessionStatus,
} from "@/lib/maxwell/repositories";

export type ApprovePrototypeActionInput = {
  sessionId: string;
};

export type ApprovePrototypeActionResult =
  | { ok: true }
  | {
      ok: false;
      code: "UNAUTHENTICATED" | "NOT_FOUND" | "ILLEGAL_STATE" | "UNKNOWN";
    };

export async function approvePrototypeAction(
  input: ApprovePrototypeActionInput,
): Promise<ApprovePrototypeActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return { ok: false, code: "UNAUTHENTICATED" };
  }

  let session;
  try {
    session = await getStudioSession(input.sessionId);
  } catch (error) {
    log.error("studio.approve.load_failed", "Could not load the session.", {
      session_id: input.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, code: "UNKNOWN" };
  }

  // One NOT_FOUND for both missing and non-owned — don't leak existence.
  if (!session || !viewerOwnsStudioSession(viewer, session)) {
    log.warn("studio.approve.not_found", "Session missing or not owned.", {
      session_id: input.sessionId,
      viewer: viewer.email,
    });
    return { ok: false, code: "NOT_FOUND" };
  }

  const approvableFrom =
    session.status === "prototype_ready" ||
    // Legacy rows persisted before share became an attribute.
    session.status === "prototype_shared" ||
    // Idempotent re-click / double-fire: already approved is a success no-op
    // (updateStudioSessionStatus skips transition validation when unchanged).
    session.status === "approved_for_proposal";

  if (!approvableFrom) {
    log.warn(
      "studio.approve.illegal_state",
      "approvePrototypeAction called from a non-approvable state.",
      { session_id: input.sessionId, status: session.status },
    );
    return { ok: false, code: "ILLEGAL_STATE" };
  }

  try {
    await updateStudioSessionStatus(session.id, "approved_for_proposal");
  } catch (error) {
    log.error("studio.approve.persist_failed", "Status write failed.", {
      session_id: input.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, code: "UNKNOWN" };
  }

  log.info("studio.approve.persisted", "Prototype approved by the client.", {
    session_id: input.sessionId,
    from_status: session.status,
  });

  // Locale-agnostic revalidation, same as the share action.
  revalidatePath("/[locale]/maxwell", "page");

  return { ok: true };
}
