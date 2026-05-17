/**
 * GET /api/upgrade/[id] — fetch session with full details (audit + latest version + page count)
 */

import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { log } from "@/lib/server/logger";
import { getSessionWithDetails, getUpgradeSessionById } from "@/lib/upgrade/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const viewer = await getAuthenticatedViewer();
    if (!viewer) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const session = await getUpgradeSessionById(id);
    if (!session) {
      return NextResponse.json({ message: "Session not found." }, { status: 404 });
    }

    // Ownership check
    if (session.ownerEmail !== viewer.email) {
      return NextResponse.json({ message: "Access denied." }, { status: 403 });
    }

    const details = await getSessionWithDetails(id);
    return NextResponse.json({ session: details }, { status: 200 });
  } catch (error) {
    log.error("upgrade.session.detail", error);
    return NextResponse.json({ message: "Failed to fetch session." }, { status: 500 });
  }
}
