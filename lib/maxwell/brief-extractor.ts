/**
 * lib/maxwell/brief-extractor.ts
 *
 * Bloque 11 — extract a structured `StudioBrief` from the Maxwell chat
 * history and persist it.
 *
 * Called fire-and-forget from `app/api/maxwell/chat/route.ts` when the
 * assistant signals `readyForPrototype`. By the time the user clicks
 * "generate prototype" the brief is (usually) already saved, and the
 * prototype route picks it up via `getStudioBrief()`. If the extractor
 * hasn't finished or failed, the prototype route degrades gracefully
 * (section 4 of the prompt is omitted — see `prototype-brief.ts`).
 *
 * Design constraints:
 *   - NEVER throws. Any error is caught + logged. The user-visible flow
 *     never breaks because a brief extraction failed.
 *   - NEVER calls the LLM with PII raw — the conversation arrives as the
 *     user typed it, which is fine for the LLM (this is a B2B internal
 *     surface), but the catch handler uses the structured logger that
 *     redacts emails / tokens.
 *
 * Model choice: gpt-4.1. The spec doc suggests gpt-5.5, but the model is
 * not confirmed available in our org — we keep the same default as the
 * rest of the codebase. Change in one place when gpt-5.5 is approved.
 */

import { chatWithOpenAI } from "@/lib/api-ia";
import { log } from "@/lib/server/logger";
import { upsertStudioBrief } from "./repositories";

/**
 * Local minimal shape. We do not import `ChatMessage` from `lib/api-ia` to
 * avoid pulling its multi-modal content-parts variant — this extractor only
 * cares about plain text turns.
 */
export type HistoryMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are a product analyst. Extract structured information from this client conversation.
Reply with ONLY a valid JSON object. No explanation, no markdown, no backticks.
Use null for fields not mentioned in the conversation. All values must be strings or null.`;

function buildExtractionPrompt(conversation: string): string {
  return `Extract the following fields from this conversation:
{
  "objective": "what problem this product solves — one sentence",
  "users": "who are all the users of this product",
  "primaryUser": "the single most important user type",
  "coreFlow": "the main user flow — key screens or interactions in order",
  "platform": "web | mobile | both | unknown",
  "integrations": "external services or integrations mentioned, or null",
  "styleDirection": "any visual style preferences mentioned by the client, or null",
  "constraints": "any technical or business constraints mentioned, or null"
}

Conversation:
${conversation}`;
}

/**
 * Strip markdown fences if the model still adds them despite the instruction.
 * GPT-4.1 occasionally wraps JSON in ```json ... ``` even when told not to.
 */
function stripMarkdownFences(raw: string): string {
  return raw.replace(/```json\s*|```\s*$|```/g, "").trim();
}

/**
 * Public entry point. Fire-and-forget — caller does `void extractAndSaveBrief(...)`.
 *
 * On success: a row is written to `studio_brief` for `sessionId`.
 * On failure: the error is logged with a `maxwell.brief-extractor` scope and
 * swallowed. The caller is never affected.
 */
export async function extractAndSaveBrief(
  sessionId: string,
  history: HistoryMessage[],
): Promise<void> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      // Silent skip: dev environments without an OPENAI_API_KEY shouldn't spam
      // error logs every chat turn. The extractor is a quality-improvement
      // layer, not a correctness requirement.
      return;
    }

    const conversation = history
      .map((m) => `${m.role === "user" ? "Client" : "Maxwell"}: ${m.content}`)
      .join("\n");

    const { reply } = await chatWithOpenAI({
      model: "gpt-4.1",
      systemPrompt: SYSTEM_PROMPT,
      prompt: buildExtractionPrompt(conversation),
    });

    const clean = stripMarkdownFences(reply);
    const parsed = JSON.parse(clean) as Record<string, string | null>;

    await upsertStudioBrief({
      studioSessionId: sessionId,
      objective: parsed.objective ?? undefined,
      users: parsed.users ?? undefined,
      primaryUser: parsed.primaryUser ?? undefined,
      coreFlow: parsed.coreFlow ?? undefined,
      platform: parsed.platform ?? undefined,
      integrations: parsed.integrations ?? undefined,
      styleDirection: parsed.styleDirection ?? undefined,
      constraints: parsed.constraints ?? undefined,
    });
  } catch (error) {
    log.error("maxwell.brief-extractor", error, { session_id: sessionId });
  }
}
