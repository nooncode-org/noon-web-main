/**
 * lib/maxwell/prototype-brief.ts
 *
 * Bloque 11 — server-side prompt builder for v0.
 *
 * Replaces `buildPrototypeBrief()` that used to live in the client
 * (`components/maxwell/studio-shell.tsx`). Two reasons it moved:
 *
 *   1. We now blend in server-only data (the StudioBrief from the brief
 *      extractor, and the classified StylePack with its 3 reference URLs).
 *   2. Keeping prompt construction in one place — the prototype route —
 *      lets us audit what we actually send to v0 from a single grep.
 *
 * Two exports:
 *   - buildPrototypeBrief: full brief for `action: create` (a fresh prototype)
 *   - buildCorrectionBrief: minimal augment for `action: update` (correction)
 *
 * Both are pure functions. The route owns IO (DB reads, v0 calls); this
 * module is straight string assembly so tests are trivial.
 */

import type { StudioBrief, StudioSession } from "./repositories";
import type { StylePack } from "./style-packs";

/**
 * Shape of a chat message accepted by the builder. Loosely typed on purpose:
 * the route maps `StudioMessage` rows down to this shape before calling, so
 * the builder does not need to know about DB/UI message kinds.
 */
export type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
  /**
   * Optional UI type used to filter noise (`thinking`, `system_event`,
   * `error`) from the conversation context. Defaults to "message" if absent.
   */
  type?: string;
};

/**
 * Pull the most recent N actual conversation turns and collapse whitespace.
 * Skips UI-only message types (thinking spinners, system events, error
 * banners) — those have no semantic value for v0 and just inflate tokens.
 *
 * Caller passes the two latest "real" messages explicitly (last user, last
 * assistant) so we always include them even if they were not yet persisted
 * when the snapshot was taken.
 */
function distillContext(
  messages: HistoryMessage[],
  lastUserMsg: string,
  lastAssistantMsg: string,
): string {
  return messages
    .filter((m) => m.type !== "thinking" && m.type !== "system_event" && m.type !== "error")
    .concat(
      { role: "user", content: lastUserMsg },
      { role: "assistant", content: lastAssistantMsg },
    )
    .slice(-8)
    .map((m) => {
      const speaker = m.role === "user" ? "Client" : "Maxwell";
      const compact = m.content.replace(/\s+/g, " ").trim().slice(0, 300);
      return `${speaker}: ${compact}`;
    })
    .join("\n");
}

function buildReferencesBlock(pack: StylePack): string {
  return pack.refs
    .map((ref, i) => (ref.v0Hint ? `${i + 1}. ${ref.url} — ${ref.v0Hint}` : `${i + 1}. ${ref.url}`))
    .join("\n");
}

/**
 * Assemble the full multi-section prompt sent to v0 for an initial prototype.
 *
 * Section structure (each section has a comment header v0 will see):
 *   1. MASTER INSTRUCTION — frontend-only, static mock data, landing exception
 *   2. WHAT TO BUILD       — product summary + type/complexity/lang facts
 *   3. VISUAL DIRECTION    — style family name + feel + 3 reference URLs
 *   4. PRODUCT CONTEXT     — structured brief (only when extractor succeeded)
 *   5. CONVERSATION        — distilled last 8 turns
 *
 * The `brief` parameter is nullable — graceful degradation when the
 * fire-and-forget extractor in chat/route.ts hasn't finished yet. Sections
 * 1/2/3/5 still ship; section 4 is simply omitted.
 */
export function buildPrototypeBrief(
  session: StudioSession,
  brief: StudioBrief | null,
  messages: HistoryMessage[],
  lastUserMsg: string,
  lastAssistantMsg: string,
  stylePack: StylePack,
): string {
  const context = distillContext(messages, lastUserMsg, lastAssistantMsg);
  const references = buildReferencesBlock(stylePack);
  const isLanding = session.projectType === "web_landing";

  const parts: string[] = [];

  // 1. MASTER INSTRUCTION
  parts.push(
    "// ─── 1. MASTER INSTRUCTION ───────────────────────────────────────────────────",
    "Frontend-only prototype. Static mock data only. No backend, no APIs.",
  );
  if (isLanding) {
    // v0's system prompt usually contains "Do NOT build a landing page
    // unless specifically requested." When projectType IS web_landing we
    // override that explicitly so v0 doesn't second-guess us.
    parts.push("EXCEPTION: This project IS a landing page — build it as requested.");
  }
  parts.push("");

  // 2. WHAT TO BUILD
  parts.push(
    "// ─── 2. WHAT TO BUILD ────────────────────────────────────────────────────────",
    "PRODUCT",
    session.goalSummary ?? session.initialPrompt,
    "",
    `TYPE: ${session.projectType ?? "unknown"}   COMPLEXITY: ${session.complexityHint ?? "unknown"}   LANG: ${session.language}`,
    "",
  );

  // 3. VISUAL DIRECTION
  parts.push(
    "// ─── 3. VISUAL DIRECTION ─────────────────────────────────────────────────────",
    `Style family: ${stylePack.name}`,
    `Feel: ${stylePack.feel}`,
    "",
    "References (adapt the aesthetic, not the content):",
    references,
    "",
  );

  // 4. PRODUCT CONTEXT (only when brief is available)
  if (brief) {
    parts.push("// ─── 4. PRODUCT CONTEXT ──────────────────────────────────────────────────────");
    if (brief.objective) parts.push(`Objective: ${brief.objective}`);
    if (brief.users) parts.push(`Users: ${brief.users}`);
    if (brief.primaryUser) parts.push(`Primary user: ${brief.primaryUser}`);
    if (brief.coreFlow) parts.push(`Core flow: ${brief.coreFlow}`);
    if (brief.platform) parts.push(`Platform: ${brief.platform}`);
    if (brief.styleDirection) parts.push(`Style notes: ${brief.styleDirection}`);
    parts.push("");
  }

  // 5. CONVERSATION CONTEXT
  parts.push(
    "// ─── 5. CONVERSATION CONTEXT ────────────────────────────────────────────────",
    context,
  );

  return parts.join("\n").trim();
}

/**
 * Augment a raw correction prompt with the session's persisted style pack so
 * v0 maintains visual consistency across iterations. When no stylePack is
 * available (legacy session pre-Quality-Layer), pass through the prompt
 * unchanged.
 */
export function buildCorrectionBrief(
  correctionPrompt: string,
  stylePack?: StylePack,
): string {
  if (!stylePack) return correctionPrompt;

  const refUrls = stylePack.refs.map((r) => r.url).join(", ");

  return [
    correctionPrompt,
    "",
    "[Visual direction — maintain this]:",
    `Style family: ${stylePack.name}`,
    `Feel: ${stylePack.feel}`,
    `References: ${refUrls}`,
  ].join("\n");
}
