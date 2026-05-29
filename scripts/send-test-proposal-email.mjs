#!/usr/bin/env node
/**
 * scripts/send-test-proposal-email.mjs
 *
 * Sends a one-off TEST "Your proposal is ready" email — the same email a real
 * client receives after Noon approves a proposal — so you can preview the
 * inbox experience and the "Open proposal" → pay flow end to end.
 *
 * It is self-contained (no TS imports): it hits the Resend HTTP API directly,
 * mirroring `lib/maxwell/email-config.ts` (sendViaResend) and
 * `lib/maxwell/proposal-email.ts` (subject/html/text). It loads `.env.local`
 * automatically if present.
 *
 * Usage:
 *   node scripts/send-test-proposal-email.mjs --to=you@example.com --token=<publicToken>
 *   node scripts/send-test-proposal-email.mjs --to=you@example.com --url=https://app/maxwell/proposal/abc
 *
 * Flags / env:
 *   --to=        recipient (or TEST_EMAIL_TO env). With an unverified Resend
 *                domain, Resend only delivers to the account owner's address.
 *   --token=     proposal publicToken → links to <BASE>/maxwell/proposal/<token>
 *   --url=       full proposal URL (overrides --token)
 *   --title=     project title shown in the email (default: "Noon test project")
 *   --version=   proposal version number (default: 1)
 *   Required env: RESEND_API_KEY, MAIL_FROM   (MAIL_PROVIDER defaults to resend)
 *   Base URL for --token: MAXWELL_PUBLIC_BASE_URL or NEXT_PUBLIC_SITE_URL
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- tiny .env.local loader (only sets keys not already in process.env) ---
function loadEnvLocal() {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(resolve(__dirname, "..", file), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        const key = m[1];
        let val = m[2];
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
      }
    } catch {
      /* file absent — ignore */
    }
  }
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildProposalUrl(args) {
  if (args.url) return args.url;
  const base = (process.env.MAXWELL_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  const token = args.token || "TEST-TOKEN";
  if (!base) {
    throw new Error("Set --url=, or MAXWELL_PUBLIC_BASE_URL / NEXT_PUBLIC_SITE_URL so --token can build the link.");
  }
  return `${base}/maxwell/proposal/${token}`;
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  const replyTo = process.env.MAIL_REPLY_TO?.trim() || undefined;
  const to = (args.to || process.env.TEST_EMAIL_TO || "").trim();
  const projectTitle = args.title || "Noon test project";
  const versionNumber = Number(args.version || "1");
  const validityDays = 15;

  const missing = [];
  if (!apiKey) missing.push("RESEND_API_KEY");
  if (!from) missing.push("MAIL_FROM");
  if (!to) missing.push("--to / TEST_EMAIL_TO");
  if (missing.length) {
    console.error(`Cannot send test email — missing: ${missing.join(", ")}`);
    console.error("Set them in .env.local or pass via flags, then re-run.");
    process.exit(1);
  }

  const publicUrl = buildProposalUrl(args);

  const subject = `Your Noon proposal${projectTitle ? ` - ${projectTitle}` : ""} (v${versionNumber}) [TEST]`;
  const text = [
    "[TEST EMAIL] Your Noon project proposal is ready.",
    "",
    `Project: ${projectTitle}`,
    `Proposal version: v${versionNumber}`,
    `Validity: ${validityDays} days from the first time you open the proposal link.`,
    "",
    `Open your proposal: ${publicUrl}`,
    "",
    "If you would prefer direct assistance, you can reply to this email and the Noon team will help you.",
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; background:#f6f3ee; margin:0; padding:32px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5ddd1; border-radius:16px; padding:32px;">
        <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#8a7f71;">Noon proposal · TEST</p>
        <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#171412;">Your proposal is ready</h1>
        <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#3c342f;">
          Project: <strong>${escapeHtml(projectTitle)}</strong><br />
          Proposal version: <strong>v${versionNumber}</strong>
        </p>
        <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#3c342f;">
          This link stays valid for ${validityDays} days starting from the first time you open it.
        </p>
        <p style="margin:0 0 28px;">
          <a href="${escapeHtml(publicUrl)}" style="display:inline-block; background:#171412; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:999px; font-size:14px; font-weight:600;">Open proposal</a>
        </p>
        <p style="margin:0; font-size:14px; line-height:1.6; color:#6a6057;">
          If you prefer direct assistance, reply to this email and the Noon team will help you.
        </p>
      </div>
    </div>
  `.trim();

  console.log(`Sending TEST proposal email → ${to}`);
  console.log(`  from:  ${from}`);
  console.log(`  link:  ${publicUrl}`);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `maxwell-proposal-test-${to}-${publicUrl}`,
    },
    body: JSON.stringify({ from, to: [to], subject, html, text, replyTo }),
  });

  const body = await response.text();
  if (!response.ok) {
    console.error(`Resend send failed (${response.status}): ${body}`);
    process.exit(1);
  }
  let id = "(unknown)";
  try {
    id = JSON.parse(body).id ?? id;
  } catch {
    /* keep raw */
  }
  console.log(`Sent ✓  Resend message id: ${id}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
