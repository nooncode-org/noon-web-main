import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { listStudioSessionsForOwner, softDeleteStudioSession } from "@/lib/maxwell/repositories";
import { assertNoInternalFields } from "@/lib/security/project-isolation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const sessions = await listStudioSessionsForOwner(viewer.email);
  const body = {
    sessions: sessions.map((s) => ({
      id: s.id,
      initial_prompt: s.initialPrompt,
      status: s.status,
      goal_summary: s.goalSummary,
      updated_at: s.updatedAt,
      has_client_workspace: s.hasClientWorkspace,
    })),
  };

  // v3 isolation guard (2026-05-19): dev/CI-only assert that the
  // session list payload never carries internal fields. The body is
  // hand-allowlisted above; this lock-in catches future regressions
  // that swap the manual map for `sessions` raw. No-op in prod.
  if (process.env.NODE_ENV !== "production") {
    assertNoInternalFields(body, "GET /api/maxwell/studio/sessions");
  }

  return NextResponse.json(body);
}

export async function DELETE(request: Request) {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json({ message: "session_id is required." }, { status: 400 });
  }

  const deleted = await softDeleteStudioSession(sessionId, viewer.email);
  if (!deleted) {
    return NextResponse.json({ message: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
