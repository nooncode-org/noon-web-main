/**
 * lib/upgrade/generator.ts
 * AI-powered upgraded website version generator for the /upgrade module.
 * Uses OpenAI gpt-4.1 via the existing chatWithOpenAI helper.
 */

import { chatWithOpenAI } from "@/lib/api-ia";
import type { CrawledPage } from "./crawler";
import type { AuditJson, VersionJson, QuestionAnswer } from "./types";

// Pages coming from the DB have contentText: string | null
export type PageLike = Pick<CrawledPage, "url" | "title" | "pageType" | "crawlOrder" | "crawlDepth"> & {
  contentText: string | null;
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const GENERATOR_SYSTEM_PROMPT = `You are a senior UX copywriter and conversion specialist.
Your job is to produce an upgraded version of a website's key content and messaging.

You MUST respond with valid JSON only — no markdown fences, no extra text.
The JSON must match this exact structure:

{
  "headline": "<upgraded main headline>",
  "subheadline": "<upgraded subheadline>",
  "valueProposition": "<clear 1-2 sentence value proposition>",
  "ctaText": "<primary call-to-action button copy>",
  "pageSections": [
    {
      "name": "<section name e.g. Hero, About, Services>",
      "current": "<current copy or description (brief)>",
      "upgraded": "<upgraded copy or description>",
      "changeRationale": "<why this change improves the section>"
    }
  ],
  "keyChanges": ["<change 1>", "<change 2>", ...],
  "toneGuidance": "<tone and voice direction for the whole site>"
}

Rules:
- Focus on clarity, conversion, and trust. Cut jargon.
- Reference the actual audit findings to justify your upgrades.
- Cover at minimum: Hero, About, main CTA section.
- keyChanges: 3-6 items summarizing what changed and why.
- toneGuidance: one clear paragraph.
- Upgraded copy must feel natural, professional, and fit the business.
- Do NOT invent new services, features, or false claims.`;

// ---------------------------------------------------------------------------
// Build generation prompt
// ---------------------------------------------------------------------------

function buildGeneratorPrompt(
  pages: PageLike[],
  auditJson: AuditJson,
  questionsAnswers: QuestionAnswer[],
  contextNote: string | null,
  correctionNote: string | null
): string {
  const pagesText = pages
    .slice(0, 5) // focus on top priority pages
    .map((p) => {
      const text = p.contentText?.slice(0, 2000) ?? "(no text extracted)";
      return `--- ${p.url} [${p.pageType}] ---\n${text}`;
    })
    .join("\n\n");

  const auditSummary = `Overall score: ${auditJson.overallScore}/10
Critical issues: ${auditJson.criticalIssues.slice(0, 3).join("; ")}
Top recommendations: ${auditJson.topRecommendations.slice(0, 3).join("; ")}`;

  let contextBlock = `AUDIT SUMMARY:\n${auditSummary}\n`;

  if (contextNote) {
    contextBlock += `\nCLIENT NOTE:\n${contextNote}\n`;
  }

  if (questionsAnswers.length > 0) {
    const qaBlock = questionsAnswers
      .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`)
      .join("\n");
    contextBlock += `\nCLIENT Q&A:\n${qaBlock}\n`;
  }

  if (correctionNote) {
    contextBlock += `\nCORRECTION REQUESTED:\n${correctionNote}\n`;
  }

  return `Based on the audit findings and the existing website content below, generate the upgraded website version JSON.

${contextBlock}
EXISTING WEBSITE CONTENT:
${pagesText}

Respond with the JSON upgraded version only.`;
}

// ---------------------------------------------------------------------------
// Main generator function
// ---------------------------------------------------------------------------

export type GenerateResult =
  | { ok: true; versionJson: VersionJson; summary: string }
  | { ok: false; error: string };

export async function generateUpgradedVersion(params: {
  pages: PageLike[];
  auditJson: AuditJson;
  questionsAnswers: QuestionAnswer[];
  contextNote: string | null;
  correctionNote?: string | null;
}): Promise<GenerateResult> {
  const { pages, auditJson, questionsAnswers, contextNote, correctionNote = null } = params;

  if (pages.length === 0) {
    return { ok: false, error: "No pages available for generation." };
  }

  const prompt = buildGeneratorPrompt(
    pages,
    auditJson,
    questionsAnswers,
    contextNote,
    correctionNote
  );

  let raw: string;
  try {
    const result = await chatWithOpenAI({
      prompt,
      systemPrompt: GENERATOR_SYSTEM_PROMPT,
      model: "gpt-4.1",
      // G-D2: tag for monthly LLM-budget attribution.
      category: "upgrade_generator",
    });
    raw = result.reply;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "AI generation failed.",
    };
  }

  // Parse JSON response
  let versionJson: VersionJson;
  try {
    const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    versionJson = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: "Failed to parse generated version from AI." };
  }

  // Validate minimum shape
  if (
    typeof versionJson.headline !== "string" ||
    !Array.isArray(versionJson.pageSections)
  ) {
    return { ok: false, error: "AI returned an unexpected version format." };
  }

  const summary =
    versionJson.keyChanges?.[0] ??
    `New headline: "${versionJson.headline}"`;

  return { ok: true, versionJson, summary };
}

// ---------------------------------------------------------------------------
// Generate clarifying questions (mode = answer_questions)
// ---------------------------------------------------------------------------

const QUESTIONS_SYSTEM_PROMPT = `You are a strategic website consultant doing a quick intake.
Generate exactly 5 short, smart questions to better understand what matters most to the client before auditing their website.
Questions must be specific to the website content provided.
Do NOT ask generic questions. Be direct and concise.
Respond with a JSON array of 5 strings: ["Question 1", "Question 2", ...]
No markdown fences, no extra text.`;

export type QuestionsResult =
  | { ok: true; questions: string[] }
  | { ok: false; error: string };

export async function generateClarifyingQuestions(params: {
  pages: PageLike[];
}): Promise<QuestionsResult> {
  const { pages } = params;

  const pagesSummary = pages
    .slice(0, 3)
    .map((p) => `${p.url} [${p.pageType}]: ${p.contentText?.slice(0, 500) ?? ""}`)
    .join("\n\n");

  const prompt = `Generate 5 clarifying questions for this website:\n\n${pagesSummary}`;

  let raw: string;
  try {
    const result = await chatWithOpenAI({
      prompt,
      systemPrompt: QUESTIONS_SYSTEM_PROMPT,
      model: "gpt-4.1",
      // G-D2: tag for monthly LLM-budget attribution. "questions"
      // sub-flow within upgrade — same category as the main generator.
      category: "upgrade_generator",
    });
    raw = result.reply;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to generate questions.",
    };
  }

  try {
    const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    const questions = JSON.parse(cleaned);
    if (!Array.isArray(questions) || questions.length === 0) throw new Error();
    return { ok: true, questions: questions.slice(0, 5) };
  } catch {
    return { ok: false, error: "Failed to parse questions from AI." };
  }
}
