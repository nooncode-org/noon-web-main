import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import {
  getClientWorkspaceBySession,
  getLatestProposalRequest,
  getStudioSession,
  getStudioMessagesForViewer,
  getStudioVersions,
} from "@/lib/maxwell/repositories";
import type { MessageType } from "@/lib/maxwell/repositories";
import { isProposalPubliclyViewable } from "@/lib/maxwell/proposal-visibility";
import { fetchPrototipoRender } from "@/lib/maxwell/prototipo-render-fetch";
import { assertNoInternalFields } from "@/lib/security/project-isolation";
import { log } from "@/lib/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toUiType(messageType: MessageType): "thinking" | "system_event" | undefined {
  if (messageType === "thinking") return "thinking";
  if (
    messageType === "system_event" ||
    messageType === "prototype_announcement"
  ) {
    return "system_event";
  }
  return undefined;
}

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

  const dbMessages = await getStudioMessagesForViewer(sessionId, viewer.email);
  const dbVersions = await getStudioVersions(sessionId);
  const workspace = await getClientWorkspaceBySession(sessionId);
  const proposal = await getLatestProposalRequest(sessionId);

  // W5 (ADR-028 D7 stays: no push callback — sync is pull). When the session
  // shared a prototipo link and no proposal exists yet, read the decision the
  // client recorded on that link via App's signed-read, so the studio can say
  // "your client already accepted/rejected" instead of leaving the owner
  // blind. Best-effort: any fetch failure degrades to "no decision info"
  // (fetchPrototipoRender never throws). Skipped once a proposal exists — the
  // flow already moved past the prototype decision.
  let shareDecision: {
    status: "accepted" | "rejected";
    decidedAt: string | null;
  } | null = null;
  const shareDecisionRelevant =
    session.shareToken !== null &&
    proposal === null &&
    (session.status === "prototype_ready" ||
      session.status === "prototype_shared" ||
      session.status === "approved_for_proposal");
  if (shareDecisionRelevant && session.shareToken) {
    const render = await fetchPrototipoRender(session.shareToken);
    if (render.status === "ok" && render.data.decision.status !== "pending") {
      shareDecision = {
        status: render.data.decision.status,
        decidedAt: render.data.decision.decidedAt,
      };
    } else if (render.status === "error") {
      log.warn("maxwell.studio.session", "Share-decision pull failed; rehydrating without it.", {
        session_id: session.id,
        code: render.code,
        http_status: render.httpStatus,
      });
    }
  }

  const messages = dbMessages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      ...(message.feedback ? { feedback: message.feedback } : {}),
      ...(toUiType(message.messageType)
        ? { type: toUiType(message.messageType) }
        : {}),
    }));

  const versions = dbVersions.map((version) => ({
    chatId: version.v0ChatId,
    demoUrl: version.previewUrl,
    versionNumber: version.versionNumber,
  }));

  const body = {
    session: {
      id: session.id,
      status: session.status,
      goalSummary: session.goalSummary,
      correctionsUsed: session.correctionsUsed,
      maxCorrections: session.maxCorrections,
      // ADR-028 D6 — surface the share URL so the client can re-render the
      // "Compartido" CTA after a reload. `shareToken` itself is not exposed
      // here (the URL already embeds it and is what the seller needs to copy).
      shareTokenUrl: session.shareTokenUrl,
      prototypeSharedAt: session.prototypeSharedAt,
    },
    messages,
    versions,
    workspace: workspace ?? null,
    workspace_pending: session.status === "converted" && !workspace,
    // W5 — the client's decision on the shared prototipo link (null when not
    // shared, still pending, already past the prototype stage, or unreachable).
    share_decision: shareDecision,
    proposal_status: proposal?.status ?? null,
    // Owner-only deep-link token for the Studio "View your proposal" CTA.
    // Exposed ONLY for statuses the public proposal page actually renders, so
    // we never hand a token that would 404. The endpoint is already
    // owner-gated above (viewerOwnsStudioSession → 403), so this never leaks
    // across clients. `publicToken` is client-facing by design (it ships in
    // the proposal email) and is absent from INTERNAL_ONLY_FIELDS.
    proposal_public_token:
      proposal && isProposalPubliclyViewable(proposal.status)
        ? proposal.publicToken
        : null,
  };

  // v3 isolation guard (2026-05-19): assert in dev/CI that no
  // operational field accidentally leaked into the client response.
  // The body is hand-allowlisted above — this lock-in catches future
  // refactors that might return a DB-shaped object wholesale (e.g.
  // `proposal` or `session` raw). No-op in production: the check
  // never runs against client traffic, but every test + dev request
  // exercises it.
  if (process.env.NODE_ENV !== "production") {
    assertNoInternalFields(body, "GET /api/maxwell/studio/session");
  }

  return NextResponse.json(body);
}
