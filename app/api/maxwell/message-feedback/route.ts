import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import {
  getStudioMessage,
  getStudioSession,
  setStudioMessageFeedback,
} from "@/lib/maxwell/repositories";
import { log } from "@/lib/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const feedbackRequestSchema = z.object({
  message_id: z.string().min(1),
  feedback: z.enum(["up", "down"]).nullable(),
});

export async function POST(request: Request) {
  try {
    const viewer = await getAuthenticatedViewer();
    if (!viewer) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const payload = feedbackRequestSchema.parse(await request.json());
    const message = await getStudioMessage(payload.message_id);
    if (!message) {
      return NextResponse.json({ message: "Message not found." }, { status: 404 });
    }
    if (message.role !== "assistant" || message.messageType !== "chat") {
      return NextResponse.json(
        { message: "Feedback can only be recorded for Maxwell responses." },
        { status: 400 },
      );
    }

    const session = await getStudioSession(message.studioSessionId);
    if (!session) {
      return NextResponse.json({ message: "Session not found." }, { status: 404 });
    }
    if (!viewerOwnsStudioSession(viewer, session)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    const feedback = await setStudioMessageFeedback({
      studioMessageId: message.id,
      studioSessionId: message.studioSessionId,
      viewerEmail: viewer.email,
      feedback: payload.feedback,
    });

    return NextResponse.json({ message_id: message.id, feedback });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request.", fieldErrors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    log.error("maxwell.message-feedback", error);
    return NextResponse.json(
      { message: "Could not update message feedback right now." },
      { status: 500 },
    );
  }
}
