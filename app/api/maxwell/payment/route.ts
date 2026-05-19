/**
 * app/api/maxwell/payment/route.ts
 *
 * Payment boundary for Maxwell Studio.
 * Internal review actions must come from an allowlisted reviewer session.
 * Client payment evidence is accepted from the authenticated proposal owner.
 * REVIEW_API_SECRET remains supported only for automation and server-to-server calls.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getReviewRequestAccess } from "@/lib/auth/review";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import {
  appendPaymentEvent,
  getProposalRequest,
  getProposalRequestByPublicToken,
  getStudioSession,
  getClientWorkspaceBySession,
  getLatestProposalRequest,
  updateProposalRequestStatus,
} from "@/lib/maxwell/repositories";
import { PaymentActivationError, confirmProposalPayment, confirmSessionPayment } from "@/lib/maxwell/payment-activation";
import {
  NoonAppIntegrationError,
} from "@/lib/noon-app-integration";
import { log } from "@/lib/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const markPendingSchema = z.object({
  action: z.literal("mark_payment_pending"),
  proposal_request_id: z.string().min(1),
});

const submitEvidenceSchema = z.object({
  action: z.literal("submit_payment_evidence"),
  proposal_request_id: z.string().min(1).optional(),
  public_token: z.string().min(1).optional(),
  payment_reference: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
}).refine((data) => data.proposal_request_id || data.public_token, {
  message: "Either proposal_request_id or public_token is required.",
});

const verifyPaymentSchema = z.object({
  action: z.literal("verify_payment"),
  proposal_request_id: z.string().min(1),
  actor: z.string().min(1).optional(),
  payment_reference: z.string().max(200).optional(),
  summary: z.string().max(500).optional(),
});

const expireProposalSchema = z.object({
  action: z.literal("expire_proposal"),
  proposal_request_id: z.string().min(1),
  actor: z.string().min(1).optional(),
});

const confirmPaymentSchema = z.object({
  action: z.literal("confirm_payment"),
  session_id: z.string().min(1),
  payment_status: z.enum(["confirmed", "failed", "refunded"]),
  summary: z.string().max(500).optional(),
  payment_reference: z.string().max(200).optional(),
});

const paymentSchema = z.union([
  markPendingSchema,
  submitEvidenceSchema,
  verifyPaymentSchema,
  expireProposalSchema,
  confirmPaymentSchema,
]);

function jsonError(status: number, message: string, code: string) {
  return NextResponse.json({ message, code }, { status });
}

export async function GET(request: Request) {
  const access = await getReviewRequestAccess(request);
  if (!access.authorized) {
    const status = access.reason === "sign_in_required" ? 401 : 403;
    return jsonError(status, "Unauthorized.", "AUTH_REQUIRED");
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return jsonError(
      400,
      "Missing required query parameter: session_id",
      "INVALID_REQUEST",
    );
  }

  const session = await getStudioSession(sessionId);
  if (!session) {
    return jsonError(404, "Session not found.", "SESSION_NOT_FOUND");
  }

  const workspace = await getClientWorkspaceBySession(sessionId);
  const proposal = await getLatestProposalRequest(sessionId);

  return NextResponse.json({
    session_id: session.id,
    session_status: session.status,
    proposal_status: proposal?.status ?? null,
    workspace: workspace ?? null,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = paymentSchema.parse(body);

    if (payload.action === "submit_payment_evidence") {
      const proposal = payload.public_token
        ? await getProposalRequestByPublicToken(payload.public_token)
        : await getProposalRequest(payload.proposal_request_id!);

      if (!proposal) {
        return jsonError(404, "Proposal request not found.", "PROPOSAL_NOT_FOUND");
      }

      const session = await getStudioSession(proposal.studioSessionId);
      if (!session) {
        return jsonError(404, "Associated session not found.", "SESSION_NOT_FOUND");
      }

      const [viewer, access] = await Promise.all([
        getAuthenticatedViewer(),
        getReviewRequestAccess(request),
      ]);
      const ownerAuthorized = viewer ? viewerOwnsStudioSession(viewer, session) : false;
      const reviewerAuthorized = access.authorized;

      if (!ownerAuthorized && !reviewerAuthorized) {
        const status = !viewer && !access.authorized && access.reason === "sign_in_required" ? 401 : 403;
        return jsonError(status, "Authentication required for this proposal.", "AUTH_REQUIRED");
      }

      if (proposal.status === "paid") {
        return jsonError(409, "This proposal is already paid.", "PROPOSAL_ALREADY_PAID");
      }

      if (proposal.status === "expired") {
        return jsonError(410, "This proposal has expired.", "PROPOSAL_EXPIRED");
      }

      if (proposal.status === "payment_under_verification") {
        return NextResponse.json({
          message: "Payment evidence is already under verification.",
          proposal_status: proposal.status,
          idempotent: true,
        });
      }

      if (proposal.status !== "sent" && proposal.status !== "payment_pending") {
        return jsonError(
          409,
          "This proposal is not ready to receive payment evidence.",
          "PROPOSAL_NOT_PAYABLE",
        );
      }

      const actor = ownerAuthorized ? viewer!.email : access.authorized ? access.actor : "client";
      const providerEventId = `manual-evidence:${proposal.id}`;

      await appendPaymentEvent({
        studioSessionId: proposal.studioSessionId,
        eventType: "received",
        amountUsd: proposal.approvedAmountUsd ?? undefined,
        currency: proposal.approvedCurrency ?? undefined,
        reference: payload.payment_reference,
        notes: payload.notes,
        provider: "manual_evidence",
        providerEventId,
        payloadJson: {
          proposalRequestId: proposal.id,
          publicToken: proposal.publicToken,
          submittedByOwner: ownerAuthorized,
        },
        createdBy: actor,
      });

      const updated = await updateProposalRequestStatus(
        proposal.id,
        "payment_under_verification",
      );

      return NextResponse.json({
        message: "Payment evidence submitted. Noon will verify it before activating the workspace.",
        proposal_status: updated.status,
      });
    }

    const access = await getReviewRequestAccess(request);
    if (!access.authorized) {
      const status = access.reason === "sign_in_required" ? 401 : 403;
      return jsonError(status, "Unauthorized.", "AUTH_REQUIRED");
    }

    const actor = "actor" in payload ? payload.actor ?? access.actor : access.actor;

    if (payload.action === "mark_payment_pending") {
      const proposal = await getProposalRequest(payload.proposal_request_id);
      if (!proposal) {
        return jsonError(404, "Proposal request not found.", "PROPOSAL_NOT_FOUND");
      }
      if (proposal.status !== "sent") {
        return jsonError(
          409,
          "Only a sent proposal can move into payment pending.",
          "PROPOSAL_NOT_PAYABLE",
        );
      }

      const updated = await updateProposalRequestStatus(payload.proposal_request_id, "payment_pending");
      return NextResponse.json({
        message: "Proposal marked as payment pending.",
        proposal_status: updated.status,
        expires_at: updated.expiresAt,
      });
    }

    if (payload.action === "verify_payment") {
      const activation = await confirmProposalPayment({
        proposalRequestId: payload.proposal_request_id,
        actor,
        paymentReference: payload.payment_reference,
        summary: payload.summary,
        provider: "website",
      });

      return NextResponse.json({
        message: "Payment verified. Workspace activated.",
        workspace: activation.workspace,
        session_status: "converted",
        proposal_status: "paid",
        idempotent: activation.idempotent,
      });
    }

    if (payload.action === "expire_proposal") {
      const proposal = await updateProposalRequestStatus(payload.proposal_request_id, "expired", {
        reviewerId: actor,
      });
      return NextResponse.json({
        message: "Proposal marked as expired.",
        proposal_status: proposal.status,
      });
    }

    if (payload.action === "confirm_payment") {
      if (payload.payment_status !== "confirmed") {
        const session = await getStudioSession(payload.session_id);
        return NextResponse.json({
          message: `Payment ${payload.payment_status}. Workspace remains unavailable until confirmation.`,
          workspace: session ? await getClientWorkspaceBySession(session.id) : null,
          session_status: session?.status ?? null,
        });
      }

      const activation = await confirmSessionPayment({
        sessionId: payload.session_id,
        actor,
        paymentReference: payload.payment_reference,
        summary: payload.summary,
      });

      return NextResponse.json({
        message: "Payment confirmed. Workspace activated.",
        workspace: activation.workspace,
        session_status: "converted",
        idempotent: activation.idempotent,
      });
    }

    return jsonError(400, "Unsupported action.", "INVALID_REQUEST");
  } catch (error) {
    if (error instanceof PaymentActivationError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.status },
      );
    }

    if (error instanceof NoonAppIntegrationError) {
      return NextResponse.json(
        { message: error.message, code: "NOON_APP_PAYMENT_HANDOFF_FAILED" },
        { status: error.status },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "Invalid request.",
          code: "INVALID_REQUEST",
          fieldErrors: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    log.error("maxwell.payment", error);
    return jsonError(
      500,
      "Payment action failed. Please try again.",
      "PAYMENT_ACTION_FAILED",
    );
  }
}
