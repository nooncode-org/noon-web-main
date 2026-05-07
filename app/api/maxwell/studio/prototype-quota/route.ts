import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { getPrototypeQuotaSnapshot } from "@/lib/maxwell/prototype-quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id")?.trim() || null;

  const snapshot = await getPrototypeQuotaSnapshot(viewer.email, sessionId);
  return NextResponse.json(snapshot);
}
