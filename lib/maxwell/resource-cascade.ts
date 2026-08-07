/**
 * lib/maxwell/resource-cascade.ts
 *
 * Fase A · E3.4 — the last two levels of the cascade (spec §6), applied to
 * the slots the earlier ones could not fill.
 *
 * Order matters and is the owner's: our own library (0) and the stock
 * search (1) run first — inside `gatherShotCandidates` — and their output
 * goes through the customs gate. Whatever comes back EMPTY arrives here:
 *
 *   Nivel 2 — deterministic, free, instant. Illustrated avatars (playful
 *     families only) and generated backgrounds. Never used for heroes or
 *     section photography: those carry the promise and deserve the real
 *     thing.
 *   Nivel 3 — gpt-image-2, the last resort. It inherits the slot's full
 *     brief as its order ("toma todos los recursos, el camino y todo lo que
 *     necesitas"), so what it produces belongs to the same world as the
 *     rest. Off by default; needs MAXWELL_IMAGE_GENERATION=1.
 *
 * A slot that still ends empty stays empty. That is a designed outcome:
 * the brief tells v0 to solve that moment with typography and whitespace,
 * which beats a wrong picture every time.
 */

import { generateSlotImage } from "@/lib/api-ia";
import { log } from "@/lib/server/logger";
import type { StockImage } from "@/lib/server/stock-images";
import { deterministicCandidates } from "./deterministic-assets";
import type { VerifiedSlot } from "./image-verify";
import type { StylePack } from "./style-packs";

/** Nivel 3 is the only paid step here, so it stays behind its own switch. */
export function isImageGenerationEnabled(): boolean {
  const raw = process.env.MAXWELL_IMAGE_GENERATION?.trim().toLowerCase();
  return raw === "1" || raw === "true";
}

/** Cap per prototype: the last resort must never become the habit. */
const MAX_GENERATED_PER_RUN = 2;

/** The slot's six attributes, turned into an order an image model obeys. */
export function slotImagePrompt(slot: VerifiedSlot["slot"]): string {
  return [
    slot.subject,
    slot.composition && `Composition: ${slot.composition}.`,
    slot.context && `Setting: ${slot.context}.`,
    slot.light && `Light: ${slot.light}.`,
    slot.perspective && `Perspective: ${slot.perspective}.`,
    slot.feeling && `Feeling: ${slot.feeling}.`,
    "Photographic, natural, no text, no logos, no watermarks, no collage.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Fill what is still empty. Returns the same slots, with levels 2 and 3
 * applied where they honestly help.
 */
export async function applyResourceCascade(params: {
  slots: VerifiedSlot[];
  stylePack: StylePack;
  sessionId: string;
}): Promise<VerifiedSlot[]> {
  const { slots, stylePack, sessionId } = params;
  const filled: VerifiedSlot[] = [];
  let generated = 0;

  for (const entry of slots) {
    if (entry.image) {
      filled.push(entry);
      continue;
    }

    // Nivel 2 — free and instant. No verification call: these are ours by
    // construction (a generated background) or explicitly scoped (avatars
    // only where the family's tone asks for them).
    const deterministic: StockImage[] = deterministicCandidates({
      slot: entry.slot,
      stylePack,
      count: 1,
    });
    if (deterministic.length > 0) {
      filled.push({ ...entry, image: deterministic[0], verdict: "deterministic" });
      continue;
    }

    // Nivel 3 — the last resort, capped and flag-gated.
    if (isImageGenerationEnabled() && generated < MAX_GENERATED_PER_RUN) {
      const dataUrl = await generateSlotImage({
        prompt: slotImagePrompt(entry.slot),
        ratio: entry.slot.geometry.ratio,
        requestId: sessionId,
      });
      if (dataUrl) {
        generated += 1;
        filled.push({
          ...entry,
          image: {
            url: dataUrl,
            urlLarge: dataUrl,
            alt: entry.slot.subject,
            avgColor: null,
          },
          verdict: "generated",
        });
        continue;
      }
    }

    // Still empty — and that is a fine answer.
    filled.push(entry);
  }

  if (generated > 0) {
    log.info("maxwell.resource-cascade", "slots filled by generation (last resort)", {
      session_id: sessionId,
      generated,
    });
  }

  return filled;
}
