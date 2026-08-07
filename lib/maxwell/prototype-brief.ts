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

import type { ClientReferenceReading } from "./client-reference";
import type { CreativeOrder } from "./creative-order";
import { dossierHasImagery, type DesignDossier } from "./design-dossier";
import type { VerifiedSlot } from "./image-verify";
import type { ReferenceDossier } from "./reference-study/dossier";
import type { StudioBrief, StudioSession } from "./repositories";
import type { StylePack } from "./style-packs";

/**
 * Fase A (Entrega 1) — everything the brain adds to the brief, in one bag.
 * All nullable: with `null`/absent pieces the brief degrades to exactly the
 * pre-brain output (modificar-no-sobrescribir: the emergency net is this
 * same assembly, minus blocks).
 */
export type BriefExtras = {
  /** The primary reference's ficha — its values COMMAND over the family token. */
  referenceDossier?: ReferenceDossier | null;
  /**
   * Fase A · E2.4 — what we read from the CLIENT'S own reference (image or
   * page). It outranks everything: they set the direction, we set the
   * execution quality. What it doesn't cover is filled from the family,
   * never invented.
   */
  clientReading?: ClientReferenceReading | null;
  /** The creative order — fixed copy, data and the shot list's intent. */
  order?: CreativeOrder | null;
  /** Customs-approved imagery per slot (replaces the fixed-bucket dossier). */
  verifiedSlots?: VerifiedSlot[] | null;
};

/**
 * Size budget (Fase A §7): the brief must stay compact. If a draft
 * overruns, trimming climbs a ladder that only ever cuts the expendable
 * (old conversation turns, ficha fine detail, the extractor brief) and
 * NEVER the passport (copy, imagery, palette, craft/negative rules).
 * ~15k chars ≈ 3.7k tokens — with the telegraphic style this almost
 * never fires.
 */
const MAX_BRIEF_CHARS = 15_000;

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
  turns = 8,
): string {
  return messages
    .filter((m) => m.type !== "thinking" && m.type !== "system_event" && m.type !== "error")
    .concat(
      { role: "user", content: lastUserMsg },
      { role: "assistant", content: lastAssistantMsg },
    )
    .slice(-turns)
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
 * Fase A — the ficha's values, telegraphic. The primary reference COMMANDS;
 * the family token (already printed above it) stays as fallback context.
 * `detail` trims the judged fine-grain when the size budget bites — the
 * measured values are the passport and always ship.
 */
function buildFichaBlock(ficha: ReferenceDossier, detail: "full" | "essential"): string {
  const m = ficha.measured;
  const lines: string[] = [
    "PRIMARY REFERENCE — measured values. These COMMAND; family values above are fallback:",
    `Fonts: ${m.fonts.map((f) => `${f.family} [${f.weights.join(",")}]`).join(" · ")}`,
  ];

  if (m.textStyles.length > 0) {
    lines.push(
      `Type scale: ${m.textStyles
        .map((t) => `${t.role} ${t.fontSizePx}px/${t.fontWeight} lh${t.lineHeight}${t.letterSpacingPx ? ` ls${t.letterSpacingPx}px` : ""}`)
        .join(" · ")}`,
    );
  }
  if (m.palette.length > 0) {
    lines.push(
      `Palette (dominance order): ${m.palette
        .slice(0, 8)
        .map((c) => `${c.role}:${c.hex}`)
        .join(" · ")}`,
    );
  }
  if (m.containerWidthPx) lines.push(`Container: ${m.containerWidthPx}px`);
  if (m.borderRadiiPx.length > 0) lines.push(`Radii: ${m.borderRadiiPx.join("px, ")}px`);
  if (m.buttons.length > 0) {
    const b = m.buttons[0];
    lines.push(
      `Primary button: bg ${b.backgroundHex ?? "n/a"} · text ${b.textHex ?? "n/a"} · radius ${b.borderRadiusPx}px · ${b.fontSizePx}px`,
    );
  }
  if (ficha.judged.heroRecipe) lines.push(`Hero recipe: ${ficha.judged.heroRecipe}`);
  if (ficha.judged.hierarchy) lines.push(`Hierarchy: ${ficha.judged.hierarchy}`);

  if (detail === "full") {
    if (ficha.judged.sections.length > 0) {
      lines.push(
        "Section patterns:",
        ...ficha.judged.sections
          .slice(0, 8)
          .map((s) => `  - ${s.label}: ${s.pattern} (job: ${s.purpose})`),
      );
    }
    if (ficha.judged.responsive) lines.push(`Responsive: ${ficha.judged.responsive}`);
    if (ficha.judged.whyItWorks.length > 0) {
      lines.push(`Why it works: ${ficha.judged.whyItWorks.slice(0, 4).join(" | ")}`);
    }
  }

  return lines.join("\n");
}

/**
 * Fase A · E2.4 — the CLIENT'S own reference, read and confirmed by them.
 * Printed above the family so its values win: "el cliente manda la
 * dirección; Noon manda la calidad de ejecución".
 */
function buildClientReadingBlock(reading: ClientReferenceReading): string {
  const lines = [
    "CLIENT'S OWN REFERENCE — they chose this direction. It OUTRANKS every value above (family and reference alike):",
    `Direction: ${reading.understood}`,
  ];
  if (reading.palette.length > 0) {
    lines.push(`Palette from their reference (use these): ${reading.palette.join(" · ")}`);
  }
  if (reading.styleNotes.length > 0) {
    lines.push(`Observed: ${reading.styleNotes.join(" · ")}`);
  }
  if (reading.notCovered.length > 0) {
    lines.push(
      `Their reference does not cover: ${reading.notCovered.join(" · ")}.`,
      "For those, follow the family values below — never invent something the client did not ask for.",
    );
  }
  return lines.join("\n");
}

/**
 * Fase A — customs-approved imagery, slot by slot, geometry attached.
 * Empty slots are stated explicitly: v0 must reach for typography there,
 * never for a placeholder (an empty slot beats a wrong photo).
 */
function buildSlotImageryBlock(slots: VerifiedSlot[]): string {
  const lines: string[] = [];
  for (const { slot, image } of slots) {
    const geo = `${slot.geometry.ratio}, focal ${slot.geometry.focalPoint}`;
    if (image) {
      const url = slot.role === "hero" ? image.urlLarge : image.url;
      lines.push(`SLOT ${slot.slotId} [${slot.role}, ${geo}]: ${url}  — alt: ${image.alt}`);
    } else {
      lines.push(
        `SLOT ${slot.slotId} [${slot.role}]: NO APPROVED PHOTO — design this moment with typography and whitespace. Never a placeholder, never an invented URL.`,
      );
    }
  }
  lines.push(
    "",
    "Imagery rules: use ONLY these URLs, each in ITS slot, cropped to the slot's ratio with object-cover anchored on the focal point.",
    "Every <img> gets its real alt text. Sibling images (cards, portraits) render at IDENTICAL sizes — same width, same ratio.",
    "Logos, if any, align by visual height, not by bounding box.",
  );
  return lines.join("\n");
}

/** Fase A — fixed copy & data: content, not suggestion. */
function buildCopyBlock(order: CreativeOrder): string {
  const c = order.copy;
  const lines: string[] = [
    `All copy below is FINAL CONTENT in ${order.language} — use verbatim, do not rewrite, do not translate:`,
    `Headline: ${c.headline}`,
  ];
  if (c.subheadline) lines.push(`Subheadline: ${c.subheadline}`);
  if (c.primaryCta) {
    lines.push(`Primary CTA: ${c.primaryCta}${c.secondaryCta ? `   Secondary CTA: ${c.secondaryCta}` : ""}`);
  }
  if (c.sections.length > 0) {
    lines.push("Sections (each exists because its job is nameable):");
    c.sections.forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s.name} — job: ${s.purpose}`);
      if (s.body) lines.push(`     ${s.body}`);
    });
  }
  if (order.data.length > 0) {
    lines.push(`Data (seeded, realistic): ${order.data.map((d) => `${d.label} — ${d.value}`).join(" · ")}`);
  }
  return lines.join("\n");
}

/**
 * Fase A — the anti-slop Nivel S tells as explicit negative rules with the
 * merit doctrine (docs/maxwell/anti-slop-catalog.md). Ships whenever the
 * brain path is active; the craft rules in the system prompt state what TO
 * do, this block closes the door on the reflexes.
 */
const NEGATIVE_RULES_BLOCK = [
  "BANNED unless the reference explicitly owns the pattern AND its job here is nameable:",
  "- Badge/pill above the H1 ('AI-powered' style).",
  "- Uppercase kicker/eyebrow micro-labels over section titles.",
  "- Colored left-border cards as decoration.",
  "- Purple/violet + cyan on dark as a default palette.",
  "- Decorative glows, halos or radial spotlights.",
  "- Emoji as iconography.",
  "- Buzzwords and invented metrics ('10x', '99%', 'streamline', 'empower') — banned with NO exception.",
  "- The universal template: centered hero + grid of identical icon-top cards.",
  "- Gradient text; 'hand-drawn' SVG illustration.",
  "- Fonts outside the two families named above (no reflexive Inter/Space Grotesk/Instrument Serif).",
  "Merit doctrine: a banned pattern may appear ONLY if the visual direction above demands it and you can name its job.",
].join("\n");

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
 *
 * Fase A: `extras` carries the brain's pieces (ficha, order, verified
 * slots). With extras null/empty the output is byte-identical to the
 * pre-brain brief. Oversized drafts climb the trim ladder (see
 * MAX_BRIEF_CHARS) — the passport never gets cut.
 */
export function buildPrototypeBrief(
  session: StudioSession,
  brief: StudioBrief | null,
  messages: HistoryMessage[],
  lastUserMsg: string,
  lastAssistantMsg: string,
  stylePack: StylePack,
  dossier: DesignDossier | null = null,
  extras: BriefExtras | null = null,
): string {
  for (const trimLevel of [0, 1, 2] as const) {
    const out = assembleBrief(
      session,
      brief,
      messages,
      lastUserMsg,
      lastAssistantMsg,
      stylePack,
      dossier,
      extras,
      trimLevel,
    );
    if (out.length <= MAX_BRIEF_CHARS || trimLevel === 2) return out;
  }
  // Unreachable (level 2 always returns above) — satisfies control flow.
  throw new Error("unreachable");
}

function assembleBrief(
  session: StudioSession,
  brief: StudioBrief | null,
  messages: HistoryMessage[],
  lastUserMsg: string,
  lastAssistantMsg: string,
  stylePack: StylePack,
  dossier: DesignDossier | null,
  extras: BriefExtras | null,
  trimLevel: 0 | 1 | 2,
): string {
  const context = distillContext(
    messages,
    lastUserMsg,
    lastAssistantMsg,
    trimLevel === 0 ? 8 : 4,
  );
  const references = buildReferencesBlock(stylePack);
  const isLanding = session.projectType === "landing";
  const { palette, fonts } = stylePack.token;
  const monochrome = palette.accent.toLowerCase() === palette.ink.toLowerCase();

  const ficha = extras?.referenceDossier ?? null;
  const order = extras?.order ?? null;
  const clientReading = extras?.clientReading ?? null;
  const verifiedSlots =
    extras?.verifiedSlots && extras.verifiedSlots.length > 0 ? extras.verifiedSlots : null;
  const brainActive = Boolean(ficha || order || verifiedSlots || clientReading);

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

  // Fase A — the primary reference's ficha: measured values that COMMAND
  // over the family token printed above (spec §5, conflict rule).
  if (ficha) {
    parts.push(buildFichaBlock(ficha, trimLevel === 2 ? "essential" : "full"), "");
  }

  // Fase A · E2.4 — the client's own reference gets the LAST word of the
  // visual direction: it outranks both the family and any pool ficha.
  if (clientReading) {
    parts.push(buildClientReadingBlock(clientReading), "");
  }

  // IMAGERY — customs-approved slots when the brain ran; otherwise the
  // legacy fixed-bucket dossier (the emergency net, today's behaviour).
  if (verifiedSlots) {
    parts.push(
      "// ─── IMAGERY — CUSTOMS-APPROVED, ONE PHOTO PER SLOT ──────────────────────────",
      buildSlotImageryBlock(verifiedSlots),
      "",
    );
  } else if (dossierHasImagery(dossier)) {
    parts.push(
      "// ─── IMAGERY — REAL ASSETS, GATHERED FOR THIS PROJECT ────────────────────────",
      buildImageryBlock(dossier),
      "",
    );
  }

  // Fase A — fixed copy & data from the creative order: content, not
  // suggestion (spec §7 — "el copy y datos fijos").
  if (order) {
    parts.push(
      "// ─── COPY & DATA — FIXED CONTENT ─────────────────────────────────────────────",
      buildCopyBlock(order),
      "",
    );
  }

  // Fase A — anti-slop Nivel S as explicit negatives (merit doctrine).
  if (brainActive) {
    parts.push(
      "// ─── NEGATIVE RULES — ANTI-SLOP ──────────────────────────────────────────────",
      NEGATIVE_RULES_BLOCK,
      "",
    );
  }

  // 4. PRODUCT CONTEXT (only when brief is available; first casualty of
  // the deepest trim — its facts already live in sections 2 and the copy)
  if (brief && trimLevel < 2) {
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
