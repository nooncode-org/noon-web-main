/**
 * lib/maxwell/image-verify.ts
 *
 * Fase A · Paso 6 — la aduana (docs/maxwell/fase-a-spec.md §6). The
 * customs gate between the keyword search (dumb) and the prompt: every
 * candidate photo is checked against ITS slot's brief — the six
 * attributes (subject, composition, context, light, perspective,
 * feeling) plus CROP SURVIVAL (the perfect photo whose subject dies when
 * cropped to the slot's ratio gets rejected).
 *
 * "No coincide = fuera, aunque sea bonita."
 *
 * Economics (owner's batch rule): ALL candidates travel in ONE executor
 * vision call — never one call per photo. ~20 images ≈ one coffee's
 * steam on the ledger.
 *
 * Degradation (Regla 0): verifier down or reply unusable → every slot
 * takes its FIRST candidate — exactly today's unverified behaviour, so
 * the net is the same pipeline degraded, never a blank prototype.
 */

import { chatWithOpenAI } from "@/lib/api-ia";
import { log } from "@/lib/server/logger";
import type { StockImage } from "@/lib/server/stock-images";
import type { SlotCandidates } from "./design-dossier";
import { resolveExecutorModel } from "./model-seats";

export type VerifiedSlot = {
  slot: SlotCandidates["slot"];
  /** The winning candidate, or null when nothing passed ("fuera aunque sea bonita"). */
  image: StockImage | null;
  /**
   * How the winner was chosen — counters feed on this (spec §10).
   * `deterministic` and `generated` come from levels 2 and 3 of the
   * cascade, applied after this gate to slots that were still empty.
   */
  verdict: "verified" | "fallback" | "empty" | "deterministic" | "generated";
};

/** Hard cap on images per verification call — keeps the batch legible. */
const MAX_BATCH_IMAGES = 20;

const VERIFIER_SYSTEM_PROMPT =
  "You are a photo editor verifying candidates against shot briefs. " +
  "For each slot, check every candidate against the brief's six attributes (subject, composition, context, light, perspective, feeling) " +
  "AND crop survival: cropped to the slot's target ratio around its focal point, does the subject stay intact? " +
  "A beautiful photo that does not match its brief FAILS. When no candidate passes, say so — an empty slot beats a wrong photo. " +
  "Reply with ONLY minified JSON, no markdown fences, no prose.";

function buildVerifierPrompt(
  slots: SlotCandidates[],
  imageIndexBySlot: Map<string, number[]>,
): string {
  const briefs = slots.map((s) => ({
    slotId: s.slot.slotId,
    brief: {
      subject: s.slot.subject,
      composition: s.slot.composition,
      context: s.slot.context,
      light: s.slot.light,
      perspective: s.slot.perspective,
      feeling: s.slot.feeling,
      ratio: s.slot.geometry.ratio,
      focalPoint: s.slot.geometry.focalPoint,
    },
    /** 1-based indexes of the attached images belonging to this slot. */
    imageIndexes: imageIndexBySlot.get(s.slot.slotId) ?? [],
  }));

  return `SLOTS AND THEIR CANDIDATES (image indexes refer to the attached images, in order, 1-based):
${JSON.stringify(briefs)}

For each slot pick the best PASSING candidate. Reply as minified JSON exactly:
{"slots":[{"slotId":"<id>","best":<1-based image index of the best passing candidate, or null if none pass>}]}`;
}

/**
 * Lenient reply parser, exported for tests. Maps the verifier's picks
 * back to images; unknown slots or out-of-range indexes → null pick.
 */
export function parseVerifyReply(
  reply: string,
  slots: SlotCandidates[],
  imageIndexBySlot: Map<string, number[]>,
): Map<string, StockImage | null> | null {
  const raw = reply.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let parsed: { slots?: unknown };
  try {
    parsed = JSON.parse(raw) as { slots?: unknown };
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.slots)) return null;

  const bySlotId = new Map(slots.map((s) => [s.slot.slotId, s]));
  const picks = new Map<string, StockImage | null>();

  for (const entry of parsed.slots as unknown[]) {
    const obj = (entry ?? {}) as Record<string, unknown>;
    const slotId = typeof obj.slotId === "string" ? obj.slotId : null;
    if (!slotId || !bySlotId.has(slotId)) continue;

    const slot = bySlotId.get(slotId)!;
    const allowed = imageIndexBySlot.get(slotId) ?? [];
    const best = typeof obj.best === "number" ? obj.best : null;

    if (best !== null && allowed.includes(best)) {
      const localIndex = allowed.indexOf(best);
      picks.set(slotId, slot.candidates[localIndex] ?? null);
    } else {
      picks.set(slotId, null);
    }
  }

  // A reply that addressed none of our slots is unusable.
  return picks.size > 0 ? picks : null;
}

/** Deterministic 1-based image numbering across the whole batch. */
export function buildBatchIndex(slots: SlotCandidates[]): {
  imageUrls: string[];
  imageIndexBySlot: Map<string, number[]>;
} {
  const imageUrls: string[] = [];
  const imageIndexBySlot = new Map<string, number[]>();

  for (const s of slots) {
    const indexes: number[] = [];
    for (const candidate of s.candidates) {
      if (imageUrls.length >= MAX_BATCH_IMAGES) break;
      imageUrls.push(candidate.url);
      indexes.push(imageUrls.length); // 1-based
    }
    imageIndexBySlot.set(s.slot.slotId, indexes);
  }

  return { imageUrls, imageIndexBySlot };
}

/**
 * Verify every slot's candidates in ONE executor vision call.
 * Never throws. Empty-candidate slots come back "empty" without spending.
 */
export async function verifyShotCandidates(
  slots: SlotCandidates[],
): Promise<VerifiedSlot[]> {
  const withCandidates = slots.filter((s) => s.candidates.length > 0);
  const emptyResults: VerifiedSlot[] = slots
    .filter((s) => s.candidates.length === 0)
    .map((s) => ({ slot: s.slot, image: null, verdict: "empty" as const }));

  if (withCandidates.length === 0) return emptyResults;

  const fallback = (): VerifiedSlot[] => [
    ...withCandidates.map((s) => ({
      slot: s.slot,
      image: s.candidates[0] ?? null,
      verdict: "fallback" as const,
    })),
    ...emptyResults,
  ];

  try {
    if (!process.env.OPENAI_API_KEY) return fallback();

    const { imageUrls, imageIndexBySlot } = buildBatchIndex(withCandidates);
    const { reply } = await chatWithOpenAI({
      model: resolveExecutorModel(),
      systemPrompt: VERIFIER_SYSTEM_PROMPT,
      prompt: buildVerifierPrompt(withCandidates, imageIndexBySlot),
      imageUrls,
      category: "image_verify",
      requestId: withCandidates[0]?.slot.slotId ?? null,
    });

    const picks = parseVerifyReply(reply, withCandidates, imageIndexBySlot);
    if (!picks) {
      log.warn("maxwell.image-verify", "verifier reply unusable — falling back to first candidates", {
        raw_head: reply.slice(0, 120),
      });
      return fallback();
    }

    return [
      ...withCandidates.map((s) => {
        const image = picks.has(s.slot.slotId) ? picks.get(s.slot.slotId)! : (s.candidates[0] ?? null);
        const verdict: VerifiedSlot["verdict"] = picks.has(s.slot.slotId)
          ? image
            ? "verified"
            : "empty"
          : "fallback";
        return { slot: s.slot, image, verdict };
      }),
      ...emptyResults,
    ];
  } catch (error) {
    log.error("maxwell.image-verify", error, {});
    return fallback();
  }
}
