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

  return NextResponse.json({
    session: {
      id: session.id,
      status: session.status,
      goalSummary: session.goalSummary,
      correctionsUsed: session.correctionsUsed,
      maxCorrections: session.maxCorrections,
    },
    messages,
    versions,
    workspace: workspace ?? null,
    workspace_pending: session.status === "converted" && !workspace,
    proposal_status: proposal?.status ?? null,
  });
}
