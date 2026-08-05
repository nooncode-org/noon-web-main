/**
 * lib/maxwell/reference-study/dossier.ts
 *
 * Fase A · Paso 3, mitad juzgada — "Sol JUZGA lo juzgable" (spec §3).
 * Takes the deterministic measurements + section captures and asks the
 * ORCHESTRATOR seat for everything only an eye can extract: section
 * purposes, hierarchy mechanics, composition, UX patterns, CTA anatomy,
 * imagery treatment, motion, responsive behavior — and the taste field,
 * "why it works".
 *
 * The result is LA FICHA (ReferenceDossier): the structured analysis the
 * creative order and the prompt assembler consume. Governed by the
 * ANTI-ADJECTIVE RULE: every claim carries a value (px, hex, ratio,
 * count, position) or it does not enter. Field vocabulary distilled from
 * the disciplines the owner curated (impeccable / frontend-design /
 * taste) — their method, not their name.
 *
 * Never throws: any LLM/parse failure returns null and the caller
 * degrades to family tokens (Regla 0).
 */

import { chatWithOpenAI } from "@/lib/api-ia";
import { log } from "@/lib/server/logger";
import { resolveOrchestratorModel } from "../model-seats";
import type { ReferenceMeasurements } from "./measure";

export type DossierSection = {
  label: string;
  /** The job this section does — nameable or it doesn't exist. */
  purpose: string;
  /** The layout pattern with values ("split 55/45, image right, 96px gap"). */
  pattern: string;
};

export type ReferenceDossier = {
  version: 1;
  url: string;
  analyzedAt: string;
  /**
   * Deterministic core, embedded so downstream consumers (creative order,
   * prompt assembly) need one object. Desktop is canon; mobile differences
   * live in judged.responsive.
   */
  measured: {
    fonts: { family: string; weights: number[] }[];
    textStyles: ReferenceMeasurements["desktop"]["textStyles"];
    palette: ReferenceMeasurements["desktop"]["palette"];
    containerWidthPx: number | null;
    sectionGapsPx: number[];
    borderRadiiPx: number[];
    buttons: ReferenceMeasurements["desktop"]["buttons"];
  };
  judged: {
    sections: DossierSection[];
    /** How hierarchy is built, with values ("h1 64px/700 vs body 16px/400..."). */
    hierarchy: string;
    composition: string;
    uxPatterns: string[];
    ctas: { placement: string; style: string }[];
    imagery: { subject: string; treatment: string }[];
    motion: string[];
    /** What changes on mobile, with values. */
    responsive: string;
    /** Taste — each entry names a concrete mechanism, not a compliment. */
    whyItWorks: string[];
    /** The hero's exact recipe — the first moment carries the sale. */
    heroRecipe: string;
  };
};

const ANALYST_SYSTEM_PROMPT =
  "You are a senior design analyst producing a build-ready dossier of a reference web page. " +
  "You receive exact CSS measurements plus section-sliced screenshots (desktop sections in page order, then one mobile full-page capture). " +
  "ANTI-ADJECTIVE RULE: every claim must carry a concrete value — px, hex, ratio, count, or position. " +
  "'Generous spacing' is banned; 'about 120px between sections, 24px card gap' is correct. " +
  "Ground every claim in the provided measurements or in what is clearly visible in the captures; never invent values. " +
  "If something cannot be grounded, omit it. Reply with ONLY minified JSON, no markdown fences, no prose.";

function buildAnalysisPrompt(measurements: ReferenceMeasurements): string {
  const digest = {
    url: measurements.url,
    desktop: {
      fonts: measurements.desktop.fonts,
      textStyles: measurements.desktop.textStyles,
      palette: measurements.desktop.palette,
      containerWidthPx: measurements.desktop.containerWidthPx,
      sections: measurements.desktop.sections,
      sectionGapsPx: measurements.desktop.sectionGapsPx,
      borderRadiiPx: measurements.desktop.borderRadiiPx,
      boxShadows: measurements.desktop.boxShadows,
      buttons: measurements.desktop.buttons,
    },
    mobile: {
      textStyles: measurements.mobile.textStyles,
      sections: measurements.mobile.sections.map((s) => ({
        label: s.label,
        heightPx: s.heightPx,
      })),
    },
  };

  return `MEASUREMENTS (exact, from computed CSS):
${JSON.stringify(digest)}

CAPTURES: attached in order — desktop sections top-to-bottom, then mobile full page.

Produce the dossier as minified JSON with exactly this shape:
{"sections":[{"label":"<from measurements>","purpose":"<the job this section does for the visitor>","pattern":"<layout pattern with values>"}],"hierarchy":"<how visual hierarchy is built, quoting sizes and weights>","composition":"<grid, alignment, density — with values>","uxPatterns":["<pattern with placement or count>"],"ctas":[{"placement":"<where>","style":"<colors, radius, size from measurements>"}],"imagery":[{"subject":"<what the photos or graphics show>","treatment":"<crop, ratio, overlay, tone>"}],"motion":["<observed or css-implied motion, else empty array>"],"responsive":"<what changes on mobile, with values>","whyItWorks":["<concrete mechanism that makes this design effective>"],"heroRecipe":"<the hero moment's exact recipe: structure, type scale, palette use, imagery role>"}

Rules: sections mirrors the measured section list (same order, same labels). whyItWorks: 3-5 mechanisms, each naming values or countable structure. Omit nothing you can ground; invent nothing you cannot.`;
}

/**
 * Lenient reply parser, exported for tests. Strips fences, tolerates
 * missing optional arrays, rejects replies without the two load-bearing
 * fields (sections + whyItWorks).
 */
export function parseDossierReply(
  reply: string,
  url: string,
  measurements: ReferenceMeasurements,
): ReferenceDossier | null {
  const raw = reply.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const asString = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      : [];

  const sections: DossierSection[] = Array.isArray(parsed.sections)
    ? (parsed.sections as unknown[])
        .map((s) => {
          const obj = (s ?? {}) as Record<string, unknown>;
          return {
            label: asString(obj.label),
            purpose: asString(obj.purpose),
            pattern: asString(obj.pattern),
          };
        })
        .filter((s) => s.label && s.purpose)
    : [];

  const whyItWorks = asStringArray(parsed.whyItWorks);
  if (sections.length === 0 || whyItWorks.length === 0) return null;

  const pairArray = (v: unknown, a: string, b: string): { [k: string]: string }[] =>
    Array.isArray(v)
      ? (v as unknown[])
          .map((item) => {
            const obj = (item ?? {}) as Record<string, unknown>;
            return { [a]: asString(obj[a]), [b]: asString(obj[b]) };
          })
          .filter((item) => item[a] || item[b])
      : [];

  return {
    version: 1,
    url,
    analyzedAt: new Date().toISOString(),
    measured: {
      fonts: measurements.desktop.fonts,
      textStyles: measurements.desktop.textStyles,
      palette: measurements.desktop.palette,
      containerWidthPx: measurements.desktop.containerWidthPx,
      sectionGapsPx: measurements.desktop.sectionGapsPx,
      borderRadiiPx: measurements.desktop.borderRadiiPx,
      buttons: measurements.desktop.buttons,
    },
    judged: {
      sections,
      hierarchy: asString(parsed.hierarchy),
      composition: asString(parsed.composition),
      uxPatterns: asStringArray(parsed.uxPatterns),
      ctas: pairArray(parsed.ctas, "placement", "style") as {
        placement: string;
        style: string;
      }[],
      imagery: pairArray(parsed.imagery, "subject", "treatment") as {
        subject: string;
        treatment: string;
      }[],
      motion: asStringArray(parsed.motion),
      responsive: asString(parsed.responsive),
      whyItWorks,
      heroRecipe: asString(parsed.heroRecipe),
    },
  };
}

/**
 * Judge one measured reference into its ficha. One orchestrator call,
 * captures attached. Returns null on any failure — caller degrades.
 */
export async function buildReferenceDossier(
  measurements: ReferenceMeasurements,
): Promise<ReferenceDossier | null> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      log.warn("maxwell.reference-study", "OPENAI_API_KEY missing — skipping analysis", {
        url: measurements.url,
      });
      return null;
    }

    const { reply } = await chatWithOpenAI({
      model: resolveOrchestratorModel(),
      systemPrompt: ANALYST_SYSTEM_PROMPT,
      prompt: buildAnalysisPrompt(measurements),
      imageUrls: measurements.captures.map((c) => c.dataUrl),
      category: "reference_analysis",
      requestId: measurements.url.slice(0, 120),
    });

    const dossier = parseDossierReply(reply, measurements.url, measurements);
    if (!dossier) {
      log.warn("maxwell.reference-study", "analysis reply unusable — degrading", {
        url: measurements.url,
        raw_head: reply.slice(0, 120),
      });
    }
    return dossier;
  } catch (error) {
    log.error("maxwell.reference-study", error, { url: measurements.url });
    return null;
  }
}
