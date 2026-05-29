#!/usr/bin/env node
/**
 * scripts/send-test-lifecycle-emails.mjs
 *
 * Sends one-off TEST copies of the three "post-proposal" transactional
 * emails so you can preview the real inbox experience WITHOUT touching the
 * database or the Noon App handoff:
 *
 *   --type=payment    B8 #2 "Payment received"   (lib/maxwell/lifecycle-emails.ts)
 *   --type=workspace  B8 #3 "Workspace ready"    (lib/maxwell/lifecycle-emails.ts)
 *   --type=rejected   Proposal rejected/cancelled (lib/maxwell/proposal-email.ts)
 *
 * It is self-contained (no TS imports): it hits the Resend HTTP API directly,
 * mirroring `sendViaResend` + each sender's subject/html/text/idempotency-key
 * /tags EXACTLY, so the preview matches what a real client would receive. It
 * loads `.env.local` automatically if present. Sibling of
 * `send-test-proposal-email.mjs`.
 *
 * Usage:
 *   node scripts/send-test-lifecycle-emails.mjs --type=payment   --to=you@example.com
 *   node scripts/send-test-lifecycle-emails.mjs --type=workspace --to=you@example.com
 *   node scripts/send-test-lifecycle-emails.mjs --type=rejected  --to=you@example.com --decision=cancelled
 *   node scripts/send-test-lifecycle-emails.mjs --type=payment   --to=you@example.com --twice   # dedupe check
 *
 * Flags / env:
 *   --type=        payment | workspace | rejected            (required)
 *   --to=          recipient (or TEST_EMAIL_TO env). With an unverified Resend
 *                  domain, Resend only delivers to the account owner's address.
 *   --title=       project title (default: "Noon test project")
 *   --amount=      [payment] amount in major units (default: 1250)
 *   --currency=    [payment] ISO 4217 (default: USD)
 *   --reference=   [payment] payment reference shown in the body (optional)
 *   --decision=    [rejected] rejected | cancelled (default: rejected)
 *   --base=        base URL for the workspace link (or MAXWELL_PUBLIC_BASE_URL /
 *                  NEXT_PUBLIC_SITE_URL). Needed for --type=payment|workspace.
 *   --session=     studio session id used in the workspace URL (default: test-session)
 *   --locale=      locale segment in the workspace URL (default: en)
 *   --id=          entity id used in the idempotency key (default: a fixed
 *                  "test-*" id so a re-run with --twice exercises Resend dedupe)
 *   --twice        send the SAME email twice (same idempotency key) to verify
 *                  Resend de-duplicates a retry instead of double-delivering.
 *   --dry-run      build + print the subject / idempotency-key / tags / text
 *                  body WITHOUT calling Resend. Needs no credentials. Use this
 *                  first to inspect the preview before sending anything real.
 *   Required env:  RESEND_API_KEY, MAIL_FROM   (MAIL_PROVIDER defaults to resend)
 *
 * NOTE: this is a preview tool. It does NOT check MAXWELL_LIFECYCLE_EMAILS —
 * the gate guards the production wiring, not this operator preview. It also
 * does NOT write any DB row or call the Noon App. Side effect = one (or two)
 * Resend email(s) to --to only.
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
    const eq = arg.match(/^--([^=]+)=(.*)$/);
    if (eq) {
      out[eq[1]] = eq[2];
      continue;
    }
    const flag = arg.match(/^--([^=]+)$/);
    if (flag) out[flag[1]] = true;
  }
  return out;
}

// Mirror of lib/maxwell/email-config.ts escapeHtml (ampersand first).
function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Mirror of lib/maxwell/lifecycle-emails.ts formatAmount.
function formatAmount(amount, currency) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

function resolveBase(args) {
  const raw = args.base || process.env.MAXWELL_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  return raw.replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// Template builders — byte-for-byte mirrors of the real senders
// ---------------------------------------------------------------------------

function buildPayment(args) {
  const projectTitle = args.title || "Noon test project";
  const amount = Number(args.amount ?? "1250");
  const currency = (args.currency || "USD").toUpperCase();
  const reference = args.reference || null;
  const base = resolveBase(args);
  const session = args.session || "test-session";
  const locale = args.locale || "en";
  const workspaceUrl = base ? `${base}/${locale}/maxwell/workspace/${session}` : null;
  const paymentEventId = args.id || "test-payment-event";

  const amountStr = formatAmount(amount, currency);

  const textLines = [
    "Thanks — your payment has been received.",
    "",
    `Project: ${projectTitle}`,
    `Amount: ${amountStr}`,
  ];
  if (reference) textLines.push(`Reference: ${reference}`);
  textLines.push("", "Your project is now active and the Noon team has been notified to begin execution.");
  if (workspaceUrl) textLines.push("", `Open your workspace: ${workspaceUrl}`);
  textLines.push("", "If anything looks wrong, reply to this email and the Noon team will help you.");

  const referenceRow = reference
    ? `<br />Reference: <strong>${escapeHtml(reference)}</strong>`
    : "";
  const workspaceCta = workspaceUrl
    ? `
        <p style="margin:0 0 28px;">
          <a
            href="${escapeHtml(workspaceUrl)}"
            style="display:inline-block; background:#171412; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:999px; font-size:14px; font-weight:600;"
          >
            Open your workspace
          </a>
        </p>`
    : "";

  const html = `
    <div style="font-family: Arial, sans-serif; background:#f6f3ee; margin:0; padding:32px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5ddd1; border-radius:16px; padding:32px;">
        <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#8a7f71;">Noon receipt</p>
        <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#171412;">Payment received</h1>
        <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#3c342f;">
          Project: <strong>${escapeHtml(projectTitle)}</strong><br />
          Amount: <strong>${escapeHtml(amountStr)}</strong>${referenceRow}
        </p>
        <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#3c342f;">
          Your project is now active and the Noon team has been notified to begin execution.
        </p>
        ${workspaceCta}
        <p style="margin:0; font-size:14px; line-height:1.6; color:#6a6057;">
          If anything looks wrong, reply to this email and the Noon team will help you.
        </p>
      </div>
    </div>
  `.trim();

  return {
    subject: `Payment received — ${projectTitle || "your Noon project"}`,
    html,
    text: textLines.join("\n"),
    idempotencyKey: `maxwell-payment-${paymentEventId}`,
    tags: [
      { name: "flow", value: "maxwell_payment_received" },
      { name: "payment_event_id", value: paymentEventId },
    ],
  };
}

function buildWorkspace(args) {
  const projectTitle = args.title || "Noon test project";
  const base = resolveBase(args);
  const session = args.session || "test-session";
  const locale = args.locale || "en";
  if (!base) {
    throw new Error("Set --base= or MAXWELL_PUBLIC_BASE_URL / NEXT_PUBLIC_SITE_URL — the workspace link IS the email.");
  }
  const workspaceUrl = `${base}/${locale}/maxwell/workspace/${session}`;
  const workspaceId = args.id || "test-workspace";

  const text = [
    "Your Noon workspace is ready.",
    "",
    `Project: ${projectTitle}`,
    "",
    "You can now see your project status, latest updates, and delivery materials in your workspace.",
    "",
    `Open your workspace: ${workspaceUrl}`,
    "",
    "Reply to this email anytime if you need help or have a question for the Noon team.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; background:#f6f3ee; margin:0; padding:32px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5ddd1; border-radius:16px; padding:32px;">
        <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#8a7f71;">Noon workspace</p>
        <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#171412;">Your workspace is ready</h1>
        <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#3c342f;">
          Project: <strong>${escapeHtml(projectTitle)}</strong>
        </p>
        <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#3c342f;">
          You can now see your project status, latest updates, and delivery materials in your workspace.
        </p>
        <p style="margin:0 0 28px;">
          <a
            href="${escapeHtml(workspaceUrl)}"
            style="display:inline-block; background:#171412; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:999px; font-size:14px; font-weight:600;"
          >
            Open your workspace
          </a>
        </p>
        <p style="margin:0; font-size:14px; line-height:1.6; color:#6a6057;">
          Reply to this email anytime if you need help or have a question for the Noon team.
        </p>
      </div>
    </div>
  `.trim();

  return {
    subject: `Your workspace is ready — ${projectTitle || "Noon project"}`,
    html,
    text,
    idempotencyKey: `maxwell-workspace-ready-${workspaceId}`,
    tags: [
      { name: "flow", value: "maxwell_workspace_ready" },
      { name: "workspace_id", value: workspaceId },
    ],
  };
}

function buildRejected(args) {
  // Byte-for-byte mirror of lib/maxwell/proposal-email.ts
  // sendProposalRejectedEmail. `rejected` and `cancelled` share ONE email
  // (handoff 2026-05-29 Decision B) — the decision does NOT change the
  // copy or the tags; --decision is informational only (logged, not sent).
  const projectTitle = args.title || "Noon test project";
  const proposalId = args.id || "test-proposal";
  const versionNumber = Number(args.version || "1");

  const text = [
    "Thank you for your interest in working with Noon.",
    "",
    `After review, we won't be moving forward with this proposal${
      projectTitle ? ` for ${projectTitle}` : ""
    } at this time.`,
    "",
    "If you'd like to discuss alternatives or revisit this in the future, just reply to this email — the Noon team is happy to help.",
  ].join("\n");

  const forProject = projectTitle ? ` for <strong>${escapeHtml(projectTitle)}</strong>` : "";

  const html = `
    <div style="font-family: Arial, sans-serif; background:#f6f3ee; margin:0; padding:32px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5ddd1; border-radius:16px; padding:32px;">
        <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#8a7f71;">Noon proposal</p>
        <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#171412;">Update on your proposal</h1>
        <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#3c342f;">
          Thank you for your interest in working with Noon.
        </p>
        <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#3c342f;">
          After review, we won't be moving forward with this proposal${forProject} at this time.
        </p>
        <p style="margin:0; font-size:14px; line-height:1.6; color:#6a6057;">
          If you'd like to discuss alternatives or revisit this in the future, just reply to this email — the Noon team is happy to help.
        </p>
      </div>
    </div>
  `.trim();

  return {
    subject: `Update on your Noon proposal${projectTitle ? ` — ${projectTitle}` : ""}`,
    html,
    text,
    idempotencyKey: `maxwell-proposal-rejected-${proposalId}`,
    tags: [
      { name: "flow", value: "maxwell_proposal_rejected" },
      { name: "proposal_id", value: proposalId },
      { name: "proposal_version", value: String(versionNumber) },
    ],
  };
}

const BUILDERS = { payment: buildPayment, workspace: buildWorkspace, rejected: buildRejected };

async function sendOnce({ apiKey, from, replyTo, to, email, attempt }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": email.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo,
      tags: email.tags,
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    console.error(`  attempt ${attempt}: Resend send FAILED (${response.status}): ${body}`);
    return { ok: false };
  }
  let id = "(unknown)";
  try {
    id = JSON.parse(body).id ?? id;
  } catch {
    /* keep raw */
  }
  console.log(`  attempt ${attempt}: sent ✓  Resend message id: ${id}`);
  return { ok: true, id };
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  const type = args.type;
  if (!type || !BUILDERS[type]) {
    console.error(`--type must be one of: payment | workspace | rejected (got: ${type ?? "(none)"})`);
    process.exit(1);
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  const replyTo = process.env.MAIL_REPLY_TO?.trim() || undefined;
  const to = (args.to || process.env.TEST_EMAIL_TO || "").trim();
  const dryRun = args["dry-run"] === true || args.dryRun === true;

  // Build first so --dry-run can render even with no credentials. A
  // builder may still throw (e.g. workspace needs a base URL) — that's a
  // real preview error worth surfacing in dry-run too.
  const email = BUILDERS[type](args);

  if (dryRun) {
    console.log(`DRY RUN — nothing is sent. type=${type}`);
    console.log(`  to:       ${to || "(none — pass --to to send for real)"}`);
    console.log(`  subject:  ${email.subject}`);
    console.log(`  idem-key: ${email.idempotencyKey}`);
    console.log(`  tags:     ${email.tags.map((t) => `${t.name}=${t.value}`).join(", ")}`);
    console.log("  --- text body ---");
    console.log(email.text.split("\n").map((l) => `  | ${l}`).join("\n"));
    console.log("  --- end ---");
    return;
  }

  const missing = [];
  if (!apiKey) missing.push("RESEND_API_KEY");
  if (!from) missing.push("MAIL_FROM");
  if (!to) missing.push("--to / TEST_EMAIL_TO");
  if (missing.length) {
    console.error(`Cannot send test email — missing: ${missing.join(", ")}`);
    console.error("Set them in .env.local or pass via flags, then re-run.");
    process.exit(1);
  }

  console.log(`Sending TEST lifecycle email → ${to}`);
  console.log(`  type:     ${type}`);
  console.log(`  from:     ${from}`);
  console.log(`  subject:  ${email.subject}`);
  console.log(`  idem-key: ${email.idempotencyKey}`);
  console.log(`  tags:     ${email.tags.map((t) => `${t.name}=${t.value}`).join(", ")}`);

  const first = await sendOnce({ apiKey, from, replyTo, to, email, attempt: 1 });
  if (!first.ok) process.exit(1);

  if (args.twice) {
    console.log("Re-sending the SAME email (same idempotency key) to verify Resend dedupes a retry...");
    const second = await sendOnce({ apiKey, from, replyTo, to, email, attempt: 2 });
    if (!second.ok) process.exit(1);
    if (second.id === first.id) {
      console.log(`Dedupe OK ✓  both attempts returned the same id (${first.id}) — no second inbox copy.`);
    } else {
      console.log(`Dedupe WARN ⚠  attempt 2 returned a DIFFERENT id (${second.id} vs ${first.id}). Check Resend idempotency config / window.`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
