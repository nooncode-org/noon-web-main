/**
 * app/[locale]/maxwell/workspace/[sessionId]/_actions/open-billing-portal.ts
 *
 * Server Action — opens a Stripe Billing Portal session so a membership client
 * can self-manage / cancel their subscription (v3 membership billing M2 /
 * Fase 6b). Architecture: docs/2026-06-22-v3-membership-m2-architecture.md.
 *
 * M2 adds NO lifecycle logic: a cancel/update inside the portal fires
 * `customer.subscription.updated|deleted`, which the M1 webhook already forwards
 * as `membership-lifecycle` to the App (SoT). This action just opens the door.
 *
 * Auth mirrors submit-version-action.ts: re-derive the viewer from the server
 * session (NEVER trust the client) + re-check ownership of the studio session.
 * Gated by `MEMBERSHIP_BILLING_ENABLED` (kill-switch) and by the presence of a
 * persisted `stripe_customer_id` (only set when a membership subscription exists).
 */

"use server";

import { auth } from "@/auth";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import { MEMBERSHIP_BILLING_ENABLED } from "@/lib/maxwell/membership-billing";
import { buildWorkspaceUrl } from "@/lib/maxwell/public-url";
import { getLatestProposalRequest, getStudioSession } from "@/lib/maxwell/repositories";
import { enforceRateLimit, RateLimitExceededError } from "@/lib/server/rate-limit";
import { log } from "@/lib/server/logger";
import { StripeConfigError, getStripeClient } from "@/lib/stripe/server";

export type OpenBillingPortalInput = {
  sessionId: string;
};

export type OpenBillingPortalResult =
  | { ok: true; url: string }
  | {
      ok: false;
      error: string;
      code: "UNAUTHENTICATED" | "NOT_FOUND" | "NOT_AVAILABLE" | "RATE_LIMITED" | "PORTAL_FAILED";
    };

export async function openBillingPortal(
  input: OpenBillingPortalInput,
): Promise<OpenBillingPortalResult> {
  const sessionData = await auth();
  const viewerEmail = sessionData?.user?.email?.trim().toLowerCase();
  if (!viewerEmail) {
    return { ok: false, error: "Please sign in to manage your membership.", code: "UNAUTHENTICATED" };
  }

  // Kill-switch: when membership billing is off, there is nothing to manage.
  if (!MEMBERSHIP_BILLING_ENABLED) {
    return {
      ok: false,
      error: "Membership management isn't available right now.",
      code: "NOT_AVAILABLE",
    };
  }

  // Per-client rate-limit — opening a portal is a deliberate, infrequent action.
  try {
    enforceRateLimit({
      namespace: "maxwell.billing-portal",
      capacity: 5,
      refillPerSec: 0.1,
      identityKey: viewerEmail,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return {
        ok: false,
        error: "You're doing that too quickly. Please wait a moment and try again.",
        code: "RATE_LIMITED",
      };
    }
    throw error;
  }

  const session = await getStudioSession(input.sessionId);
  if (!session || !viewerOwnsStudioSession({ email: viewerEmail }, session)) {
    return { ok: false, error: "We couldn't find that project.", code: "NOT_FOUND" };
  }

  // The Stripe customer id is persisted at membership activation (M1). Its
  // absence means there is no subscription to manage (one-time / not activated).
  const proposal = await getLatestProposalRequest(input.sessionId);
  const customerId = proposal?.stripeCustomerId ?? null;
  if (!customerId) {
    return {
      ok: false,
      error: "You don't have an active membership to manage.",
      code: "NOT_AVAILABLE",
    };
  }

  try {
    const returnUrl = buildWorkspaceUrl(session.id, { locale: session.language });
    // No `configuration` id — Stripe uses the dashboard default portal config
    // (ADR-M2-2). The operator must activate the Customer portal in Stripe; if
    // not, this throws and we degrade cleanly to PORTAL_FAILED.
    const portalSession = await getStripeClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    log.info("maxwell.billing-portal", "Opened Stripe Billing Portal session.", {
      session_id: session.id,
      proposal_id: proposal?.id,
    });

    return { ok: true, url: portalSession.url };
  } catch (error) {
    if (error instanceof StripeConfigError) {
      log.error("maxwell.billing-portal", error, { session_id: session.id, stage: "config" });
    } else {
      log.error("maxwell.billing-portal", error, { session_id: session.id, stage: "create" });
    }
    return {
      ok: false,
      error: "We couldn't open the membership portal right now. Please try again in a moment.",
      code: "PORTAL_FAILED",
    };
  }
}
