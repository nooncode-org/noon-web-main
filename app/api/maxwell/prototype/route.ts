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
  setStudioDirection,
  savePrototypeRecipe,
  incrementCorrectionsUsed,
  updateStudioSessionStatus,
  type PrototypeRecipe,
  type StudioSession,
} from "@/lib/maxwell/repositories";
import { isBrainEnabled } from "@/lib/maxwell/brain-flag";
import { buildDirectionCard } from "@/lib/maxwell/direction-study";
import { noteCoverageGap } from "@/lib/maxwell/curation-queue";
import { studyReference } from "@/lib/maxwell/reference-study/study";
import { buildCreativeOrder } from "@/lib/maxwell/creative-order";
import { gatherShotCandidates } from "@/lib/maxwell/design-dossier";
import { archiveLibraryAssets } from "@/lib/maxwell/asset-library";
import { applyResourceCascade } from "@/lib/maxwell/resource-cascade";
import {
  correctionImageryBlock,
  correctionShotList,
} from "@/lib/maxwell/correction-assets";
import { verifyShotCandidates } from "@/lib/maxwell/image-verify";
import { assertCanRequestCorrection, MaxwellGuardError } from "@/lib/maxwell/studio-guards";
import { isGenerationLikelyInFlight } from "@/lib/maxwell/prototype-poll-policy";
import { evaluateInitialPrototypeCreate } from "@/lib/maxwell/prototype-quota";
import { classifyStylePack } from "@/lib/maxwell/style-classifier";
import { buildDesignDossier } from "@/lib/maxwell/design-dossier";
import {
  buildCorrectionBrief,
  buildPrototypeBrief,
  type BriefExtras,
} from "@/lib/maxwell/prototype-brief";
import { readCachedDossier } from "@/lib/maxwell/reference-study/dossier-cache";
import { getStylePackById } from "@/lib/maxwell/style-packs";
import {
  assertPrototypeBudgetAvailable,
  LLMBudgetExceededError,
} from "@/lib/server/llm-budget";

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

/**
 * Fase A · E2.2 — the confirmation card's tap. Carries the same
 * conversation snapshot as `create` because the milimetric brief needs it,
 * plus which reference the client chose. Only legal from
 * `awaiting_direction` (sin confirmación no se genera — this action IS the
 * confirmación).
 */
const studioConfirmDirectionSchema = z.object({
  action: z.literal("confirm_direction"),
  primary_url: z.string().trim().url().max(500),
  messages: z.array(chatMessageSchema).max(50),
  last_user_msg: z.string().trim().min(1).max(4000),
  last_assistant_msg: z.string().trim().min(1).max(4000),
  session_id: z.string(),
});

/**
 * Fase A · E2.3 — "Prefiero otra": swap the card's references for ones the
 * client hasn't seen. Pure re-serve — the session stays in
 * `awaiting_direction`, nothing generates, nothing is charged beyond a
 * capture that is cached from then on.
 */
const studioRotateDirectionSchema = z.object({
  action: z.literal("rotate_direction"),
  shown_urls: z.array(z.string().trim().url().max(500)).max(12),
  session_id: z.string(),
});

const requestSchema = z.discriminatedUnion("action", [
  studioCreateSchema,
  studioUpdateSchema,
  studioConfirmDirectionSchema,
  studioRotateDirectionSchema,
]);

/**
 * Fase A · E2.2 — the brain's brief for one generation: study (cached
 * after the card) → creative order → per-slot candidates → batch customs →
 * milimetric prompt. Every step degrades to null and the assembler
 * tolerates it (Regla 0) — worst case equals today's brief.
 */
async function buildBrainBrief(params: {
  session: StudioSession;
  stylePack: NonNullable<ReturnType<typeof getStylePackById>>;
  messages: z.infer<typeof chatMessageSchema>[];
  lastUserMsg: string;
  lastAssistantMsg: string;
  /** Absent when the client's reference is images rather than a page. */
  primaryUrl?: string;
}): Promise<{ brief: string; recipe: PrototypeRecipe }> {
  const { session, stylePack, messages, lastUserMsg, lastAssistantMsg, primaryUrl } = params;

  // Fase A · E3.3 — this prototype's own ceiling, checked before the
  // expensive half. Anomaly detection: on a healthy run it never fires.
  await assertPrototypeBudgetAvailable(session.id);

  // Their own images have no page to measure — the reading IS the ficha.
  const study = primaryUrl
    ? await studyReference(primaryUrl)
    : { dossier: null, source: "none" as const, stale: false };
  const clientReading = session.direction?.reading ?? null;
  const brief = await getStudioBrief(session.id);
  // The client's own reference leads the digest: the shot list must match
  // THEIR world (the sofa rule), not just the family's.
  const conversationDigest = [
    clientReading
      ? `CLIENT'S OWN REFERENCE (their direction): ${clientReading.understood}` +
        (clientReading.palette.length ? ` Palette: ${clientReading.palette.join(", ")}.` : "") +
        (clientReading.styleNotes.length ? ` Notes: ${clientReading.styleNotes.join("; ")}.` : "")
      : null,
    ...messages
      .slice(-8)
      .map((m) => `${m.role === "user" ? "Client" : "Maxwell"}: ${m.content.slice(0, 300)}`),
  ]
    .filter(Boolean)
    .join("\n");

  const order = await buildCreativeOrder({
    session,
    brief,
    stylePack,
    dossier: study.dossier,
    conversationDigest,
  });
  const slots = order ? await gatherShotCandidates(order.shotList, 4, stylePack.id) : [];
  const gated = order ? await verifyShotCandidates(slots) : [];
  // Levels 2 and 3 pick up whatever the library, the search and the customs
  // gate left empty — and a slot that stays empty stays empty on purpose.
  const verified = order
    ? await applyResourceCascade({ slots: gated, stylePack, sessionId: session.id })
    : [];

  // Fase A · E3.4 — file the winners in our own library (Nivel 0). Only
  // what the customs gate approved: the next client of this family gets
  // them free, and the system composes itself over time.
  await archiveLibraryAssets(
    verified
      .filter((slot) => slot.verdict === "verified" && slot.image)
      .map((slot) => ({
        image: slot.image!,
        role: slot.slot.role,
        familyId: stylePack.id,
        query: slot.slot.searchQuery,
      })),
  );

  log.info("maxwell.prototype", "brain brief assembled", {
    session_id: session.id,
    ficha_source: study.source,
    client_reading: clientReading !== null,
    order_available: order !== null,
    slots_verified: verified.filter((v) => v.verdict === "verified").length,
  });

  const assembled = buildPrototypeBrief(
    session,
    brief,
    messages,
    lastUserMsg,
    lastAssistantMsg,
    stylePack,
    null,
    { referenceDossier: study.dossier, clientReading, order, verifiedSlots: verified },
  );

  // Fase A · E3.2 — the recipe: every ingredient of THIS prototype, so a bad
  // result can be diagnosed instead of guessed at (spec §10).
  return {
    brief: assembled,
    recipe: {
      directionSource: session.direction?.source ?? "none",
      primaryUrl: primaryUrl ?? null,
      fichaSource: study.source,
      clientReadingUnderstood: clientReading?.understood ?? null,
      stylePackId: stylePack.id,
      orderAvailable: order !== null,
      headline: order?.copy.headline ?? null,
      slots: verified.map((v) => ({
        slotId: v.slot.slotId,
        role: v.slot.role,
        verdict: v.verdict,
        imageUrl: v.image?.url ?? null,
      })),
      finalPrompt: assembled,
    },
  };
}

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
      // Same-session double-fire guard: the quota's concurrency check skips
      // the current session on purpose, so without this a retry fired while
      // the first generation was still cooking created a second v0 chat.
      if (isGenerationLikelyInFlight(session.status, session.updatedAt, Date.now())) {
        return NextResponse.json(
          {
            message:
              "A prototype is already generating for this conversation. Give it a moment to finish.",
            code: "PROTOTYPE_GENERATION_IN_PROGRESS",
          },
          { status: 409 },
        );
      }

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

      // ── Fase A · E2.2 — the brain path (flag-gated) ─────────────────────
      // With the brain ON and no confirmed direction yet, "generate" first
      // means: classify → build the confirmation card → WAIT for the tap
      // (sin confirmación no se genera). A card that can't be built falls
      // through to the legacy path below (Regla 0) — the re-classify there
      // costs a fraction of a cent and only happens on that rare failure.
      if (isBrainEnabled() && !session.direction) {
        // Re-serves (reload mid-card) reuse the already-classified family —
        // no repeat spend, no pack drift. First serve classifies and persists.
        const existingPack = session.stylePackId ? getStylePackById(session.stylePackId) : null;
        let classification: Awaited<ReturnType<typeof classifyStylePack>> | null = null;
        if (!existingPack) {
          classification = await classifyStylePack(session, payload.last_user_msg);
        }
        const pack = existingPack ?? classification!.pack;
        if (!existingPack) {
          await setStylePackId(session.id, pack.id);

          // Fase A · E3.5 — the pool's self-diagnosis. Every fallback tier
          // returns no image queries, so an empty list on the neutral
          // family means "nothing here matched this business". Recording it
          // turns an invisible weakness into a shopping list.
          if (classification!.imageQueries.length === 0 && pack.id === "clean-professional") {
            await noteCoverageGap({
              familyId: pack.id,
              projectHint: (session.goalSummary ?? session.initialPrompt).slice(0, 160),
              reason: "classifier_fallback",
            });
          }
        }
        const direction = await buildDirectionCard({
          stylePack: pack,
          language: session.language,
          captureBase: "/api/maxwell/studio/reference-capture",
        });
        if (direction) {
          if (session.status !== "awaiting_direction") {
            await updateStudioSessionStatus(session.id, "awaiting_direction");
          }
          return NextResponse.json({
            awaiting_direction: true,
            card: direction.card,
            session_id: session.id,
            action: "create",
          });
        }
      }

      // With the brain ON and a direction ALREADY confirmed (sticky rule —
      // e.g. a retry after a v0 failure), generate with the brain brief but
      // never re-ask.
      if (isBrainEnabled() && session.direction && session.stylePackId) {
        const confirmedPack = getStylePackById(session.stylePackId);
        if (confirmedPack) {
          await updateStudioSessionStatus(session.id, "generating_prototype");
          const brainBrief = await buildBrainBrief({
            session,
            stylePack: confirmedPack,
            messages: payload.messages,
            lastUserMsg: payload.last_user_msg,
            lastAssistantMsg: payload.last_assistant_msg,
            primaryUrl: session.direction.primaryUrl,
          });
          let brainResult: Awaited<ReturnType<typeof createV0Prototype>>;
          try {
            brainResult = await createV0Prototype({
              prompt: brainBrief.brief,
              systemPrompt: V0_PROTOTYPE_SYSTEM_PROMPT,
            });
          } catch (v0Error) {
            log.error("maxwell.prototype", v0Error, { phase: "v0_create_brain" });
            const stuckSession = await getStudioSession(payload.session_id);
            if (stuckSession?.status === "generating_prototype") {
              await updateStudioSessionStatus(stuckSession.id, "clarifying");
            }
            if (v0Error instanceof LLMBudgetExceededError) {
              return NextResponse.json(
                {
                  message: "Prototype generation temporarily unavailable. Monthly LLM budget reached.",
                  code: "LLM_BUDGET_EXCEEDED",
                },
                { status: 503 },
              );
            }
            return NextResponse.json(
              { message: "Could not generate the prototype right now. Please try again." },
              { status: 500 },
            );
          }
          // E3.2 — the recipe of what we just ordered (never blocks).
          await savePrototypeRecipe({
            studioSessionId: session.id,
            v0ChatId: brainResult.chatId,
            recipe: brainBrief.recipe,
          });

          return NextResponse.json({
            pending: true,
            chatId: brainResult.chatId,
            session_id: session.id,
            action: "create",
          });
        }
      }
      // ── end brain path — everything below is the pre-brain flow, intact ──

      await updateStudioSessionStatus(session.id, "generating_prototype");

      // ── Quality Layer pipeline (Bloque 11 + Fase A v2) ──────────────────
      // Classify (pack + domain image queries) → persist style pack id →
      // gather REAL imagery (design dossier) → read brief (may be null) →
      // assemble the v0-structured prompt. Every step is best-effort:
      // classifyStylePack never throws, buildDesignDossier returns null when
      // unconfigured/failing, getStudioBrief returns null gracefully, and
      // buildPrototypeBrief tolerates null brief/dossier.
      const { pack: stylePack, imageQueries } = await classifyStylePack(
        session,
        payload.last_user_msg,
      );
      await setStylePackId(session.id, stylePack.id);
      const [dossier, brief] = await Promise.all([
        buildDesignDossier(imageQueries, stylePack),
        getStudioBrief(session.id),
      ]);
      const prototypeBrief = buildPrototypeBrief(
        session,
        brief,
        payload.messages,
        payload.last_user_msg,
        payload.last_assistant_msg,
        stylePack,
        dossier,
      );
      log.info("maxwell.prototype", "Quality Layer applied", {
        session_id: session.id,
        style_pack_id: stylePack.id,
        brief_available: brief !== null,
        imagery_available: dossier !== null,
        image_queries: imageQueries.length,
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
        // G-D2: budget hard-stop → 503 with clear code.
        if (v0Error instanceof LLMBudgetExceededError) {
          return NextResponse.json(
            {
              message: "Prototype generation temporarily unavailable. Monthly LLM budget reached.",
              code: "LLM_BUDGET_EXCEEDED",
            },
            { status: 503 },
          );
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

    // ── Fase A · E2.3 — "Prefiero otra": re-serve the card, never generate ──
    if (payload.action === "rotate_direction") {
      if (session.status !== "awaiting_direction") {
        return NextResponse.json(
          {
            message: "This conversation is not waiting for a direction.",
            code: "NOT_AWAITING_DIRECTION",
          },
          { status: 409 },
        );
      }
      const rotatePack = session.stylePackId ? getStylePackById(session.stylePackId) : undefined;
      if (!isBrainEnabled() || !rotatePack) {
        return NextResponse.json(
          {
            message: "Direction flow unavailable — please ask for the prototype again.",
            code: "DIRECTION_FLOW_UNAVAILABLE",
          },
          { status: 409 },
        );
      }

      const rotated = await buildDirectionCard({
        stylePack: rotatePack,
        language: session.language,
        captureBase: "/api/maxwell/studio/reference-capture",
        exclude: payload.shown_urls,
      });

      // Nothing new could be captured: keep the card on screen and let the
      // client say so calmly. Never an error, never a dead end (Regla 0).
      if (!rotated) {
        return NextResponse.json({
          awaiting_direction: true,
          exhausted: true,
          session_id: session.id,
          action: "rotate",
        });
      }

      return NextResponse.json({
        awaiting_direction: true,
        card: rotated.card,
        session_id: session.id,
        action: "rotate",
      });
    }

    // ── Fase A · E2.2 — the tap: confirm the direction, then generate ──────
    if (payload.action === "confirm_direction") {
      if (session.status !== "awaiting_direction") {
        return NextResponse.json(
          {
            message: "This conversation is not waiting for a direction.",
            code: "NOT_AWAITING_DIRECTION",
          },
          { status: 409 },
        );
      }
      const pack = session.stylePackId ? getStylePackById(session.stylePackId) : undefined;
      if (!isBrainEnabled() || !pack) {
        // Flag flipped off (or pack lost) between card and tap — degrade to
        // the ordinary flow instead of erroring at the client (Regla 0).
        await updateStudioSessionStatus(session.id, "clarifying");
        return NextResponse.json(
          { message: "Direction flow unavailable — please ask for the prototype again.", code: "DIRECTION_FLOW_UNAVAILABLE" },
          { status: 409 },
        );
      }

      // The tap may only confirm a reference WE offered. Without this the
      // endpoint would take any URL a client posts and hand it to the
      // analysis browser — an allowlist beats a filter, and the pool is
      // already one (client-supplied references travel the guarded path
      // in the chat, lib/maxwell/client-reference-guard.ts).
      const offered = new Set(
        pack.refs.map((ref) =>
          (/^https?:\/\//.test(ref.url) ? ref.url : `https://${ref.url}`).toLowerCase(),
        ),
      );
      if (!offered.has(payload.primary_url.toLowerCase())) {
        return NextResponse.json(
          {
            message: "That direction is no longer on offer. Pick one of the shown references.",
            code: "DIRECTION_NOT_OFFERED",
          },
          { status: 409 },
        );
      }

      await setStudioDirection(session.id, {
        primaryUrl: payload.primary_url,
        source: "pool",
        confirmedAt: new Date().toISOString(),
      });
      await updateStudioSessionStatus(session.id, "generating_prototype");

      const brainBrief = await buildBrainBrief({
        session,
        stylePack: pack,
        messages: payload.messages,
        lastUserMsg: payload.last_user_msg,
        lastAssistantMsg: payload.last_assistant_msg,
        primaryUrl: payload.primary_url,
      });

      let result: Awaited<ReturnType<typeof createV0Prototype>>;
      try {
        result = await createV0Prototype({
          prompt: brainBrief.brief,
          systemPrompt: V0_PROTOTYPE_SYSTEM_PROMPT,
        });
      } catch (v0Error) {
        log.error("maxwell.prototype", v0Error, { phase: "v0_create_confirm" });
        const stuckSession = await getStudioSession(payload.session_id);
        if (stuckSession?.status === "generating_prototype") {
          await updateStudioSessionStatus(stuckSession.id, "clarifying");
        }
        if (v0Error instanceof LLMBudgetExceededError) {
          return NextResponse.json(
            {
              message: "Prototype generation temporarily unavailable. Monthly LLM budget reached.",
              code: "LLM_BUDGET_EXCEEDED",
            },
            { status: 503 },
          );
        }
        return NextResponse.json(
          { message: "Could not generate the prototype right now. Please try again." },
          { status: 500 },
        );
      }

      // E3.2 — the recipe of what we just ordered (never blocks).
      await savePrototypeRecipe({
        studioSessionId: session.id,
        v0ChatId: result.chatId,
        recipe: brainBrief.recipe,
      });

      // Same response shape as `create` — the client's existing pending/poll
      // machinery takes over without knowing the brain exists.
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

    // Fase A · E3.1 — a correction carries the design's blueprints so it
    // extends the prototype instead of eroding it. The ficha comes from the
    // CACHE only: a change order must never pay for a fresh study (no
    // browser, no analysis call, no added wait). Cache miss → the family
    // values still travel, exactly as before.
    let correctionExtras: BriefExtras | null = null;
    if (isBrainEnabled() && session.direction) {
      const cached = session.direction.primaryUrl
        ? await readCachedDossier(session.direction.primaryUrl)
        : null;
      correctionExtras = {
        referenceDossier: cached?.dossier ?? null,
        clientReading: session.direction.reading ?? null,
      };
    }
    let correctionPrompt = buildCorrectionBrief(payload.prompt, stylePack, correctionExtras);

    // Fase A · E3.5 — the change asks for content that needs pictures
    // ("añade testimonios"). Those slots go through the SAME cascade and
    // the SAME customs gate as the first version, so v0 never has to
    // invent people. Silent no-op for every other kind of change.
    if (isBrainEnabled() && stylePack) {
      const newSlots = correctionShotList(payload.prompt, stylePack);
      if (newSlots.length > 0) {
        const candidates = await gatherShotCandidates(newSlots, 3, stylePack.id);
        const gatedSlots = await verifyShotCandidates(candidates);
        const filledSlots = await applyResourceCascade({
          slots: gatedSlots,
          stylePack,
          sessionId: session.id,
        });
        await archiveLibraryAssets(
          filledSlots
            .filter((slot) => slot.verdict === "verified" && slot.image)
            .map((slot) => ({
              image: slot.image!,
              role: slot.slot.role,
              familyId: stylePack.id,
              query: slot.slot.searchQuery,
            })),
        );
        correctionPrompt += correctionImageryBlock(filledSlots);
      }
    }

    let result: Awaited<ReturnType<typeof updateV0Prototype>>;
    try {
      result = await updateV0Prototype({ chatId: payload.chatId, prompt: correctionPrompt });
    } catch (v0Error) {
      log.error("maxwell.prototype", v0Error, { phase: "v0_update" });
      await updateStudioSessionStatus(session.id, "prototype_ready");
      // G-D2: budget hard-stop → 503 with clear code.
      if (v0Error instanceof LLMBudgetExceededError) {
        return NextResponse.json(
          {
            message: "Prototype updates temporarily unavailable. Monthly LLM budget reached.",
            code: "LLM_BUDGET_EXCEEDED",
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { message: "Could not apply the adjustment right now. Please try again." },
        { status: 500 },
      );
    }

    // Side-effect-only call — increments the row, return value not used here.
    // The version commit (createStudioVersion) happens in the poll endpoint
    // when v0 reports the async update is complete.
    await incrementCorrectionsUsed(session.id);

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
