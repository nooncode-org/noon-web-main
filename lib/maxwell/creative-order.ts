/**
 * lib/maxwell/creative-order.ts
 *
 * Fase A · Paso 5 — LA ORDEN (docs/maxwell/fase-a-spec.md §5). One
 * orchestrator call turns the ficha + the conversation into everything
 * the executors need, fixed and complete:
 *
 *   - SHOT LIST per image slot: subject, composition, context, light,
 *     perspective, feeling (the sofa rule — sofá ≠ escritorio) plus
 *     mandatory geometry (ratio, minimum resolution, focal point).
 *   - REAL COPY in the client's language with the business's vocabulary —
 *     zero filler, zero "Elevate your business".
 *   - DATA WITH SHAPE: plausible names, mutually-coherent prices.
 *   - Sections that exist only if their job can be named.
 *
 * Conflict rule (spec §5): when a primary reference ficha exists, its
 * values command; the family token is context, not law.
 *
 * Never throws: LLM/parse failure returns null and the pipeline falls
 * back to today's fixed-bucket imagery search (Regla 0 — the emergency
 * net is this same pipeline degraded, not a rival).
 */

import { chatWithOpenAI } from "@/lib/api-ia";
import { log } from "@/lib/server/logger";
import { resolveOrchestratorModel } from "./model-seats";
import type { ReferenceDossier } from "./reference-study/dossier";
import type { StudioBrief, StudioSession } from "./repositories";
import type { StylePack } from "./style-packs";

export type ShotRole = "hero" | "section" | "portrait" | "background";

export type ShotGeometry = {
  /** Target aspect ratio, e.g. "16:9", "4:3", "1:1". */
  ratio: string;
  minWidthPx: number;
  /** Where the subject must live so the crop survives ("center", "left third"). */
  focalPoint: string;
};

export type ShotSpec = {
  /** Stable slot id — "hero", "section-1", "portrait-2". */
  slotId: string;
  role: ShotRole;
  subject: string;
  composition: string;
  context: string;
  light: string;
  perspective: string;
  feeling: string;
  /** ENGLISH stock-photo query built from the six attributes. */
  searchQuery: string;
  geometry: ShotGeometry;
};

export type CreativeOrder = {
  version: 1;
  shotList: ShotSpec[];
  copy: {
    headline: string;
    subheadline: string;
    primaryCta: string;
    secondaryCta: string;
    sections: { name: string; purpose: string; body: string }[];
  };
  /** Seeded realistic data points ("Croissant de mantequilla — $3.50"). */
  data: { label: string; value: string }[];
  /** Language the copy was written in (the session's). */
  language: string;
};

/** Geometry defaults per role — enforced in code, never trusted from the model. */
const GEOMETRY_DEFAULTS: Record<ShotRole, ShotGeometry> = {
  hero: { ratio: "16:9", minWidthPx: 1600, focalPoint: "center" },
  section: { ratio: "4:3", minWidthPx: 900, focalPoint: "center" },
  portrait: { ratio: "1:1", minWidthPx: 400, focalPoint: "face centered" },
  background: { ratio: "16:9", minWidthPx: 1600, focalPoint: "center" },
};

const ORDER_SYSTEM_PROMPT =
  "You are the creative director writing a complete, executable order for a web prototype. " +
  "Executors follow it verbatim — leave no gap they would fill with something generic. " +
  "FIDELITY RULE: when the reference dossier describes imagery, your shot specs must match its context exactly — " +
  "same kind of subject, composition, setting, light, perspective and feeling. A cozy sofa scene is NOT a desk scene. " +
  "COPY RULES: write in the client's language, with THIS business's vocabulary. " +
  "Banned: lorem ipsum, 'Feature 1/2/3', and buzzwords like streamline, empower, unlock, elevate, seamless, revolutionize (any language). " +
  "Every section must have a job the client would recognise; if you cannot name its job, it does not exist. " +
  "DATA RULE: invented data must have realistic shape — plausible names, prices coherent with each other and the market, recent dates. " +
  "Reply with ONLY minified JSON, no markdown fences, no prose.";

function compactDossierForOrder(dossier: ReferenceDossier): object {
  return {
    sections: dossier.judged.sections,
    heroRecipe: dossier.judged.heroRecipe,
    imagery: dossier.judged.imagery,
    hierarchy: dossier.judged.hierarchy,
    whyItWorks: dossier.judged.whyItWorks,
  };
}

function buildOrderPrompt(params: {
  session: StudioSession;
  brief: StudioBrief | null;
  stylePack: StylePack;
  dossier: ReferenceDossier | null;
  conversationDigest: string;
}): string {
  const { session, brief, stylePack, dossier, conversationDigest } = params;

  const project = {
    build: session.goalSummary ?? session.initialPrompt,
    type: session.projectType ?? "unknown",
    language: session.language,
    objective: brief?.objective ?? null,
    users: brief?.primaryUser ?? brief?.users ?? null,
    coreFlow: brief?.coreFlow ?? null,
  };

  return `PROJECT:
${JSON.stringify(project)}

STYLE FAMILY: ${stylePack.name} — ${stylePack.feel}
FAMILY IMAGERY TERMS: ${stylePack.token.imagery}
${dossier ? `PRIMARY REFERENCE DOSSIER (its values command over the family):\n${JSON.stringify(compactDossierForOrder(dossier))}` : "NO REFERENCE DOSSIER — follow the family terms."}

CONVERSATION (latest turns):
${conversationDigest}

Produce the creative order as minified JSON, exactly this shape:
{"shotList":[{"slotId":"hero","role":"hero|section|portrait|background","subject":"<what is in frame>","composition":"<framing>","context":"<setting that matches the reference world>","light":"<light quality>","perspective":"<camera angle>","feeling":"<one emotion>","searchQuery":"<ENGLISH stock-photo query, concrete nouns>"}],"copy":{"headline":"<in the client's language>","subheadline":"","primaryCta":"","secondaryCta":"","sections":[{"name":"","purpose":"<the section's job>","body":"<1-2 sentences of real copy>"}]},"data":[{"label":"","value":""}]}

Rules: shotList has 1 hero + 2-4 section shots + portraits ONLY if the design truly needs testimonials/team (0-4). slotIds: "hero", "section-1"..., "portrait-1"... searchQuery is ALWAYS English. copy.sections: 3-6 entries mirroring the sections the prototype needs. data: 4-8 realistic points this business would show (products with prices, hours, locations).`;
}

const VALID_ROLES: ReadonlySet<string> = new Set(["hero", "section", "portrait", "background"]);

/**
 * Lenient parser, exported for tests. Requires a non-empty shot list and a
 * headline; everything else defaults safely. Geometry always comes from
 * the role table — deterministic, never model-invented.
 */
export function parseCreativeOrderReply(
  reply: string,
  language: string,
): CreativeOrder | null {
  const raw = reply.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const asString = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

  const shotList: ShotSpec[] = Array.isArray(parsed.shotList)
    ? (parsed.shotList as unknown[])
        .map((s, i) => {
          const obj = (s ?? {}) as Record<string, unknown>;
          const role = VALID_ROLES.has(asString(obj.role))
            ? (asString(obj.role) as ShotRole)
            : "section";
          const slotId = asString(obj.slotId) || `slot-${i + 1}`;
          return {
            slotId,
            role,
            subject: asString(obj.subject),
            composition: asString(obj.composition),
            context: asString(obj.context),
            light: asString(obj.light),
            perspective: asString(obj.perspective),
            feeling: asString(obj.feeling),
            searchQuery: asString(obj.searchQuery),
            geometry: GEOMETRY_DEFAULTS[role],
          };
        })
        .filter((s) => s.subject && s.searchQuery)
        .slice(0, 9)
    : [];

  const copyObj = (parsed.copy ?? {}) as Record<string, unknown>;
  const headline = asString(copyObj.headline);
  if (shotList.length === 0 || !headline) return null;

  const sections = Array.isArray(copyObj.sections)
    ? (copyObj.sections as unknown[])
        .map((s) => {
          const obj = (s ?? {}) as Record<string, unknown>;
          return {
            name: asString(obj.name),
            purpose: asString(obj.purpose),
            body: asString(obj.body),
          };
        })
        .filter((s) => s.name && s.purpose)
        .slice(0, 8)
    : [];

  const data = Array.isArray(parsed.data)
    ? (parsed.data as unknown[])
        .map((d) => {
          const obj = (d ?? {}) as Record<string, unknown>;
          return { label: asString(obj.label), value: asString(obj.value) };
        })
        .filter((d) => d.label && d.value)
        .slice(0, 10)
    : [];

  return {
    version: 1,
    shotList,
    copy: {
      headline,
      subheadline: asString(copyObj.subheadline),
      primaryCta: asString(copyObj.primaryCta),
      secondaryCta: asString(copyObj.secondaryCta),
      sections,
    },
    data,
    language,
  };
}

/**
 * Write the creative order. ONE orchestrator call (token economy — the
 * shot list, copy and data ride together). Null on any failure.
 */
export async function buildCreativeOrder(params: {
  session: StudioSession;
  brief: StudioBrief | null;
  stylePack: StylePack;
  dossier: ReferenceDossier | null;
  conversationDigest: string;
}): Promise<CreativeOrder | null> {
  const { session } = params;
  try {
    if (!process.env.OPENAI_API_KEY) {
      log.warn("maxwell.creative-order", "OPENAI_API_KEY missing — skipping order", {
        session_id: session.id,
      });
      return null;
    }

    const { reply } = await chatWithOpenAI({
      model: resolveOrchestratorModel(),
      systemPrompt: ORDER_SYSTEM_PROMPT,
      prompt: buildOrderPrompt(params),
      category: "creative_order",
      requestId: session.id,
    });

    const order = parseCreativeOrderReply(reply, session.language);
    if (!order) {
      log.warn("maxwell.creative-order", "order reply unusable — degrading to fixed buckets", {
        session_id: session.id,
        raw_head: reply.slice(0, 120),
      });
    }
    return order;
  } catch (error) {
    log.error("maxwell.creative-order", error, { session_id: session.id });
    return null;
  }
}
