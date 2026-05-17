import {
  activateClientWorkspace,
  appendPaymentEvent,
  appendProposalReviewEvent,
  createClientWorkspace,
  getClientWorkspaceBySession,
  getLatestProposalRequest,
  getPaymentEventByProviderEventId,
  getProposalRequest,
  getStudioSession,
  getStudioVersions,
  updateProposalRequestStatus,
  updateStudioSessionStatus,
  type ClientWorkspace,
  type PaymentEvent,
  type ProposalRequest,
  type StudioSession,
} from "@/lib/maxwell/repositories";
import {
  NoonAppIntegrationError,
  buildWebsiteProposalPayload,
  sendPaymentConfirmedToNoonApp,
} from "@/lib/noon-app-integration";
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

async function notifyNoonApp(input: {
  session: StudioSession;
  proposal: ProposalRequest;
  paymentReference?: string | null;
  summary?: string | null;
}) {
  const versions = await getStudioVersions(input.session.id);

  try {
    await sendPaymentConfirmedToNoonApp({
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
  if (input.providerEventId) {
    const existingEvent = await getPaymentEventByProviderEventId(input.providerEventId);
    if (existingEvent) {
      const proposal = await getProposalRequest(input.proposalRequestId);
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
    paymentReference: input.paymentReference ?? input.providerPaymentIntentId ?? input.providerSessionId,
    summary: input.summary,
  });

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
