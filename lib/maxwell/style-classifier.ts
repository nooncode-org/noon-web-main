/**
 * lib/maxwell/style-classifier.ts
 *
 * Bloque 11 — picks one of the 24 style packs for a studio session.
 * Fase A (Quality Layer v2) — the SAME cheap LLM call now also extracts 2-3
 * English photo-search queries describing the client's business domain
 * ("artisan bakery interior", "fresh sourdough close-up"). They feed the
 * design dossier's real-image search, so v0 receives concrete photography
 * instead of inventing placeholders. One call, two outputs — no extra
 * latency or spend.
 *
 * Strategy (in order, each tier falls back to the next on failure):
 *   1. LLM call with `gpt-4.1-mini` — cheap + low-latency model for a
 *      1-of-24 classification + keyword extraction. JSON contract with a
 *      lenient parser (bare id replies from older prompts still work).
 *   2. Deterministic fallback by `session.projectType` — a hand-mapped
 *      best-guess so the system still returns something useful when the
 *      LLM is unavailable, mis-configured (no OPENAI_API_KEY), or returns
 *      a value we can't recognise. Image queries degrade to [] (the dossier
 *      then leans on the pack's aesthetic imagery terms).
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

export type StyleClassification = {
  pack: StylePack;
  /**
   * English photo-search queries for the project's DOMAIN (not its aesthetic
   * — that lives in the pack token). Empty when the LLM tier was skipped or
   * its reply unusable; callers must treat [] as "no domain imagery".
   */
  imageQueries: string[];
};

/**
 * Hand-mapped fallback when the LLM is unavailable. Conservative on purpose:
 * picks the most-generic-but-still-relevant pack per project type so the
 * worst case is "boring but coherent", never "wrong family".
 */
const PROJECT_TYPE_FALLBACK: Record<string, string> = {
  landing: "clean-professional",
  ecommerce: "commerce-retail",
  webapp: "tech-digital",
  mobile: "tech-digital",
  saas_ai: "tech-digital",
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

  return `Classify this project and extract photo-search terms.

CATALOGUE:
${catalogue}

PROJECT FACTS:
${sessionFacts || "(none captured yet)"}

CLIENT CONTEXT:
${contextHint.slice(0, 1500)}

Reply with ONLY minified JSON, no markdown fences, exactly this shape:
{"pack_id":"<one id from the catalogue>","image_queries":["<q1>","<q2>","<q3>"]}

image_queries rules: 2-3 ENGLISH stock-photo search queries for this business's real-world DOMAIN (concrete nouns a photographer would tag — e.g. "artisan bakery interior", "barista pouring latte"). Never brand names, never UI/abstract terms, never the aesthetic (that is handled separately).`;
}

/**
 * Lenient reply parser. Accepts:
 *   - the requested JSON (with or without ```json fences),
 *   - a bare pack id string (the pre-Fase-A contract) → queries degrade to [].
 * Returns null when no known pack id can be recovered at all.
 */
function parseClassifierReply(
  reply: string,
): { pack: StylePack; imageQueries: string[] } | null {
  const raw = reply.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");

  try {
    const parsed = JSON.parse(raw) as { pack_id?: unknown; image_queries?: unknown };
    if (typeof parsed.pack_id === "string") {
      const pack = getStylePackById(parsed.pack_id.trim().toLowerCase());
      if (pack) {
        const imageQueries = Array.isArray(parsed.image_queries)
          ? parsed.image_queries
              .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
              .map((q) => q.trim())
              .slice(0, 3)
          : [];
        return { pack, imageQueries };
      }
    }
  } catch {
    // Not JSON — fall through to the bare-id path.
  }

  const bareId = raw.replace(/^["']|["']$/g, "").toLowerCase();
  const pack = getStylePackById(bareId);
  return pack ? { pack, imageQueries: [] } : null;
}

/**
 * Public entry point. Always returns a valid StylePack (+ possibly-empty
 * image queries).
 *
 * @param session  Current studio session (read-only; we only consume its facts).
 * @param contextHint  Free-form string — the last user message, the goal
 *                     summary, or whatever caller has handy. Used purely as
 *                     prose context for the LLM.
 */
export async function classifyStylePack(
  session: StudioSession,
  contextHint: string,
): Promise<StyleClassification> {
  // Tier 1 — LLM
  try {
    if (!process.env.OPENAI_API_KEY) {
      log.warn(
        "maxwell.style-classifier",
        "OPENAI_API_KEY missing — skipping LLM classification, using fallback",
        { session_id: session.id },
      );
      return { pack: fallbackByProjectType(session.projectType), imageQueries: [] };
    }

    const { reply } = await chatWithOpenAI({
      model: "gpt-4.1-mini",
      systemPrompt:
        "You are a precise classifier. Reply with exactly the requested minified JSON. No prose, no markdown.",
      prompt: buildClassifierPrompt(session, contextHint),
      // G-D2: tag for monthly LLM-budget attribution. gpt-4.1-mini is
      // ~25x cheaper than gpt-5.5, so this category should stay tiny
      // even with high prototype throughput.
      category: "style_classifier",
      requestId: session.id,
    });

    const parsed = parseClassifierReply(reply);
    if (parsed) return parsed;

    log.warn(
      "maxwell.style-classifier",
      "LLM returned unusable classification — falling back by projectType",
      { session_id: session.id, raw_reply: reply.slice(0, 80) },
    );
  } catch (error) {
    log.error("maxwell.style-classifier", error, { session_id: session.id });
  }

  // Tier 2 + Tier 3 (handled inside)
  return { pack: fallbackByProjectType(session.projectType), imageQueries: [] };
}
