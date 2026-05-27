/**
 * app/[locale]/maxwell/studio/_actions/share-prototype.ts
 *
 * Server Action invoked by the studio CTA when the seller clicks
 * "Compartir prototipo con el cliente". Wraps the outbound helper
 * (`requestPrototipoShare`) per ADR-028 D9:
 *
 *   1. Auth: only signed-in viewers can share, and they must own the session.
 *   2. Pull the latest prototype version (v0 chat + URL + version_number)
 *      from the studio_session DB row.
 *   3. Build the lead context from the session (business_name = goalSummary
 *      or initialPrompt slice; project_type_label = PROJECT_CATEGORIES
 *      lookup; customer fields nulled since the studio doesn't capture
 *      them at share time per ADR-028 D2 rationale).
 *   4. Call `requestPrototipoShare` to POST to App.
 *   5. On `ok`: persist the four share columns on `studio_session`,
 *      transition `prototype_ready → prototype_shared` (or stay on
 *      `prototype_shared` for a regenerate re-share), revalidate the
 *      studio page, return `{ uxState: { kind: 'success', shareUrl, ... } }`.
 *   6. On `error`: log structured event with App's `requestId` (if any),
 *      return the mapped UX state.
 *
 * URL composition: `<base>/<locale>/maxwell/prototipo/<token>` where
 * `<base>` comes from the existing `resolvePublicBaseUrl()` helper
 * (Q-pedro-6 resolution — no new env var; reuses the chain
 * MAXWELL_PUBLIC_BASE_URL → NEXT_PUBLIC_SITE_URL → VERCEL_PROJECT_PRODUCTION_URL
 * → VERCEL_URL → request origin).
 *
 * Out of scope per ADR-028 D7:
 *  - Web does NOT auto-transition `prototype_shared → converted` on a
 *    perceived client accept (no Web↔App callback contract exists).
 *  - No background revalidation of stale tokens — surfaces "you'll find
 *    out when you try to use it" UX per D16 allowed shortcuts.
 */

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import { log } from "@/lib/server/logger";
import {
  getStudioSession,
  getLatestStudioVersion,
  updateStudioSessionShareToken,
  updateStudioSessionStatus,
} from "@/lib/maxwell/repositories";
import { requestPrototipoShare } from "@/lib/maxwell/prototipo-share";
import {
  mapShareResultToUxState,
  type PrototipoShareUxState,
} from "@/lib/maxwell/prototipo-share-types";
import { isPrototipoDecisionRouteEnabled } from "@/lib/maxwell/prototipo-route-flag";
import { resolvePublicBaseUrl } from "@/lib/maxwell/public-url";
import { PROJECT_CATEGORIES } from "@/lib/maxwell/proposal-rules";
import { buildShareLeadMetadata } from "@/lib/maxwell/share-lead-metadata";

export type SharePrototypeActionInput = {
  sessionId: string;
  /** Studio locale from the client (`useParams().locale`). Used only for URL composition. */
  locale: string;
};

export type SharePrototypeActionResult = {
  uxState: PrototipoShareUxState;
};

const SHARE_TOKEN_URL_FALLBACK_LOCALE = "en";

function deriveBusinessName(session: {
  goalSummary: string | null;
  initialPrompt: string;
}): string {
  const goal = session.goalSummary?.trim();
  if (goal) return goal;
  return session.initialPrompt.trim().slice(0, 90);
}

function deriveProjectTypeLabel(projectType: string | null): string {
  if (!projectType) return "General";
  const lookup = (PROJECT_CATEGORIES as Record<string, string>)[projectType];
  return lookup ?? projectType;
}

/**
 * Synthesise a Request from headers so `resolvePublicBaseUrl` can fall back
 * to the request origin when no env var is set (mainly local dev). In
 * Production / Preview the env chain wins before this is consulted.
 */
async function buildFakeRequestFromHeaders(): Promise<Request | undefined> {
  const h = await headers();
  const host = h.get("host");
  if (!host) return undefined;
  const proto = h.get("x-forwarded-proto") ?? "https";
  try {
    return new Request(`${proto}://${host}/`);
  } catch {
    return undefined;
  }
}

function composeShareUrl(baseUrl: string, locale: string, token: string): string {
  const safeLocale = locale.trim() || SHARE_TOKEN_URL_FALLBACK_LOCALE;
  return new URL(`/${safeLocale}/maxwell/prototipo/${token}`, baseUrl).toString();
}

export async function sharePrototypeAction(
  input: SharePrototypeActionInput,
): Promise<SharePrototypeActionResult> {
  // Defence-in-depth: the studio surface is itself flag-gated client-side, but
  // a stale tab or a direct invocation must not silently fire to App when the
  // ops switch is off. Return a benign fatal so the UI reverts to "talk to
  // agent" without exposing internals.
  if (!isPrototipoDecisionRouteEnabled()) {
    log.warn(
      "studio.share.flag_disabled",
      "sharePrototypeAction invoked but MAXWELL_PROTOTIPO_DECISION_ROUTE is off.",
      { session_id: input.sessionId },
    );
    return { uxState: { kind: "fatal.unknown", httpStatus: 503 } };
  }

  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    log.warn("studio.share.unauthenticated", "sharePrototypeAction with no viewer.", {
      session_id: input.sessionId,
    });
    return { uxState: { kind: "fatal.unknown", httpStatus: 401 } };
  }

  const session = await getStudioSession(input.sessionId);
  if (!session) {
    log.warn("studio.share.session_not_found", "sharePrototypeAction with missing session.", {
      session_id: input.sessionId,
    });
    return { uxState: { kind: "fatal.unknown", httpStatus: 404 } };
  }
  if (!viewerOwnsStudioSession(viewer, session)) {
    log.warn(
      "studio.share.forbidden",
      "sharePrototypeAction called by non-owner.",
      { session_id: input.sessionId, viewer: viewer.email },
    );
    return { uxState: { kind: "fatal.unknown", httpStatus: 403 } };
  }

  if (session.status !== "prototype_ready" && session.status !== "prototype_shared") {
    // The CTA is only surfaced in those states (D10), but a stale client
    // could call from another state. Treat as terminal — the seller has
    // already moved past the share point.
    log.warn(
      "studio.share.illegal_state",
      "sharePrototypeAction called from a non-shareable state.",
      { session_id: input.sessionId, status: session.status },
    );
    return { uxState: { kind: "terminal.workspace-locked" } };
  }

  const latest = await getLatestStudioVersion(session.id);
  if (!latest) {
    log.warn(
      "studio.share.no_version",
      "sharePrototypeAction with no prototype version on the session.",
      { session_id: input.sessionId },
    );
    return { uxState: { kind: "terminal.workspace-locked" } };
  }

  const result = await requestPrototipoShare({
    externalSessionId: session.id,
    lead: {
      businessName: deriveBusinessName(session),
      projectTypeLabel: deriveProjectTypeLabel(session.projectType),
      // Customer details are intentionally omitted at share time — App
      // reconciles via `website_inbound_links` lookup per Piedra Q-piedra-3.
    },
    prototype: {
      v0ChatId: latest.v0ChatId,
      versionNumber: latest.versionNumber,
      deployedUrl: latest.previewUrl,
      generatedAt: latest.createdAt,
    },
    // Lead enrichment metadata for parity with the legacy `inbound-proposal`
    // flow. App's `insertFreshLeadForShare` reads `metadata.score` (via
    // `readInboundScore`, default 80) and `metadata.amount` to populate
    // `leads.score` / `leads.value`. Without this, fresh prospect leads
    // from share land in App with score=0 / value=0 — asymmetric vs the
    // legacy proposal-send flow. See ADR-028 follow-up handoff doc.
    metadata: buildShareLeadMetadata(session),
  });

  if (result.status !== "ok") {
    log.warn(
      "studio.share.error",
      "Outbound prototype-share returned non-ok.",
      {
        session_id: input.sessionId,
        code: result.code,
        http_status: result.httpStatus,
        request_id: result.requestId ?? null,
      },
    );
    return { uxState: mapShareResultToUxState(result, "") };
  }

  const fakeRequest = await buildFakeRequestFromHeaders();
  const baseUrl = resolvePublicBaseUrl(fakeRequest);
  if (!baseUrl) {
    // Env misconfiguration. The share did succeed App-side, but we cannot
    // hand a URL back to the seller. Persist the token anyway so the next
    // visit (with env fixed) can recompose the URL.
    log.error(
      "studio.share.base_url_missing",
      "App returned share_token but Web has no base URL to compose the share URL.",
      { session_id: input.sessionId, request_id: result.requestId ?? null },
    );
  }
  const shareUrl = baseUrl
    ? composeShareUrl(baseUrl, input.locale, result.data.share_token)
    : "";

  await updateStudioSessionShareToken(session.id, {
    prototypeWorkspaceId: result.data.prototype_workspace_id,
    shareToken: result.data.share_token,
    shareTokenUrl: shareUrl,
    prototypeSharedAt: result.data.issued_at,
  });

  // State machine transition — only when leaving `prototype_ready`. On a
  // regenerate re-share from `prototype_shared` the status stays put.
  if (session.status === "prototype_ready") {
    await updateStudioSessionStatus(session.id, "prototype_shared");
  }

  if (!result.isReplay) {
    log.info(
      "studio.share.emitted",
      "Prototype share token emitted by App.",
      {
        session_id: input.sessionId,
        prototype_workspace_id: result.data.prototype_workspace_id,
        lead_id: result.data.lead_id,
        version_number: result.data.version_number,
        superseded_count: result.data.superseded_workspace_ids.length,
        request_id: result.requestId ?? null,
      },
    );
  }

  // Locale-agnostic revalidation — the studio path is locale-prefixed but
  // both the seller and the client may reload concurrently.
  revalidatePath("/[locale]/maxwell/studio", "page");

  return { uxState: mapShareResultToUxState(result, shareUrl) };
}
