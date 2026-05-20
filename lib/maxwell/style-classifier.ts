/**
 * lib/maxwell/style-classifier.ts
 *
 * Bloque 11 — picks one of the 24 style packs for a studio session.
 *
 * Strategy (in order, each tier falls back to the next on failure):
 *   1. LLM call with `gpt-4.1-mini` — cheap + low-latency model for a
 *      1-of-24 classification task. We pass the list of pack ids + a short
 *      context blurb and ask for a single id back.
 *   2. Deterministic fallback by `session.projectType` — a hand-mapped
 *      best-guess so the system still returns something useful when the
 *      LLM is unavailable, mis-configured (no OPENAI_API_KEY), or returns
 *      a value we can't recognise.
 *   3. Final fallback to `clean-professional` — broad, B&W minimal,
 *      acceptable as a "neutral default" for almost any project.
 *
 * Never throws — every error path is logged and absorbed. The caller (the
 * prototype route) always gets a valid StylePack back so the v0 prompt is
 * always well-formed.
 */

import { chatWithOpenAI } from "@/lib/api-ia";
import { log } from "@/lib/server/logger";
import type { StudioSession } from "./repositories";
import {
  STYLE_PACKS,
  getStylePackById,
  type StylePack,
} from "./style-packs";

const DEFAULT_PACK_ID = "clean-professional";

/**
 * Hand-mapped fallback when the LLM is unavailable. Conservative on purpose:
 * picks the most-generic-but-still-relevant pack per project type so the
 * worst case is "boring but coherent", never "wrong family".
 */
const PROJECT_TYPE_FALLBACK: Record<string, string> = {
  web_landing: "clean-professional",
  ecommerce: "commerce-retail",
  webapp_system: "tech-digital",
  mobile: "tech-digital",
  saas_ai_automation: "tech-digital",
};

function fallbackByProjectType(projectType: string | null): StylePack {
  if (projectType) {
    const id = PROJECT_TYPE_FALLBACK[projectType];
    if (id) {
      const pack = getStylePackById(id);
      if (pack) return pack;
    }
  }
  // The DEFAULT_PACK_ID is hardcoded above and shipped in STYLE_PACKS — the
  // bang is safe but we guard anyway in case someone removes it from the
  // catalogue without updating this file.
  return getStylePackById(DEFAULT_PACK_ID) ?? STYLE_PACKS[0];
}

/**
 * Build the LLM prompt. Kept tight: the model only needs the id list + a
 * one-line description of each pack to pick correctly. Verbose feel/refs
 * data is intentionally excluded — it would inflate the prompt without
 * improving the choice (we tested this informally; the model picks the same
 * id with or without the verbose context for 1-of-24).
 */
function buildClassifierPrompt(session: StudioSession, contextHint: string): string {
  const catalogue = STYLE_PACKS.map((p) => `- ${p.id}: ${p.name} — ${p.feel}`).join("\n");

  const sessionFacts = [
    session.projectType ? `Project type: ${session.projectType}` : null,
    session.complexityHint ? `Complexity: ${session.complexityHint}` : null,
    session.language ? `Language: ${session.language}` : null,
    session.goalSummary ? `Goal: ${session.goalSummary}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `Pick the single best style pack id for this project.

CATALOGUE:
${catalogue}

PROJECT FACTS:
${sessionFacts || "(none captured yet)"}

CLIENT CONTEXT:
${contextHint.slice(0, 1500)}

Reply with ONLY the id string (e.g. "tech-digital"). No quotes, no explanation, no markdown.`;
}

/**
 * Public entry point. Always returns a valid StylePack.
 *
 * @param session  Current studio session (read-only; we only consume its facts).
 * @param contextHint  Free-form string — the last user message, the goal
 *                     summary, or whatever caller has handy. Used purely as
 *                     prose context for the LLM.
 */
export async function classifyStylePack(
  session: StudioSession,
  contextHint: string,
): Promise<StylePack> {
  // Tier 1 — LLM
  try {
    if (!process.env.OPENAI_API_KEY) {
      log.warn(
        "maxwell.style-classifier",
        "OPENAI_API_KEY missing — skipping LLM classification, using fallback",
        { session_id: session.id },
      );
      return fallbackByProjectType(session.projectType);
    }

    const { reply } = await chatWithOpenAI({
      model: "gpt-4.1-mini",
      systemPrompt:
        "You are a precise classifier. Reply with exactly one id from the catalogue. No prose, no quotes.",
      prompt: buildClassifierPrompt(session, contextHint),
      // G-D2: tag for monthly LLM-budget attribution. gpt-4.1-mini is
      // ~25x cheaper than gpt-5.5, so this category should stay tiny
      // even with high prototype throughput.
      category: "style_classifier",
      requestId: session.id,
    });

    const candidateId = reply.trim().replace(/^["']|["']$/g, "").toLowerCase();
    const pack = getStylePackById(candidateId);
    if (pack) return pack;

    log.warn(
      "maxwell.style-classifier",
      "LLM returned unknown style id — falling back by projectType",
      { session_id: session.id, raw_reply: reply.slice(0, 60) },
    );
  } catch (error) {
    log.error("maxwell.style-classifier", error, { session_id: session.id });
  }

  // Tier 2 + Tier 3 (handled inside)
  return fallbackByProjectType(session.projectType);
}
