import {
  activateClientWorkspace,
  appendPaymentEvent,
  appendProposalReviewEvent,
  createClientWorkspace,
  getClientWorkspaceBySession,
  getConfirmedPaymentEventBySessionId,
  getLatestProposalRequest,
  getPaymentEventByProviderEventId,
  getProposalRequest,
  getStudioSession,
  getStudioVersions,
  setClientWorkspaceNoonAppProjectId,
  updateProposalRequestStatus,
  updateStudioSessionStatus,
  type ClientWorkspace,
  type PaymentEvent,
  type ProposalRequest,
  type StudioSession,
} from "@/lib/maxwell/repositories";
import {
  sendPaymentReceivedEmail,
  sendWorkspaceReadyEmail,
} from "@/lib/maxwell/lifecycle-emails";
import { buildWorkspaceUrl } from "@/lib/maxwell/public-url";
import {
  NoonAppIntegrationError,
  buildWebsiteProposalPayload,
  extractNoonAppProjectId,
  sendPaymentConfirmedToNoonApp,
} from "@/lib/noon-app-integration";
import { log } from "@/lib/server/logger";
import { toStripeMinorUnit } from "@/lib/stripe/server";

const ACTIVATABLE_PROPOSAL_STATUSES = new Set([
  "sent",
  "payment_pending",
  "payment_under_verification",
  "paid",
]);

export class PaymentActivationError extends Error {
  constructor(
    message: string,
    public readonly status = 409,
    public readonly code = "PAYMENT_ACTIVATION_FAILED",
  ) {
    super(message);
    this.name = "PaymentActivationError";
  }
}

function assertProposalCanActivate(proposal: ProposalRequest) {
  if (!ACTIVATABLE_PROPOSAL_STATUSES.has(proposal.status)) {
    throw new PaymentActivationError(
      `Proposal status "${proposal.status}" cannot be activated by payment.`,
      409,
      "PROPOSAL_NOT_PAYABLE",
    );
  }
}

function assertSessionCanActivate(session: StudioSession, proposal: ProposalRequest) {
  if (session.status === "proposal_sent") return;
  if (session.status === "converted" && proposal.status === "paid") return;

  throw new PaymentActivationError(
    `Payment confirmation is not valid for session status "${session.status}".`,
    409,
    "SESSION_NOT_AWAITING_PAYMENT",
  );
}

function assertStripeApprovedAmount(proposal: ProposalRequest) {
  if (proposal.approvedAmountUsd == null || proposal.approvedAmountUsd <= 0) {
    throw new PaymentActivationError(
      "Stripe payment activation requires a persisted PM-approved amount.",
      409,
      "APPROVED_AMOUNT_REQUIRED",
    );
  }

  if (proposal.approvedCurrency?.toUpperCase() !== "USD") {
    throw new PaymentActivationError(
      "Stripe payment activation only supports USD in this launch.",
      409,
      "UNSUPPORTED_CURRENCY",
    );
  }
}

function assertApprovedAmountMatches(input: {
  expectedAmount: number;
  expectedCurrency: string;
  paidAmountMinor?: number | null;
  paidCurrency?: string | null;
}) {
  const expectedCurrency = input.expectedCurrency.toUpperCase();
  const paidCurrency = input.paidCurrency?.toUpperCase() ?? expectedCurrency;

  if (paidCurrency !== expectedCurrency) {
    throw new PaymentActivationError(
      `Paid currency ${paidCurrency} does not match approved currency ${expectedCurrency}.`,
      409,
      "PAYMENT_CURRENCY_MISMATCH",
    );
  }

  if (input.paidAmountMinor == null) return;

  const expectedMinor = toStripeMinorUnit(input.expectedAmount, expectedCurrency);
  if (input.paidAmountMinor !== expectedMinor) {
    throw new PaymentActivationError(
      "Paid amount does not match the approved proposal amount.",
      409,
      "PAYMENT_AMOUNT_MISMATCH",
    );
  }
}

async function activateWorkspaceForPayment(input: {
  session: StudioSession;
  proposal: ProposalRequest;
  summary?: string | null;
}) {
  let workspace = await getClientWorkspaceBySession(input.session.id);

  if (input.session.status !== "converted") {
    await updateStudioSessionStatus(input.session.id, "converted");
  }

  if (!workspace) {
    workspace = await createClientWorkspace({
      studioSessionId: input.session.id,
      paymentStatus: "confirmed",
    });
  }

  return activateClientWorkspace(
    workspace.id,
    input.summary ?? "Stripe payment confirmed. Project activated.",
  );
}

/**
 * B8 #2/#3 — fire the lifecycle emails (Payment received + Workspace
 * ready) after a fresh payment activation completes. Fire-and-forget:
 *
 *   - The `MAXWELL_LIFECYCLE_EMAILS` env gate (checked inside the
 *     senders) keeps both calls dormant in prod until ops verifies
 *     the Resend domain and flips the flag — wiring is safe to merge
 *     without breaking real client mailboxes.
 *   - Each send is wrapped in its own try/catch so a failure on B8 #2
 *     does NOT block B8 #3, and vice versa.
 *   - Errors are logged under `maxwell.lifecycle-email` and SWALLOWED.
 *     The payment activation flow (the DB writes, the Noon App
 *     handoff) has already succeeded by the time we get here; an
 *     email failure must not bubble back to the route handler and
 *     surface as a 5xx that confuses ops into thinking the payment
 *     didn't land.
 *   - `proposal.deliveryRecipient` is the recipient. When it's null
 *     (legacy proposals, or proposals where the operator chose a
 *     non-email delivery channel) we log a warn + skip — no email,
 *     no exception.
 *   - The workspace URL is built once; if base-URL resolution fails
 *     (env not configured in some non-Vercel runtime), B8 #2 still
 *     fires without the CTA and B8 #3 is skipped entirely (a
 *     "workspace ready" email without a link is useless).
 *
 * NOT called when `confirmProposalPayment` short-circuits on the
 * idempotency check (same provider_event_id processed before) — those
 * emails already went out on the original confirmation, re-sending
 * would be a Resend dedupe miss + a confusing inbox event.
 */
async function sendLifecycleEmailsForPayment(input: {
  session: StudioSession;
  proposal: ProposalRequest;
  workspace: ClientWorkspace;
  paymentEvent: PaymentEvent;
}): Promise<void> {
  // Defense-in-depth: wrap the ENTIRE helper in a try/catch so a
  // crash from anything (a malformed mock in a test, a future
  // refactor that introduces an undefined field, etc.) cannot
  // escape into the Node unhandled-rejection handler and surface as
  // a noisy CI failure. The contract is fire-and-forget; we log
  // whatever went wrong and return.
  try {
    const recipient = input.proposal?.deliveryRecipient;
    if (!recipient) {
      log.warn(
        "maxwell.lifecycle-email",
        "Skipped lifecycle emails: proposal has no delivery_recipient.",
        {
          proposal_id: input.proposal?.id ?? "(unknown)",
          session_id: input.session?.id ?? "(unknown)",
        },
      );
      return;
    }

    const projectTitle =
      input.session?.goalSummary?.trim() || "Your Noon project";

    // Build the workspace URL once. If base URL env is not resolvable,
    // both emails handle the absence: B8 #2 just omits the CTA, B8 #3
    // gets skipped entirely (the link IS the email).
    let workspaceUrl: string | null = null;
    try {
      workspaceUrl = buildWorkspaceUrl(input.session.id, {
        locale: input.session.language,
      });
    } catch (error) {
      log.warn(
        "maxwell.lifecycle-email",
        "Could not build workspace URL; B8 #2 will omit CTA, B8 #3 will be skipped.",
        {
          session_id: input.session?.id ?? "(unknown)",
          reason: error instanceof Error ? error.message : String(error),
        },
      );
    }

    // -----------------------------------------------------------------------
    // B8 #2 — Payment received
    // -----------------------------------------------------------------------
    try {
      const result = await sendPaymentReceivedEmail({
        paymentEventId: input.paymentEvent.id,
        to: recipient,
        projectTitle,
        // amountUsd may be null for legacy events; default to 0 keeps
        // the template valid (Intl renders "$0.00"). In practice
        // every post-B10 payment has the amount populated.
        amount: input.paymentEvent.amountUsd ?? 0,
        currency: input.paymentEvent.currency ?? "USD",
        paymentReference: input.paymentEvent.reference,
        workspaceUrl,
      });
      if (result.skipped) {
        log.info("maxwell.lifecycle-email", "B8 #2 payment-received skipped.", {
          reason: result.reason,
          proposal_id: input.proposal.id,
        });
      } else {
        log.info("maxwell.lifecycle-email", "B8 #2 payment-received sent.", {
          message_id: result.messageId,
          proposal_id: input.proposal.id,
        });
      }
    } catch (error) {
      log.error("maxwell.lifecycle-email", error, {
        stage: "payment_received",
        proposal_id: input.proposal.id,
      });
    }

    // -----------------------------------------------------------------------
    // B8 #3 — Workspace ready
    // -----------------------------------------------------------------------
    const workspaceId = input.workspace?.id;
    if (!workspaceUrl || !workspaceId) {
      log.warn(
        "maxwell.lifecycle-email",
        "Skipped B8 #3 workspace-ready: missing workspace URL or id.",
        {
          workspace_id: workspaceId ?? "(unknown)",
          has_url: workspaceUrl !== null,
        },
      );
      return;
    }

    try {
      const result = await sendWorkspaceReadyEmail({
        workspaceId,
        to: recipient,
        projectTitle,
        workspaceUrl,
      });
      if (result.skipped) {
        log.info("maxwell.lifecycle-email", "B8 #3 workspace-ready skipped.", {
          reason: result.reason,
          workspace_id: workspaceId,
        });
      } else {
        log.info("maxwell.lifecycle-email", "B8 #3 workspace-ready sent.", {
          message_id: result.messageId,
          workspace_id: workspaceId,
        });
      }
    } catch (error) {
      log.error("maxwell.lifecycle-email", error, {
        stage: "workspace_ready",
        workspace_id: workspaceId,
      });
    }
  } catch (error) {
    // Outer catch — unreachable in practice, but guarantees no
    // unhandled rejection ever escapes this helper.
    log.error("maxwell.lifecycle-email", error, {
      stage: "outer_guard",
    });
  }
}

async function notifyNoonApp(input: {
  session: StudioSession;
  proposal: ProposalRequest;
  workspaceId: string;
  paymentReference?: string | null;
  summary?: string | null;
}) {
  const versions = await getStudioVersions(input.session.id);

  try {
    const response = await sendPaymentConfirmedToNoonApp({
      session: input.session,
      proposal: input.proposal,
      versions,
      paymentReference: input.paymentReference,
      summary: input.summary,
    });

    await appendProposalReviewEvent({
      proposalRequestId: input.proposal.id,
      action: "noon_app_payment_sent",
      actor: "website",
      notes: "Payment confirmation sent to Noon App.",
    });

    // PR-B: App returns its internal project id in the payment-confirmed
    // response. Persist it on the workspace so the client-status page can map
    // inbound AI MVP milestones (keyed by that project id) back to this client.
    // Best-effort and isolated: a parse miss or write failure must NOT fail the
    // payment handoff (the notification + audit already succeeded), so it lives
    // in its own try/catch and only logs on failure. setClient...ProjectId is
    // write-once, so a webhook retry never clobbers an existing mapping.
    const noonAppProjectId = extractNoonAppProjectId(response);
    if (noonAppProjectId) {
      try {
        await setClientWorkspaceNoonAppProjectId(input.workspaceId, noonAppProjectId);
      } catch (error) {
        log.error("maxwell.noon-app-project-id-capture", error, {
          workspace_id: input.workspaceId,
          proposal_id: input.proposal.id,
        });
      }
    }
  } catch (error) {
    await appendProposalReviewEvent({
      proposalRequestId: input.proposal.id,
      action: "noon_app_payment_failed",
      actor: "website",
      notes: error instanceof Error ? error.message : "Unknown Noon App payment handoff error.",
    });
    throw error;
  }
}

/**
 * Re-load the {proposal, session, workspace} triple for an already-processed
 * payment so an idempotent confirmation can return the same shape as a fresh one
 * without redoing any writes (or re-notifying the App / re-sending emails).
 */
async function loadIdempotentActivationState(
  proposalRequestId: string,
  existingEvent: PaymentEvent,
): Promise<{
  proposal: ProposalRequest;
  session: StudioSession;
  workspace: ClientWorkspace;
  paymentEvent: PaymentEvent;
  idempotent: true;
}> {
  const proposal = await getProposalRequest(proposalRequestId);
  if (!proposal) {
    throw new PaymentActivationError("Proposal request not found.", 404, "PROPOSAL_NOT_FOUND");
  }
  const session = await getStudioSession(proposal.studioSessionId);
  const workspace = session ? await getClientWorkspaceBySession(session.id) : null;
  if (!session || !workspace) {
    throw new PaymentActivationError("Existing payment event has incomplete activation state.", 409);
  }
  return { proposal, session, workspace, paymentEvent: existingEvent, idempotent: true };
}

export async function confirmProposalPayment(input: {
  proposalRequestId: string;
  actor: string;
  paymentReference?: string | null;
  summary?: string | null;
  provider?: string | null;
  providerEventId?: string | null;
  providerSessionId?: string | null;
  providerPaymentIntentId?: string | null;
  paidAmountMinor?: number | null;
  paidCurrency?: string | null;
  paidAt?: string | null;
  providerPayload?: Record<string, unknown> | null;
}): Promise<{
  proposal: ProposalRequest;
  session: StudioSession;
  workspace: ClientWorkspace;
  paymentEvent: PaymentEvent;
  idempotent: boolean;
}> {
  // Idempotency #1 — the Stripe EVENT id. Guards against Stripe re-delivering the
  // same webhook event (retries carry a stable event.id).
  if (input.providerEventId) {
    const existingEvent = await getPaymentEventByProviderEventId(input.providerEventId);
    if (existingEvent) {
      return loadIdempotentActivationState(input.proposalRequestId, existingEvent);
    }
  }

  // Idempotency #2 — the Stripe checkout SESSION id. The webhook and the client's
  // return from Checkout race for the same session; whichever confirms first writes
  // the `confirmed` payment_event, and the other short-circuits here on the shared
  // session id (the natural key both paths hold, even though they carry different
  // provider_event_ids). This keeps activation, the App handoff, and the lifecycle
  // emails each firing exactly once regardless of who wins the race.
  if (input.providerSessionId) {
    const existingBySession = await getConfirmedPaymentEventBySessionId(input.providerSessionId);
    if (existingBySession) {
      return loadIdempotentActivationState(input.proposalRequestId, existingBySession);
    }
  }

  let proposal = await getProposalRequest(input.proposalRequestId);
  if (!proposal) {
    throw new PaymentActivationError("Proposal request not found.", 404, "PROPOSAL_NOT_FOUND");
  }

  const session = await getStudioSession(proposal.studioSessionId);
  if (!session) {
    throw new PaymentActivationError("Associated session not found.", 404, "SESSION_NOT_FOUND");
  }

  assertProposalCanActivate(proposal);
  assertSessionCanActivate(session, proposal);
  if (input.provider === "stripe") {
    assertStripeApprovedAmount(proposal);
  }

  const payload = buildWebsiteProposalPayload({ session, proposal, versions: [] });
  assertApprovedAmountMatches({
    expectedAmount: payload.proposal.amount,
    expectedCurrency: payload.proposal.currency,
    paidAmountMinor: input.paidAmountMinor,
    paidCurrency: input.paidCurrency,
  });

  const paidAt = input.paidAt ?? new Date().toISOString();
  const stripeCheckoutSessionId =
    input.providerSessionId && input.provider === "stripe" ? input.providerSessionId : proposal.stripeCheckoutSessionId;
  const stripePaymentIntentId =
    input.providerPaymentIntentId && input.provider === "stripe"
      ? input.providerPaymentIntentId
      : proposal.stripePaymentIntentId;

  if (proposal.status !== "paid" || stripeCheckoutSessionId || stripePaymentIntentId) {
    proposal = await updateProposalRequestStatus(proposal.id, "paid", {
      reviewerId: input.actor,
      stripeCheckoutSessionId,
      stripePaymentIntentId,
      stripePaidAt: paidAt,
    });
  }

  const workspace = await activateWorkspaceForPayment({
    session,
    proposal,
    summary: input.summary ?? `Payment confirmed. Reference: ${input.paymentReference ?? "N/A"}`,
  });

  // B10 atomicity contract:
  // Persist payment_event BEFORE the outbound Noon App notification. If the HTTP call
  // fails, the unique constraint on payment_event.provider_event_id (migration
  // 20260511_012) lets the next retry's idempotency check (lines 190-204) detect the
  // existing event and short-circuit cleanly — instead of redoing every DB write while
  // never being able to mark the event as processed. The previous order had the inverse
  // problem: notifyNoonApp failure stranded the proposal in `paid` state without any
  // payment_event row, so the next retry re-entered the full pipeline and reissued the
  // webhook every time.
  //
  // The outbound retry/backoff itself is Bloque 5 (B9) — until then, a failed notify is
  // recorded in audit (appendProposalReviewEvent `noon_app_payment_failed`) and surfaced
  // to ops via the structured logger.
  const paymentEvent = await appendPaymentEvent({
    studioSessionId: session.id,
    eventType: "confirmed",
    amountUsd: payload.proposal.amount,
    reference: input.paymentReference ?? input.providerPaymentIntentId ?? input.providerSessionId ?? undefined,
    notes: input.summary ?? "Payment confirmed.",
    provider: input.provider ?? undefined,
    providerEventId: input.providerEventId ?? undefined,
    providerSessionId: input.providerSessionId ?? undefined,
    providerPaymentIntentId: input.providerPaymentIntentId ?? undefined,
    currency: payload.proposal.currency,
    payloadJson: input.providerPayload ?? null,
    createdBy: input.actor,
  });

  await notifyNoonApp({
    session,
    proposal,
    workspaceId: workspace.id,
    paymentReference: input.paymentReference ?? input.providerPaymentIntentId ?? input.providerSessionId,
    summary: input.summary,
  });

  // B8 #2/#3 fire-and-forget. Gated by `MAXWELL_LIFECYCLE_EMAILS` —
  // skipped (no Resend call) when the env var is not "1". Errors are
  // logged + swallowed inside the helper so a Resend outage cannot
  // bubble back and fail the activation flow. `void` is intentional:
  // we do NOT await — the route response should return as soon as the
  // DB writes + App handoff complete; the inbox notification is a
  // side-effect, not part of the contract.
  void sendLifecycleEmailsForPayment({ session, proposal, workspace, paymentEvent });

  return { proposal, session, workspace, paymentEvent, idempotent: false };
}

export async function confirmSessionPayment(input: {
  sessionId: string;
  actor: string;
  paymentReference?: string | null;
  summary?: string | null;
}) {
  const proposal = await getLatestProposalRequest(input.sessionId);
  if (!proposal) {
    throw new PaymentActivationError(
      "A proposal is required before payment can activate a project.",
      409,
      "PROPOSAL_REQUIRED",
    );
  }

  return confirmProposalPayment({
    proposalRequestId: proposal.id,
    actor: input.actor,
    paymentReference: input.paymentReference,
    summary: input.summary,
    provider: "website",
  });
}

export function paymentActivationHttpStatus(error: unknown) {
  if (error instanceof PaymentActivationError) return error.status;
  if (error instanceof NoonAppIntegrationError) return error.status;
  return 500;
}
