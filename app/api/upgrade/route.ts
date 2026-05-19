/**
 * POST /api/upgrade       — create a new session (or return existing one for same URL)
 * GET  /api/upgrade       — list user's upgrade sessions
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { log } from "@/lib/server/logger";
import { normalizeUrl } from "@/lib/upgrade/url-normalize";
import { checkSessionLimit } from "@/lib/upgrade/session-limits";
import {
  createUpgradeSession,
  findActiveSessionByUrl,
  listUserSessions,
  insertUpgradeEvent,
} from "@/lib/upgrade/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST — create or resume session
// ---------------------------------------------------------------------------

const createSessionSchema = z.object({
  websiteUrl: z.string().min(1).max(2048),
  mode: z.enum(["answer_questions", "best_judgment", "specific_note"]),
  contextNote: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  try {
    const viewer = await getAuthenticatedViewer();
    if (!viewer) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const payload = createSessionSchema.parse(body);

    // Normalize URL
    const normalized = normalizeUrl(payload.websiteUrl);
    if (!normalized.ok) {
      return NextResponse.json(
        { message: normalized.error },
        { status: 422 }
      );
    }

    // Check for existing active session with the same URL (reuse path)
    const existing = await findActiveSessionByUrl(viewer.email, normalized.canonical);
    if (existing) {
      await insertUpgradeEvent({
        sessionId: existing.id,
        eventType: "session_resumed",
        metadata: { resumedAt: new Date().toISOString() },
      });
      return NextResponse.json({ session: existing, resumed: true }, { status: 200 });
    }

    // Check session limit (max 3 new sessions in 30-day window)
    const limit = await checkSessionLimit(viewer.email);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          message: `You've reached the limit of 3 upgrade sessions in 30 days. Your next slot opens on ${new Date(limit.resetAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`,
          resetAt: limit.resetAt,
        },
        { status: 429 }
      );
    }

    // Create new session
    const session = await createUpgradeSession({
      ownerEmail: viewer.email,
      ownerName: viewer.name,
      websiteUrl: normalized.canonical,
      websiteUrlRaw: payload.websiteUrl,
      mode: payload.mode,
      contextNote: payload.contextNote,
    });

    await insertUpgradeEvent({
      sessionId: session.id,
      eventType: "session_created",
      metadata: {
        url: normalized.canonical,
        mode: payload.mode,
        limitUsed: limit.used + 1,
        limitRemaining: limit.remaining - 1,
      },
    });

    return NextResponse.json({ session, resumed: false }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { message: "Invalid request.", fieldErrors: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    log.error("upgrade.session.create", error);
    return NextResponse.json({ message: "Failed to create session." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET — list user sessions
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const viewer = await getAuthenticatedViewer();
    if (!viewer) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const sessions = await listUserSessions(viewer.email);
    return NextResponse.json({ sessions }, { status: 200 });
  } catch (error) {
    log.error("upgrade.session.list", error);
    return NextResponse.json({ message: "Failed to fetch sessions." }, { status: 500 });
  }
}
