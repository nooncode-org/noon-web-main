/**
 * app/api/maxwell/payment/route.ts
 *
 * Payment boundary for Maxwell Studio.
 * Browser access must come from an allowlisted internal reviewer session.
 * REVIEW_API_SECRET remains supported only for automation and server-to-server calls.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getReviewRequestAccess } from "@/lib/auth/review";
import {
  getProposalRequest,
  getStudioSession,
  getClientWorkspaceBySession,
  getLatestProposalRequest,
  updateProposalRequestStatus,
} from "@/lib/maxwell/repositories";
import { PaymentActivationError, confirmProposalPayment, confirmSessionPayment } from "@/lib/maxwell/payment-activation";
import {
  NoonAppIntegrationError,
} from "@/lib/noon-app-integration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const markPendingSchema = z.object({
  action: z.literal("mark_payment_pending"),
  proposal_request_id: z.string().min(1),
});

const submitEvidenceSchema = z.object({
  action: z.literal("submit_payment_evidence"),
  proposal_request_id: z.string().min(1),
  notes: z.string().max(1000).optional(),
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

const paymentSchema = z.discriminatedUnion("action", [
  markPendingSchema,
  submitEvidenceSchema,
  verifyPaymentSchema,
  expireProposalSchema,
  confirmPaymentSchema,
]);

export async function GET(request: Request) {
  const access = await getReviewRequestAccess(request);
  if (!access.authorized) {
    const status = access.reason === "sign_in_required" ? 401 : 403;
    return NextResponse.json({ message: "Unauthorized." }, { status });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { message: "Missing required query parameter: session_id" },
      { status: 400 },
    );
  }

  const session = await getStudioSession(sessionId);
  if (!session) {
    return NextResponse.json({ message: "Session not found." }, { status: 404 });
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
  const access = await getReviewRequestAccess(request);
  if (!access.authorized) {
    const status = access.reason === "sign_in_required" ? 401 : 403;
    return NextResponse.json({ message: "Unauthorized." }, { status });
  }

  try {
    const body = await request.json();
    const payload = paymentSchema.parse(body);
    const actor = "actor" in payload ? payload.actor ?? access.actor : access.actor;

    if (payload.action === "mark_payment_pending") {
      const proposal = await getProposalRequest(payload.proposal_request_id);
      if (!proposal) {
        return NextResponse.json({ message: "Proposal request not found." }, { status: 404 });
      }
      if (proposal.status !== "sent") {
        return NextResponse.json(
          { message: "Only a sent proposal can move into payment pending." },
          { status: 409 },
        );
      }

      const updated = await updateProposalRequestStatus(payload.proposal_request_id, "payment_pending");
      return NextResponse.json({
        message: "Proposal marked as payment pending.",
        proposal_status: updated.status,
        expires_at: updated.expiresAt,
      });
    }

    if (payload.action === "submit_payment_evidence") {
      const proposal = await updateProposalRequestStatus(
        payload.proposal_request_id,
        "payment_under_verification",
      );
      return NextResponse.json({
        message: "Payment evidence submitted. Under verification.",
        proposal_status: proposal.status,
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

    return NextResponse.json({ message: "Unsupported action." }, { status: 400 });
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
        { message: "Invalid request.", fieldErrors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    console.error("Maxwell payment error:", error);
    return NextResponse.json(
      { message: "Payment action failed. Please try again." },
      { status: 500 },
    );
  }
}
