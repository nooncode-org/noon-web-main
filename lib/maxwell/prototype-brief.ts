/**
 * lib/maxwell/prototype-brief.ts
 *
 * Bloque 11 — server-side prompt builder for v0.
 * Fase A (Quality Layer v2, 2026-08-02) — the brief now follows v0's OWN
 * published prompting structure and ships with every resource pre-gathered,
 * so v0 has no gap it must fill with something generic:
 *
 *   - v0's official template is "Build [product surface] / Used by [who], in
 *     [what moment], to [what outcome] / Constraints" (vercel.com/blog/
 *     how-to-prompt-v0). Vague prompts measurably make v0 INVENT features —
 *     the exact failure the owner banned ("no quiero cosas extras
 *     inventadas"). Sections 2 and the purpose rules encode that template.
 *   - The style pack's token (exact palette hexes, font pairing) turns
 *     "visual direction" from adjectives into values v0 can paste.
 *   - The design dossier injects REAL hotlinkable photography with role
 *     mapping (hero / sections / people), replacing grey placeholders and
 *     invented image URLs.
 *
 * Section headers 1-5 are a stable contract pinned by tests; Fase A upgrades
 * their CONTENT and inserts the imagery block between 3 and 4.
 *
 * Two exports:
 *   - buildPrototypeBrief: full brief for `action: create` (a fresh prototype)
 *   - buildCorrectionBrief: minimal augment for `action: update` (correction)
 *
 * Both are pure functions. The route owns IO (DB reads, image search, v0
 * calls); this module is straight string assembly so tests are trivial.
 */

import type { StudioBrief, StudioSession } from "./repositories";
import type { StylePack } from "./style-packs";
import { dossierHasImagery, type DesignDossier } from "./design-dossier";

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
 * Role-mapped real imagery. Every URL is a hotlinkable CDN asset found for
 * THIS project before generation — v0 must use exactly these instead of
 * placeholders. Alt text ships alongside so `<img alt>` is real too.
 */
function buildImageryBlock(dossier: DesignDossier): string {
  const lines: string[] = [];

  if (dossier.hero.length > 0) {
    lines.push("HERO (pick 1, use urlLarge-quality for full-bleed):");
    dossier.hero.forEach((img, i) =>
      lines.push(`  H${i + 1}. ${img.urlLarge}  — alt: ${img.alt}`),
    );
  }
  if (dossier.support.length > 0) {
    lines.push("SECTIONS (feature/context imagery):");
    dossier.support.forEach((img, i) =>
      lines.push(`  S${i + 1}. ${img.url}  — alt: ${img.alt}`),
    );
  }
  if (dossier.portraits.length > 0) {
    lines.push("PEOPLE (testimonials, avatars, team — crop to circles/cards as needed):");
    dossier.portraits.forEach((img, i) =>
      lines.push(`  P${i + 1}. ${img.url}  — alt: ${img.alt}`),
    );
  }

  lines.push(
    "",
    "Imagery rules: use ONLY these URLs for photos — never invent image URLs, never use placeholder/grey boxes.",
    "Every <img> gets its real alt text. If a section needs no photo, prefer typography and whitespace over decoration.",
  );

  return lines.join("\n");
}

/**
 * Assemble the full multi-section prompt sent to v0 for an initial prototype.
 *
 * Section structure (each section has a comment header v0 will see):
 *   1. MASTER INSTRUCTION — frontend-only, static mock data, landing exception
 *   2. WHAT TO BUILD       — v0's official Build/Used-by/Outcome template
 *   3. VISUAL DIRECTION    — palette hexes + fonts + style family + references
 *   IMAGERY (conditional)  — real, role-mapped photo URLs from the dossier
 *   4. PRODUCT CONTEXT     — structured brief (only when extractor succeeded)
 *   5. CONVERSATION        — distilled last 8 turns
 *
 * `brief` and `dossier` are nullable — graceful degradation when the
 * fire-and-forget extractor hasn't finished or image search is unconfigured.
 * Sections 1/2/3/5 always ship.
 */
export function buildPrototypeBrief(
  session: StudioSession,
  brief: StudioBrief | null,
  messages: HistoryMessage[],
  lastUserMsg: string,
  lastAssistantMsg: string,
  stylePack: StylePack,
  dossier: DesignDossier | null = null,
): string {
  const context = distillContext(messages, lastUserMsg, lastAssistantMsg);
  const references = buildReferencesBlock(stylePack);
  const isLanding = session.projectType === "landing";
  const { palette, fonts } = stylePack.token;
  const monochrome = palette.accent.toLowerCase() === palette.ink.toLowerCase();

  const parts: string[] = [];

  // 1. MASTER INSTRUCTION
  parts.push(
    "// ─── 1. MASTER INSTRUCTION ───────────────────────────────────────────────────",
    "Frontend-only prototype. Static mock data only. No backend, no APIs.",
    // The purpose rule, up top where it governs everything below. v0's own
    // guidance: insufficient context makes it invent features — so we forbid
    // invention explicitly and give it the test to apply instead.
    "PURPOSE RULE: build ONLY what serves the objective and core flow below. Every section, card and button must have a clear job the client would recognise; if you cannot name its job, leave it out. No invented features, no decorative filler sections.",
  );
  if (isLanding) {
    // v0's system prompt usually contains "Do NOT build a landing page
    // unless specifically requested." When projectType IS landing we
    // override that explicitly so v0 doesn't second-guess us.
    parts.push("EXCEPTION: This project IS a landing page — build it as requested.");
  }
  parts.push("");

  // 2. WHAT TO BUILD — v0's published Build/Used-by/Outcome shape.
  parts.push(
    "// ─── 2. WHAT TO BUILD ────────────────────────────────────────────────────────",
    `Build: ${session.goalSummary ?? session.initialPrompt}`,
  );
  if (brief?.users || brief?.primaryUser) {
    parts.push(`Used by: ${brief.primaryUser ?? brief.users}`);
  }
  if (brief?.objective) {
    parts.push(`To: ${brief.objective}`);
  }
  parts.push(
    `TYPE: ${session.projectType ?? "unknown"}   COMPLEXITY: ${session.complexityHint ?? "unknown"}   UI LANGUAGE: ${session.language}`,
    "All UI copy in the language above — realistic labels and data for THIS business, never lorem ipsum.",
    "",
  );

  // 3. VISUAL DIRECTION — exact values first, prose second.
  parts.push(
    "// ─── 3. VISUAL DIRECTION ─────────────────────────────────────────────────────",
    `Style family: ${stylePack.name}`,
    `Feel: ${stylePack.feel}`,
    `Palette (use these EXACT values): background ${palette.bg} · ink ${palette.ink} · accent ${palette.accent}`,
    monochrome
      ? "Monochrome identity: the accent IS the ink — hierarchy comes from type weight, size and spacing; photography carries the color."
      : "Single-accent discipline: the accent is the ONLY emphasis color (primary actions, active states, key highlights). Everything else stays in background/ink neutrals.",
    `Typography (Google Fonts): "${fonts.display}" for headlines, "${fonts.body}" for everything else. No third family.`,
    "",
    "References (adapt the aesthetic, not the content):",
    references,
    "",
  );

  // IMAGERY — only when the dossier gathered real assets.
  if (dossierHasImagery(dossier)) {
    parts.push(
      "// ─── IMAGERY — REAL ASSETS, GATHERED FOR THIS PROJECT ────────────────────────",
      buildImageryBlock(dossier),
      "",
    );
  }

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
  const { palette, fonts } = stylePack.token;

  return [
    correctionPrompt,
    "",
    "[Visual direction — maintain this]:",
    `Style family: ${stylePack.name}`,
    `Feel: ${stylePack.feel}`,
    `Palette: background ${palette.bg} · ink ${palette.ink} · accent ${palette.accent}`,
    `Typography: "${fonts.display}" headlines / "${fonts.body}" body`,
    `References: ${refUrls}`,
  ].join("\n");
}
