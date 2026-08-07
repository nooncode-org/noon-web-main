/**
 * GET /api/maxwell/studio/reference-capture/[id]
 *
 * Fase A · E2.2 — serves the confirmation card's cached reference
 * captures (JPEGs written by lib/maxwell/reference-study/card-capture.ts).
 * Read-only file streaming: this route never launches a browser and never
 * imports Playwright — captures are produced upstream by the study.
 *
 * Auth-gated like every studio surface. The id is a 20-hex hash of the
 * normalized reference URL; readCardCapture validates the alphabet so a
 * crafted id cannot escape the capture directory.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { readCardCapture } from "@/lib/maxwell/reference-study/card-capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  const capture = await readCardCapture(id);
  if (!capture) {
    return NextResponse.json({ message: "Capture not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(capture), {
    headers: {
      "Content-Type": "image/jpeg",
      // Captures are immutable per id (id = content-addressed by URL hash);
      // let the browser keep them for the session.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
