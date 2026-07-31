import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import { getLatestProposalRequest, getStudioSession } from "@/lib/maxwell/repositories";
import { isProposalPubliclyViewable } from "@/lib/maxwell/proposal-visibility";
import { proposalStageFromStatus } from "@/lib/maxwell/proposal-milestone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Poll target for "is my proposal ready yet".
 *
 * Deliberately its OWN route rather than reusing `/studio/session`: this is
 * called every few seconds for up to ~20 minutes while the client waits, and the
 * session route returns the whole conversation — hundreds of KB per tick to read
 * one status field. Here the answer is a few dozen bytes.
 *
 * The window matters because the wait is real but short: a PM has
 * PROPOSAL_REVIEW_AUTO_SEND_MINUTES (15) to intervene, after which the proposal
 * goes out on its own. Without this endpoint the client had no way to learn that
 * happened except reloading the page or reading the email.
 *
 * Same gate as every other studio route: authenticated viewer + ownership of the
 * session. Nothing here is derived from anything the caller sends beyond the id.
 */
export async function GET(request: Request) {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ message: "session_id is required." }, { status: 400 });
  }

  const session = await getStudioSession(sessionId);
  if (!session) {
    return NextResponse.json({ message: "Session not found." }, { status: 404 });
  }
  if (!viewerOwnsStudioSession(viewer, session)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const proposal = await getLatestProposalRequest(sessionId);

  // Three fields, hand-picked. NOT the proposal row: it carries the ops SLA
  // timestamps (reviewNotifiedAt / autoSendDueAt / reviewerId …) that
  // INTERNAL_ONLY_FIELDS exists to keep away from clients — the wait is shown as
  // "usually about 15 minutes", never as this proposal's own countdown.
  return NextResponse.json({
    stage: proposalStageFromStatus(proposal?.status),
    created_at: proposal?.createdAt ?? null,
    // Same rule as the session route: the token only travels for statuses the
    // public page actually renders, so the client can never be handed a link
    // that would 404.
    public_token:
      proposal && isProposalPubliclyViewable(proposal.status) ? proposal.publicToken : null,
  });
}
