/**
 * app/api/maxwell/payment/evidence/route.ts
 *
 * Customer-facing entry point for submitting payment evidence.
 * The sibling route `app/api/maxwell/payment/route.ts` keeps the same action
 * gated behind the reviewer allowlist (`getReviewRequestAccess`) so PMs can
 * still mark evidence on behalf of a client. This file exists so the CLIENT
 * who received the proposal can submit evidence themselves — authenticated
 * via NextAuth Google session, gated by ownership of the underlying studio
 * session.
 *
 * Lifecycle note: this is transitional. Once NoonApp's Stripe + webhook
 * pipeline goes live (App roadmap Fase 2 semana 4-5, ~mid-July 2026),
 * the client will pay through Stripe directly and the App will mark the
 * proposal as paid via the existing `payment-confirmed` webhook. At that
 * point this endpoint can be removed in favour of a Stripe checkout button.
 * See NoonWeb Roadmap §10.8.2.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import {
  appendProposalReviewEvent,
  getProposalRequest,
  getStudioSession,
  updateProposalRequestStatus,
} from "@/lib/maxwell/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const evidenceSchema = z.object({
  proposal_request_id: z.string().min(1),
  notes: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  let payload: z.infer<typeof evidenceSchema>;
  try {
    payload = evidenceSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request.", fieldErrors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    throw error;
  }

  const proposal = await getProposalRequest(payload.proposal_request_id);
  if (!proposal) {
    return NextResponse.json({ message: "Proposal request not found." }, { status: 404 });
  }

  const session = await getStudioSession(proposal.studioSessionId);
  if (!session) {
    return NextResponse.json({ message: "Associated session not found." }, { status: 404 });
  }

  if (!viewerOwnsStudioSession(viewer, session)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  // The client can only submit evidence when the proposal is sitting in
  // `payment_pending`. From any other state, submission is either premature
  // (e.g. `sent` — client hasn't accepted yet) or stale (e.g. already
  // `payment_under_verification` / `paid` / `expired`).
  if (proposal.status !== "payment_pending") {
    return NextResponse.json(
      {
        message: `Cannot submit evidence while the proposal is in state '${proposal.status}'.`,
        code: "INVALID_PROPOSAL_STATE",
        proposal_status: proposal.status,
      },
      { status: 409 },
    );
  }

  try {
    const updated = await updateProposalRequestStatus(
      payload.proposal_request_id,
      "payment_under_verification",
    );

    await appendProposalReviewEvent({
      proposalRequestId: payload.proposal_request_id,
      action: "client_evidence_submitted",
      actor: `client:${viewer.email}`,
      notes: payload.notes,
    });

    return NextResponse.json({
      message: "Payment evidence submitted. Under verification.",
      proposal_status: updated.status,
    });
  } catch (error) {
    console.error("Maxwell payment evidence error:", error);
    return NextResponse.json(
      { message: "Could not submit evidence. Please try again." },
      { status: 500 },
    );
  }
}
