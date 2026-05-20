/**
 * lib/upgrade/analyzer.ts
 * AI-powered website audit for the /upgrade module.
 * Uses OpenAI gpt-4.1 via the existing chatWithOpenAI helper.
 */

import { chatWithOpenAI } from "@/lib/api-ia";
import type { PageLike } from "./generator";
import type { AuditJson, QuestionAnswer } from "./types";

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const AUDIT_SYSTEM_PROMPT = `You are a senior digital strategist and web consultant.
Your job is to audit a website and produce a structured, honest, actionable analysis.

You MUST respond with valid JSON only — no markdown fences, no extra text.
The JSON must match this exact structure:

{
  "overallScore": <integer 1-10>,
  "strengths": [<string>, ...],
  "criticalIssues": [<string>, ...],
  "sections": [
    {
      "title": "<section name>",
      "score": <integer 1-10>,
      "findings": [<string>, ...],
      "priority": "<high|medium|low>"
    }
  ],
  "topRecommendations": [<string>, ...]
}

Audit sections you must cover (one object each):
  1. Messaging & Value Proposition
  2. Design & Visual Hierarchy
  3. User Experience & Navigation
  4. Conversion Rate Optimization (CTAs, trust signals)
  5. Content Clarity & Tone

Rules:
- Be specific and actionable. Avoid generic advice.
- Reference actual content from the pages when possible.
- Strengths: 2-4 items. CriticalIssues: 2-5 items. TopRecommendations: exactly 5.
- Scores reflect real quality: 7+ means genuinely good, 4- means real problems.
- Do not invent pages or content not provided to you.`;

// ---------------------------------------------------------------------------
// Build audit prompt
// ---------------------------------------------------------------------------

function buildAuditPrompt(
  pages: PageLike[],
  questionsAnswers: QuestionAnswer[],
  contextNote: string | null,
  mode: string
): string {
  const pagesText = pages
    .map((p) => {
      const text = p.contentText?.slice(0, 3000) ?? "(no text extracted)";
      return `--- PAGE: ${p.url} [${p.pageType}] ---\nTitle: ${p.title ?? "N/A"}\n${text}`;
    })
    .join("\n\n");

  let contextBlock = "";

  if (contextNote) {
    contextBlock += `\nCLIENT NOTE:\n${contextNote}\n`;
  }

  if (questionsAnswers.length > 0) {
    const qaBlock = questionsAnswers
      .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`)
      .join("\n");
    contextBlock += `\nCLIENT Q&A:\n${qaBlock}\n`;
  }

  if (mode === "best_judgment") {
    contextBlock += "\nMode: Use your best professional judgment to audit this website.\n";
  }

  return `Analyze the following website pages and produce the audit JSON.
${contextBlock}
PAGES CRAWLED (${pages.length}):
${pagesText}

Respond with the JSON audit only.`;
}

// ---------------------------------------------------------------------------
// Main audit function
// ---------------------------------------------------------------------------

export type AuditResult =
  | { ok: true; auditJson: AuditJson; summary: string }
  | { ok: false; error: string };

export async function analyzeWebsite(params: {
  pages: PageLike[];
  questionsAnswers: QuestionAnswer[];
  contextNote: string | null;
  mode: string;
}): Promise<AuditResult> {
  const { pages, questionsAnswers, contextNote, mode } = params;

  if (pages.length === 0) {
    return { ok: false, error: "No pages to analyze." };
  }

  const prompt = buildAuditPrompt(pages, questionsAnswers, contextNote, mode);

  let raw: string;
  try {
    const result = await chatWithOpenAI({
      prompt,
      systemPrompt: AUDIT_SYSTEM_PROMPT,
      model: "gpt-4.1",
      // G-D2: tag for monthly LLM-budget attribution.
      category: "upgrade_analyzer",
    });
    raw = result.reply;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "AI analysis failed.",
    };
  }

  // Parse JSON response
  let auditJson: AuditJson;
  try {
    // Strip markdown fences if model added them despite instructions
    const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    auditJson = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: "Failed to parse audit response from AI." };
  }

  // Validate minimum shape
  if (
    typeof auditJson.overallScore !== "number" ||
    !Array.isArray(auditJson.sections) ||
    !Array.isArray(auditJson.topRecommendations)
  ) {
    return { ok: false, error: "AI returned an unexpected audit format." };
  }

  // Build human-readable summary (first critical issue or top recommendation)
  const summary =
    auditJson.criticalIssues?.[0] ??
    auditJson.topRecommendations?.[0] ??
    `Website scored ${auditJson.overallScore}/10 overall.`;

  return { ok: true, auditJson, summary };
}
