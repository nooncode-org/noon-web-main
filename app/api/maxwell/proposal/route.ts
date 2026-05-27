import { NextResponse } from "next/server";
import { z } from "zod";
import { chatWithOpenAI, type ChatMessage } from "@/lib/api-ia";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import { log } from "@/lib/server/logger";
import {
  getStudioSession,
  getStudioMessagesForOpenAI,
  getStudioVersions,
  getLatestProposalRequest,
  createProposalRequest,
  updateStudioSessionStatus,
  appendStudioMessage,
  appendProposalReviewEvent,
  type ProposalRequest,
  type StudioSession,
  type StudioVersion,
} from "@/lib/maxwell/repositories";
import { assertCanRequestProposal, MaxwellGuardError } from "@/lib/maxwell/studio-guards";
import { MAXWELL_PROPOSAL_SYSTEM_PROMPT } from "@/lib/maxwell/prompts";
import {
  buildProposalContext,
  resolveProposalCommercialProfile,
  validateProposalDraft,
} from "@/lib/maxwell/proposal-rules";
import { classifyProposalCase } from "@/lib/maxwell/proposal-lifecycle";
import { stripInternalReviewFlags } from "@/lib/maxwell/proposal-content";
import {
  NoonAppIntegrationError,
  isNoonAppProposalHandoffConfigured,
  sendInboundProposalToNoonApp,
} from "@/lib/noon-app-integration";
import { LLMBudgetExceededError } from "@/lib/server/llm-budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const proposalRequestSchema = z.object({
  session_id: z.string(),
});

/**
 * Sends the draft to Noon App when env is configured; otherwise records a skip event.
 * On transport/signature errors returns a NextResponse to forward to the client.
 */
async function sendProposalForNoonAppReview(input: {
  session: StudioSession;
  proposal: ProposalRequest;
  versions: StudioVersion[];
}): Promise<NextResponse | { skipped: boolean }> {
  if (!isNoonAppProposalHandoffConfigured()) {
    log.warn(
      "maxwell.proposal",
      "NOON_APP_BASE_URL / NOON_WEBSITE_WEBHOOK_SECRET not set; skipping inbound handoff. " +
        "Draft is stored in proposal_request. Configure both to POST a signed JSON body to " +
        "Noon App at /api/integrations/website/inbound-proposal.",
    );
    await appendProposalReviewEvent({
      proposalRequestId: input.proposal.id,
      action: "noon_app_handoff_skipped",
      actor: "website",
      notes: "NOON_APP_BASE_URL or NOON_WEBSITE_WEBHOOK_SECRET missing; webhook not called.",
    });
    return { skipped: true };
  }

  try {
    await sendInboundProposalToNoonApp(input);

    await appendProposalReviewEvent({
      proposalRequestId: input.proposal.id,
      action: "noon_app_inbound_sent",
      actor: "website",
      notes: "Inbound proposal sent to Noon App PM queue.",
    });

    return { skipped: false };
  } catch (error) {
    await appendProposalReviewEvent({
      proposalRequestId: input.proposal.id,
      action: "noon_app_inbound_failed",
      actor: "website",
      notes: error instanceof Error ? error.message : "Unknown Noon App handoff error.",
    });

    if (error instanceof NoonAppIntegrationError) {
      return NextResponse.json(
        {
          message: "Proposal was created but could not be sent to Noon App for PM review.",
          proposal_request_id: input.proposal.id,
          code: "NOON_APP_HANDOFF_FAILED",
        },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 },
      );
    }

    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { session_id } = proposalRequestSchema.parse(body);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { message: "OpenAI API key is not configured." },
        { status: 503 },
      );
    }

    const viewer = await getAuthenticatedViewer();
    if (!viewer) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const session = await getStudioSession(session_id);
    if (!session) {
      return NextResponse.json({ message: "Session not found." }, { status: 404 });
    }
    if (!viewerOwnsStudioSession(viewer, session)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    if (session.status === "proposal_pending_review") {
      const [latestProposal, dbVersions] = await Promise.all([
        getLatestProposalRequest(session.id),
        getStudioVersions(session.id),
      ]);

      if (!latestProposal || latestProposal.status !== "pending_review") {
        return NextResponse.json(
          {
            message: "This session is already waiting for PM review and cannot create another proposal.",
            code: "PROPOSAL_ALREADY_PENDING_REVIEW",
          },
          { status: 409 },
        );
      }

      const handoffResult = await sendProposalForNoonAppReview({
        session,
        proposal: latestProposal,
        versions: dbVersions,
      });
      if (handoffResult instanceof NextResponse) return handoffResult;

      return NextResponse.json({
        proposal_request_id: latestProposal.id,
        status: latestProposal.status,
        session_id: session.id,
        session_status: "proposal_pending_review",
        review_flags: null,
        resent_to_noon_app: true,
        noon_app_handoff_skipped: handoffResult.skipped,
      });
    }

    try {
      assertCanRequestProposal(session);
    } catch (error) {
      if (error instanceof MaxwellGuardError) {
        return NextResponse.json(
          { message: error.message, code: error.code },
          { status: 409 },
        );
      }
      throw error;
    }

    if (session.status === "prototype_ready" || session.status === "prototype_shared") {
      // ADR-028 D7 — both `prototype_ready` and `prototype_shared` bridge to
      // `approved_for_proposal` before requesting the formal proposal. From
      // `prototype_shared` this is the legacy detailed-proposal fallthrough
      // (D12 ADDITIVE coexistence).
      await updateStudioSessionStatus(session.id, "approved_for_proposal");
    }

    await updateStudioSessionStatus(session.id, "proposal_pending_review", {
      proposalRequestedAt: new Date().toISOString(),
    });

    const dbMessages = await getStudioMessagesForOpenAI(session.id);
    const dbVersions = await getStudioVersions(session.id);
    const richContext = buildProposalContext(session, dbMessages, dbVersions);
    const commercialProfile = resolveProposalCommercialProfile(session);

    const { reply: draftContent } = await chatWithOpenAI({
      prompt: richContext,
      history: [] as ChatMessage[],
      systemPrompt: MAXWELL_PROPOSAL_SYSTEM_PROMPT,
      // G-D2: tag for monthly LLM-budget attribution.
      category: "proposal_generator",
      requestId: session.id,
    });

    const warnings = validateProposalDraft(draftContent, {
      membershipRecommended: commercialProfile.membershipRecommended,
      requireFlexibleOption: true,
    });
    if (warnings.length > 0) {
      log.warn("maxwell.proposal", `Draft has ${warnings.length} review flag(s)`, {
        sessionId: session.id,
        warnings,
      });
    }

    const proposalRequest = await createProposalRequest({
      studioSessionId: session.id,
      draftContent: stripInternalReviewFlags(draftContent),
      caseClassification: classifyProposalCase({ warningCount: warnings.length }),
      deliveryRecipient: session.ownerEmail,
    });

    if (warnings.length > 0) {
      await appendProposalReviewEvent({
        proposalRequestId: proposalRequest.id,
        action: "review_flags_detected",
        actor: "maxwell",
        notes: warnings.join("\n"),
      });
    }

    await appendStudioMessage({
      studioSessionId: session.id,
      role: "user",
      content: "Formal proposal requested.",
      messageType: "proposal_request",
    });

    const handoffResult = await sendProposalForNoonAppReview({
      session,
      proposal: proposalRequest,
      versions: dbVersions,
    });
    if (handoffResult instanceof NextResponse) return handoffResult;

    return NextResponse.json({
      proposal_request_id: proposalRequest.id,
      status: proposalRequest.status,
      session_id: session.id,
      session_status: "proposal_pending_review",
      review_flags: warnings.length,
      noon_app_handoff_skipped: handoffResult.skipped,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Invalid request." }, { status: 400 });
    }
    // G-D2: budget hard-stop → 503 with clear code (LLM_BUDGET_EXCEEDED).
    if (error instanceof LLMBudgetExceededError) {
      return NextResponse.json(
        {
          message: "Proposal generation temporarily unavailable. Monthly LLM budget reached.",
          code: "LLM_BUDGET_EXCEEDED",
        },
        { status: 503 },
      );
    }

    log.error("maxwell.proposal", error);
    return NextResponse.json(
      { message: "Could not generate proposal right now. Please try again." },
      { status: 500 },
    );
  }
}
