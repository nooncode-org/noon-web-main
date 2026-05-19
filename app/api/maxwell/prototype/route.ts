import { NextResponse } from "next/server";
import { z } from "zod";
import { createV0Prototype, updateV0Prototype } from "@/lib/api-ia";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import { V0_PROTOTYPE_SYSTEM_PROMPT } from "@/lib/maxwell/prompts";
import { log } from "@/lib/server/logger";
import {
  getStudioSession,
  getStudioBrief,
  setStylePackId,
  createStudioVersion,
  incrementCorrectionsUsed,
  updateStudioSessionStatus,
  appendStudioMessage,
} from "@/lib/maxwell/repositories";
import { assertCanRequestCorrection, MaxwellGuardError } from "@/lib/maxwell/studio-guards";
import { evaluateInitialPrototypeCreate } from "@/lib/maxwell/prototype-quota";
import { classifyStylePack } from "@/lib/maxwell/style-classifier";
import {
  buildCorrectionBrief,
  buildPrototypeBrief,
} from "@/lib/maxwell/prototype-brief";
import { getStylePackById } from "@/lib/maxwell/style-packs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bloque 11 — `action: create` now accepts the raw conversation snapshot
 * (messages + last user/assistant turn) instead of a pre-built prompt string.
 * The server then runs:
 *   1. classifyStylePack  → picks 1 of 24 visual families
 *   2. setStylePackId     → persists the choice on the session
 *   3. getStudioBrief     → reads the (fire-and-forget) extracted brief if ready
 *   4. buildPrototypeBrief → assembles the multi-section v0 prompt
 *
 * Keeping prompt assembly server-side lets the brief + style pack stay
 * invisible to the client and prevents drift if the prompt template changes.
 */
const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  type: z.string().optional(),
});

const studioCreateSchema = z.object({
  action: z.literal("create"),
  messages: z.array(chatMessageSchema).max(50),
  last_user_msg: z.string().trim().min(1).max(4000),
  last_assistant_msg: z.string().trim().min(1).max(4000),
  session_id: z.string(),
});

const studioUpdateSchema = z.object({
  action: z.literal("update"),
  chatId: z.string().min(1),
  prompt: z.string().trim().min(1).max(4000),
  session_id: z.string(),
});

const requestSchema = z.discriminatedUnion("action", [
  studioCreateSchema,
  studioUpdateSchema,
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = requestSchema.parse(body);

    if (!process.env.V0_API_KEY) {
      return NextResponse.json({ message: "V0 API key is not configured." }, { status: 503 });
    }

    const viewer = await getAuthenticatedViewer();
    if (!viewer) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const session = await getStudioSession(payload.session_id);
    if (!session) {
      return NextResponse.json({ message: "Session not found." }, { status: 404 });
    }
    if (!viewerOwnsStudioSession(viewer, session)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    if (payload.action === "create") {
      const quota = await evaluateInitialPrototypeCreate(viewer.email, session.id);
      if (quota) {
        const contactAgent =
          quota.code === "USER_MONTHLY_PROTOTYPE_QUOTA" ||
          quota.code === "GLOBAL_MONTHLY_PROTOTYPE_QUOTA";
        return NextResponse.json(
          {
            message: quota.message,
            code: quota.code,
            contact_agent: contactAgent,
          },
          { status: 403 },
        );
      }

      await updateStudioSessionStatus(session.id, "generating_prototype");

      // ── Quality Layer pipeline (Bloque 11) ──────────────────────────────
      // Classify → persist style pack id → read brief (may be null) →
      // assemble multi-section prompt. All four steps are best-effort:
      // classifyStylePack never throws, getStudioBrief returns null gracefully,
      // and buildPrototypeBrief tolerates a null brief.
      const stylePack = await classifyStylePack(session, payload.last_user_msg);
      await setStylePackId(session.id, stylePack.id);
      const brief = await getStudioBrief(session.id);
      const prototypeBrief = buildPrototypeBrief(
        session,
        brief,
        payload.messages,
        payload.last_user_msg,
        payload.last_assistant_msg,
        stylePack,
      );
      log.info("maxwell.prototype", "Quality Layer applied", {
        session_id: session.id,
        style_pack_id: stylePack.id,
        brief_available: brief !== null,
      });
      // ────────────────────────────────────────────────────────────────────

      let result: Awaited<ReturnType<typeof createV0Prototype>>;
      try {
        result = await createV0Prototype({
          prompt: prototypeBrief,
          systemPrompt: V0_PROTOTYPE_SYSTEM_PROMPT,
        });
      } catch (v0Error) {
        log.error("maxwell.prototype", v0Error, { phase: "v0_create" });
        const stuckSession = await getStudioSession(payload.session_id);
        if (stuckSession?.status === "generating_prototype") {
          await updateStudioSessionStatus(stuckSession.id, "clarifying");
        }
        return NextResponse.json(
          { message: "Could not generate the prototype right now. Please try again." },
          { status: 500 },
        );
      }

      // We omit creating the StudioVersion here because the prototype is not ready.
      // The poll endpoint will create it when it's complete.

      // No esperamos a generar el mensaje ni la inserción si es asíncrono
      // La API responderá de inmediato con el chatId en pending=true

      return NextResponse.json({
        pending: true,
        chatId: result.chatId,
        session_id: session.id,
        action: "create",
      });
    }

    try {
      assertCanRequestCorrection(session);
    } catch (error) {
      if (error instanceof MaxwellGuardError) {
        return NextResponse.json(
          { message: error.message, code: error.code },
          { status: 409 },
        );
      }
      throw error;
    }

    await updateStudioSessionStatus(session.id, "revision_requested");

    // Bloque 11 — recover the session's style pack so corrections preserve
    // the same visual identity. Pre-Quality-Layer sessions have stylePackId
    // null; buildCorrectionBrief passes through the raw prompt in that case.
    const stylePack = session.stylePackId
      ? getStylePackById(session.stylePackId)
      : undefined;
    const correctionPrompt = buildCorrectionBrief(payload.prompt, stylePack);

    let result: Awaited<ReturnType<typeof updateV0Prototype>>;
    try {
      result = await updateV0Prototype({ chatId: payload.chatId, prompt: correctionPrompt });
    } catch (v0Error) {
      log.error("maxwell.prototype", v0Error, { phase: "v0_update" });
      await updateStudioSessionStatus(session.id, "prototype_ready");
      return NextResponse.json(
        { message: "Could not apply the adjustment right now. Please try again." },
        { status: 500 },
      );
    }

    const updatedSession = await incrementCorrectionsUsed(session.id);
    // Nota: Como la llamada ahora es asíncrona, no guardaremos la versión aún.
    // Retornamos de inmediato a pending=true para que el cliente comience a hacer polling.

    return NextResponse.json({
      pending: true,
      chatId: result.chatId,
      session_id: session.id,
      prompt: payload.prompt,
      action: "update",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request.", fieldErrors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    log.error("maxwell.prototype", error);
    return NextResponse.json(
      { message: "Could not generate the prototype right now. Please try again." },
      { status: 500 },
    );
  }
}
