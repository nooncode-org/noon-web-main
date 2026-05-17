/**
 * lib/server/noon-storage.ts
 * Funciones de persistencia legacy (contact leads, maxwell sessions).
 * Migrado de SQLite (node:sqlite) a PostgreSQL (postgres.js / Supabase).
 */

import { getDb } from "@/lib/server/db";
import type { ContactSubmissionInput, ContactTypeOption, ContactInquiryKey } from "@/lib/contact";
import { contactInbox, getContactInquiryDetail } from "@/lib/contact";
import { log } from "@/lib/server/logger";
import type { MaxwellSessionInput } from "@/lib/maxwell";

export function escapeHtml(value: string | null | undefined) {
  return (value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

async function sendContactNotification(lead: ContactLeadRecord): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!apiKey || !from) return;

  const detail = getContactInquiryDetail(lead.inquiry);

  // detail.label / lead.id / createdAt are internal (whitelist label, UUID,
  // server-generated timestamp) and don't need escaping. The five lead fields
  // below come from the public contact form and MUST be escaped.
  const safeLabel = escapeHtml(detail.label);
  const safeName = escapeHtml(lead.name);
  const safeEmail = escapeHtml(lead.email);
  const safeBrief = escapeHtml(lead.brief);
  const safeBudget = lead.budget ? escapeHtml(lead.budget) : null;
  const safeTimeline = lead.timeline ? escapeHtml(lead.timeline) : null;

  const html = `
    <div style="font-family: Arial, sans-serif; background:#f6f3ee; margin:0; padding:32px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5ddd1; border-radius:16px; padding:32px;">
        <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#8a7f71;">New contact — ${safeLabel}</p>
        <h1 style="margin:0 0 20px; font-size:22px; color:#171412;">${safeName}</h1>
        <p style="margin:0 0 8px; font-size:14px; color:#3c342f;"><strong>Email:</strong> ${safeEmail}</p>
        <p style="margin:0 0 8px; font-size:14px; color:#3c342f;"><strong>Type:</strong> ${safeLabel}</p>
        ${lead.budget ? `<p style="margin:0 0 8px; font-size:14px; color:#3c342f;"><strong>Budget:</strong> ${safeBudget}</p>` : ""}
        ${lead.timeline ? `<p style="margin:0 0 8px; font-size:14px; color:#3c342f;"><strong>Timeline:</strong> ${safeTimeline}</p>` : ""}
        <p style="margin:16px 0 8px; font-size:14px; color:#6a6057; font-style:italic; border-left:3px solid #e5ddd1; padding-left:12px;">${safeBrief}</p>
        <p style="margin:16px 0 0; font-size:11px; color:#8a7f71;">Ref: ${lead.id.slice(0, 8).toUpperCase()} · ${new Date(lead.createdAt).toUTCString()}</p>
      </div>
    </div>
  `.trim();

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [contactInbox],
      reply_to: lead.email,
      subject: `[Contact] ${detail.label} — ${lead.name}`.replace(/[\r\n]+/g, " "),
      html,
      tags: [{ name: "flow", value: "contact_lead" }],
    }),
  }).catch((err) => {
    log.error("noon-storage.contact-notification-email", err, {
      blocking: false,
    });
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContactLeadRecord = {
  id: string;
  inquiry: ContactInquiryKey;
  contactType: ContactTypeOption;
  name: string;
  email: string;
  brief: string;
  budget: string | null;
  timeline: string | null;
  source: string | null;
  ipHash: string | null;
  userAgent: string | null;
  originHost: string | null;
  status: string;
  createdAt: string;
};

type ContactLeadSecurityMetadata = {
  ipHash?: string | null;
  userAgent?: string | null;
  originHost?: string | null;
};

export type MaxwellSessionRecord = {
  id: string;
  prompt: string;
  source: string | null;
  status: string;
  firstPromptCapturedAt: string;
  updatedAt: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// ── Contact leads ─────────────────────────────────────────────────────────────

export async function saveContactLead(
  input: ContactSubmissionInput,
  metadata: ContactLeadSecurityMetadata = {}
): Promise<ContactLeadRecord> {
  const sql = getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const budget = normalizeOptionalText(input.budget);
  const timeline = normalizeOptionalText(input.timeline);
  const source = normalizeOptionalText(input.source);
  const ipHash = normalizeOptionalText(metadata.ipHash ?? undefined);
  const userAgent = normalizeOptionalText(metadata.userAgent ?? undefined);
  const originHost = normalizeOptionalText(metadata.originHost ?? undefined);

  await sql`
    INSERT INTO contact_leads (
      id, inquiry, contact_type, full_name, email,
      brief, budget_range, timeline, source,
      ip_hash, user_agent, origin_host, status, created_at
    ) VALUES (
      ${id}, ${input.inquiry}, ${input.contactType}, ${input.name.trim()}, ${input.email.trim()},
      ${input.brief.trim()}, ${budget}, ${timeline}, ${source},
      ${ipHash}, ${userAgent}, ${originHost}, 'new', ${createdAt}
    )
  `;

  const lead: ContactLeadRecord = {
    id,
    inquiry: input.inquiry,
    contactType: input.contactType,
    name: input.name.trim(),
    email: input.email.trim(),
    brief: input.brief.trim(),
    budget,
    timeline,
    source,
    ipHash,
    userAgent,
    originHost,
    status: "new",
    createdAt,
  };

  // Fire-and-forget — never blocks the response
  void sendContactNotification(lead);

  return lead;
}

// ── Maxwell sessions (legacy cookie-based) ────────────────────────────────────

export async function getMaxwellSession(sessionId?: string | null): Promise<MaxwellSessionRecord | null> {
  if (!sessionId) return null;
  const sql = getDb();

  const rows = await sql<{ id: string; prompt: string; source: string | null; status: string; first_prompt_captured_at: string; updated_at: string }[]>`
    SELECT id, prompt, source, status, first_prompt_captured_at, updated_at
    FROM maxwell_sessions
    WHERE id = ${sessionId}
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    prompt: row.prompt,
    source: row.source,
    status: row.status,
    firstPromptCapturedAt: row.first_prompt_captured_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertMaxwellSession(
  input: MaxwellSessionInput & { sessionId?: string | null }
): Promise<MaxwellSessionRecord> {
  const sql = getDb();
  const nextPrompt = input.prompt.trim();
  const nextSource = normalizeOptionalText(input.source);
  const existingSession = await getMaxwellSession(input.sessionId);

  if (existingSession) {
    const updatedAt = new Date().toISOString();
    await sql`
      UPDATE maxwell_sessions
      SET prompt = ${nextPrompt},
          source = COALESCE(${nextSource}, source),
          updated_at = ${updatedAt}
      WHERE id = ${existingSession.id}
    `;
    return {
      ...existingSession,
      prompt: nextPrompt,
      source: nextSource ?? existingSession.source,
      updatedAt,
    };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO maxwell_sessions (id, prompt, source, status, first_prompt_captured_at, updated_at)
    VALUES (${id}, ${nextPrompt}, ${nextSource}, 'captured', ${now}, ${now})
  `;

  return {
    id,
    prompt: nextPrompt,
    source: nextSource,
    status: "captured",
    firstPromptCapturedAt: now,
    updatedAt: now,
  };
}
