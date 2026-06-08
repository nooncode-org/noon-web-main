import { NextResponse } from "next/server";
import {
  appendProposalReviewEvent,
  getProposalRequest,
  getStudioSession,
  updateProposalDraftContent,
  updateProposalRequestStatus,
  updateStudioSessionStatus,
} from "@/lib/maxwell/repositories";
import {
  ProposalEmailConfigurationError,
  ProposalEmailSendError,
  sendProposalEmail,
  sendProposalRejectedEmail,
} from "@/lib/maxwell/proposal-email";
import { buildPublicProposalUrl } from "@/lib/maxwell/public-url";
import { log } from "@/lib/server/logger";
import {
  NoonAppIntegrationError,
  noonAppProposalReviewDecisionPayloadSchema,
  readSignedNoonAppJson,
} from "@/lib/noon-app-integration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const publicProposalStatuses = new Set([
  "sent",
  "payment_pending",
  "payment_under_verification",
  "paid",
  "expired",
]);

async function updateSessionStatusIfNeeded(
  sessionId: string,
  currentStatus: string,
  nextStatus: "approved_for_proposal" | "proposal_sent",
) {
  if (currentStatus === nextStatus) return;

  if (currentStatus === "proposal_pending_review") {
    await updateStudioSessionStatus(sessionId, nextStatus);
    return;
  }

  throw new NoonAppIntegrationError(
    `Cannot apply Noon App review decision from session status "${currentStatus}".`,
    409,
  );
}

export async function POST(request: Request) {
  try {
    const payload = await readSignedNoonAppJson(request, noonAppProposalReviewDecisionPayloadSchema);

    if (payload.external_source !== "noon_website") {
      return NextResponse.json({ message: "Unsupported external source." }, { status: 400 });
    }

    const proposal = await getProposalRequest(payload.external_proposal_id);
    if (!proposal) {
      return NextResponse.json({ message: "Proposal request not found." }, { status: 404 });
    }

    if (proposal.studioSessionId !== payload.external_session_id) {
      return NextResponse.json({ message: "Proposal does not belong to session." }, { status: 409 });
    }

    const session = await getStudioSession(proposal.studioSessionId);
    if (!session) {
      return NextResponse.json({ message: "Associated session not found." }, { status: 404 });
    }

    if (payload.decision === "approved") {
      const publicUrl = buildPublicProposalUrl(proposal.publicToken, request);
      const approvedAmount = payload.proposal.amount;
      const approvedCurrency = payload.proposal.currency.toUpperCase();

      if (!Number.isFinite(approvedAmount) || approvedAmount <= 0 || approvedCurrency !== "USD") {
        return NextResponse.json(
          { message: "Approved proposals require a positive USD amount for this launch." },
          { status: 422 },
        );
      }

      if (publicProposalStatuses.has(proposal.status)) {
        if (
          proposal.approvedAmountUsd == null &&
          proposal.status !== "paid" &&
          proposal.status !== "expired"
        ) {
          await updateProposalRequestStatus(proposal.id, proposal.status, {
            approvedAmountUsd: approvedAmount,
            approvedCurrency,
          });
        }

        return NextResponse.json({
          message: "Proposal decision already applied.",
          decision: payload.decision,
          proposal_status: proposal.status,
          public_url: publicUrl,
        });
      }

      if (proposal.draftContent !== payload.proposal.body) {
        await updateProposalDraftContent(proposal.id, payload.proposal.body);
      }

      const sentAt = new Date().toISOString();
      const updated = await updateProposalRequestStatus(proposal.id, "sent", {
        reviewerId: "noon-app",
        sentAt,
        deliveryStatus: "sent",
        deliveryRecipient: proposal.deliveryRecipient ?? session.ownerEmail,
        caseClassification: proposal.caseClassification,
        approvedAmountUsd: approvedAmount,
        approvedCurrency,
      });

      await updateSessionStatusIfNeeded(session.id, session.status, "proposal_sent");

      await appendProposalReviewEvent({
        proposalRequestId: proposal.id,
        action: "noon_app_approved",
        actor: "noon-app",
        notes: `Approved in Noon App. Public URL enabled: ${publicUrl}`,
      });

      // Send the proposal email to the client. Pattern mirrors
      // lib/maxwell/proposal-review-sla.ts:124-153 — log delivery success/failure
      // via appendProposalReviewEvent and never let an email error bubble up
      // and roll back the approval (the proposal is already approved at this
      // point; failed email is a notification debt, not an approval failure).
      const recipient = updated.deliveryRecipient ?? session.ownerEmail;
      if (recipient) {
        try {
          const emailResult = await sendProposalEmail({
            proposalId: proposal.id,
            versionNumber: updated.versionNumber,
            to: recipient,
            publicUrl,
            projectTitle:
              session.goalSummary ??
              session.initialPrompt ??
              `Proposal ${proposal.id}`,
            // Surface the headline activation amount in the email body. Both
            // values were validated as a positive USD amount earlier in this
            // handler before reaching the `sent` transition.
            approvedAmountUsd: approvedAmount,
            approvedCurrency,
          });

          await appendProposalReviewEvent({
            proposalRequestId: proposal.id,
            action: "sent",
            actor: "noon-app",
            notes: `Email delivered to ${recipient} via ${emailResult.provider} (${emailResult.messageId}).`,
          });
        } catch (error) {
          await appendProposalReviewEvent({
            proposalRequestId: proposal.id,
            action: "delivery_failed",
            actor: "noon-app",
            notes:
              error instanceof ProposalEmailConfigurationError ||
              error instanceof ProposalEmailSendError
                ? error.message
                : "Proposal email send failed after Noon App approval.",
          });
          log.error("integrations.noon-app.proposal-review-decision", error, {
            phase: "proposal_email_send",
            proposalId: proposal.id,
          });
        }
      } else {
        await appendProposalReviewEvent({
          proposalRequestId: proposal.id,
          action: "delivery_failed",
          actor: "noon-app",
          notes:
            "Proposal email skipped: no delivery recipient resolved (deliveryRecipient and ownerEmail both empty).",
        });
      }

      return NextResponse.json({
        message: "Proposal approved by Noon App and published on website.",
        decision: payload.decision,
        proposal_request: updated,
        session_status: "proposal_sent",
        public_url: publicUrl,
      });
    }

    if (payload.decision === "changes_requested") {
      if (proposal.status === "returned") {
        return NextResponse.json({
          message: "Proposal decision already applied.",
          decision: payload.decision,
          proposal_status: proposal.status,
        });
      }

      if (proposal.draftContent !== payload.proposal.body) {
        await updateProposalDraftContent(proposal.id, payload.proposal.body);
      }

      const updated = await updateProposalRequestStatus(proposal.id, "returned", {
        reviewerId: "noon-app",
      });
      await updateSessionStatusIfNeeded(session.id, session.status, "approved_for_proposal");

      await appendProposalReviewEvent({
        proposalRequestId: proposal.id,
        action: "noon_app_changes_requested",
        actor: "noon-app",
        notes: "Noon App PM requested changes before the website can show the proposal.",
      });

      return NextResponse.json({
        message: "Proposal returned for changes by Noon App.",
        decision: payload.decision,
        proposal_request: updated,
        session_status: "approved_for_proposal",
      });
    }

    if (proposal.status === "expired") {
      return NextResponse.json({
        message: "Proposal decision already applied.",
        decision: payload.decision,
        proposal_status: proposal.status,
      });
    }

    const updated = await updateProposalRequestStatus(proposal.id, "expired", {
      reviewerId: "noon-app",
    });
    await updateSessionStatusIfNeeded(session.id, session.status, "approved_for_proposal");

    await appendProposalReviewEvent({
      proposalRequestId: proposal.id,
      action: payload.decision === "rejected" ? "noon_app_rejected" : "noon_app_cancelled",
      actor: "noon-app",
      notes: "Noon App PM closed this proposal before website publication.",
    });

    // Send the client decline email. Both `rejected` and `cancelled` reach
    // this branch (approved / changes_requested return earlier), and per the
    // 2026-05-29 handoff Decision B they share one decline email. Mirrors the
    // approved branch's contract: wrap in try/catch, audit success/failure,
    // and NEVER let an email error roll back the decision (the proposal is
    // already `expired`; a failed email is notification debt, not a decision
    // failure). The early-return above on already-`expired` proposals plus the
    // Resend idempotency key keep this from re-firing on webhook retry.
    const recipient = proposal.deliveryRecipient ?? session.ownerEmail;
    if (recipient) {
      try {
        const emailResult = await sendProposalRejectedEmail({
          proposalId: proposal.id,
          versionNumber: updated.versionNumber ?? proposal.versionNumber,
          to: recipient,
          projectTitle:
            session.goalSummary ??
            session.initialPrompt ??
            `Proposal ${proposal.id}`,
        });

        await appendProposalReviewEvent({
          proposalRequestId: proposal.id,
          action: "sent",
          actor: "noon-app",
          notes: `Decline email delivered to ${recipient} via ${emailResult.provider} (${emailResult.messageId}).`,
        });
      } catch (error) {
        await appendProposalReviewEvent({
          proposalRequestId: proposal.id,
          action: "delivery_failed",
          actor: "noon-app",
          notes:
            error instanceof ProposalEmailConfigurationError ||
            error instanceof ProposalEmailSendError
              ? error.message
              : "Proposal decline email send failed after Noon App rejection/cancellation.",
        });
        log.error("integrations.noon-app.proposal-review-decision", error, {
          phase: "proposal_decline_email_send",
          proposalId: proposal.id,
        });
      }
    } else {
      await appendProposalReviewEvent({
        proposalRequestId: proposal.id,
        action: "delivery_failed",
        actor: "noon-app",
        notes:
          "Proposal decline email skipped: no delivery recipient resolved (deliveryRecipient and ownerEmail both empty).",
      });
    }

    return NextResponse.json({
      message: "Proposal closed by Noon App before website publication.",
      decision: payload.decision,
      proposal_request: updated,
      session_status: "approved_for_proposal",
    });
  } catch (error) {
    if (error instanceof NoonAppIntegrationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    log.error("integrations.noon-app.proposal-review-decision", error);
    return NextResponse.json(
      { message: "Noon App review decision webhook failed." },
      { status: 500 },
    );
  }
}
