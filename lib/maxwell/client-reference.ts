/**
 * lib/maxwell/client-reference.ts
 *
 * Fase A · E2.4 — reading the CLIENT'S own reference (spec §4, the "Usar
 * mi referencia" flow closed with the owner on 2026-08-04):
 *
 *   - It does NOT have to be a website. A photo, a poster, an interior, a
 *     palette — anything visual that shows what they are after is valid.
 *   - We only ask for another when the image is genuinely unreadable. If
 *     the intention comes across "more or less", we work with it.
 *   - We state what we understood and ASK for confirmation before
 *     generating anything on top of an interpretation.
 *   - What the reference does not cover is filled from the sector study
 *     ONLY when we know it confidently; anything important and unknown is
 *     asked — short and once. Never blind, never pestering.
 *
 * One orchestrator vision call (the reading IS judgment). Never throws:
 * null means "couldn't read it", which drives the gentle ladder — never
 * an error the client sees as their fault.
 */

import { chatWithOpenAI } from "@/lib/api-ia";
import { log } from "@/lib/server/logger";
import { resolveOrchestratorModel } from "./model-seats";

export type ClientReferenceReading = {
  /**
   * One sentence IN THE CLIENT'S LANGUAGE — it goes verbatim into
   * Maxwell's confirmation question ("Viendo tu imagen, entiendo que…").
   */
  understood: string;
  /** Exact hexes read off the image. */
  palette: string[];
  /** Concrete observations (composition, type, light, materials). */
  styleNotes: string[];
  /**
   * Aspects a web page needs that this reference says nothing about.
   * Feeds the "nunca a ciegas" rule — the study fills what it knows, and
   * only a genuinely important gap becomes a short question.
   */
  notCovered: string[];
  /** False ONLY when the intention cannot be read at all. */
  usable: boolean;
};

/** Hard cap: up to 3 images of ONE reference (owner's rule). */
export const MAX_CLIENT_REFERENCE_IMAGES = 3;

const READER_SYSTEM_PROMPT =
  "You are a design director reading a client's visual reference. " +
  "The reference does NOT have to be a website — a photo, a poster, an interior, a product shot or a palette are all valid if they show what the client is after. " +
  "Read what the client is going for: colors (exact hex values), materials, composition, typography if visible, light, mood. " +
  "BE GENEROUS about usability: mark usable=false ONLY if the image is so unclear that no intention can be read at all. Blurry-but-readable is usable. " +
  "State what you understood in ONE sentence, written in the client's language, addressed to them — it will be shown to them for confirmation. " +
  "List what a website needs that this reference says nothing about (layout, sections, imagery, motion) so the team knows what it must not invent. " +
  "Reply with ONLY minified JSON, no markdown fences, no prose.";

function buildReaderPrompt(language: string): string {
  return `The attached images are ONE reference from the client (up to 3 views of the same thing).

Client's language: ${language}

Reply as minified JSON, exactly this shape:
{"understood":"<one sentence in ${language}, addressed to the client, describing what they seem to want>","palette":["#rrggbb"],"styleNotes":["<concrete observation>"],"notCovered":["<aspect a web page needs that this reference does not show>"],"usable":true}`;
}

/** Lenient parser, exported for tests. */
export function parseClientReferenceReply(reply: string): ClientReferenceReading | null {
  const raw = reply.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const understood = typeof parsed.understood === "string" ? parsed.understood.trim() : "";
  if (!understood) return null;

  const strings = (value: unknown, limit: number): string[] =>
    Array.isArray(value)
      ? value
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .map((v) => v.trim())
          .slice(0, limit)
      : [];

  return {
    understood,
    palette: strings(parsed.palette, 8).filter((hex) => /^#[0-9a-f]{6}$/i.test(hex)),
    styleNotes: strings(parsed.styleNotes, 8),
    notCovered: strings(parsed.notCovered, 6),
    // Only an explicit false marks it unreadable — a missing flag means
    // the model had no objection, and we lean toward working with it.
    usable: parsed.usable !== false,
  };
}

/**
 * Read the client's reference images. `imageUrls` are the composer's data
 * URLs (same transport the chat already uses for attachments — nothing is
 * written to disk here).
 */
export async function readClientReference(params: {
  imageUrls: string[];
  language: string;
  sessionId: string;
}): Promise<ClientReferenceReading | null> {
  const { imageUrls, language, sessionId } = params;
  const images = imageUrls.slice(0, MAX_CLIENT_REFERENCE_IMAGES);
  if (images.length === 0) return null;

  try {
    if (!process.env.OPENAI_API_KEY) return null;

    const { reply } = await chatWithOpenAI({
      model: resolveOrchestratorModel(),
      systemPrompt: READER_SYSTEM_PROMPT,
      prompt: buildReaderPrompt(language),
      imageUrls: images,
      category: "reference_analysis",
      requestId: sessionId,
    });

    const reading = parseClientReferenceReply(reply);
    if (!reading) {
      log.warn("maxwell.client-reference", "unusable reading reply — ladder takes over", {
        session_id: sessionId,
        raw_head: reply.slice(0, 120),
      });
    }
    return reading;
  } catch (error) {
    log.error("maxwell.client-reference", error, { session_id: sessionId });
    return null;
  }
}
