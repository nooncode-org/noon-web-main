/**
 * lib/maxwell/lifecycle-emails.ts
 *
 * B8 #2 + #3 — transactional emails fired after the Maxwell payment +
 * workspace activation lifecycle events:
 *
 *   - `sendPaymentReceivedEmail` (B8 #2) — the client gets a receipt
 *     immediately after Stripe (or manual) confirmation reaches the
 *     `confirmProposalPayment` pipeline. No project details, just
 *     "we got your money + next step" framing. Reassures the client
 *     that the payment landed and the project is moving.
 *
 *   - `sendWorkspaceReadyEmail` (B8 #3) — the client gets the link to
 *     their workspace portal once `client_workspace.workspace_status`
 *     transitions to `active`. This is the handoff moment: from
 *     "proposal sent" to "project live" — the email IS the
 *     onboarding email for the workspace UI.
 *
 *   - `sendMvpReadyEmail` (B8 #4) — the client is told their FIRST
 *     version (the AI-built MVP) is ready to see. Fired by the
 *     `ai-mvp-milestone` webhook on `version-ready`; that milestone is
 *     unique per project (UNIQUE(project_id, kind)), so this is a
 *     once-per-project email — the payoff moment of the purchase.
 *
 * Both emails share infrastructure with the existing proposal email
 * via `email-config.ts`. They use deterministic idempotency keys
 * (`maxwell-payment-<paymentEventId>` and
 * `maxwell-workspace-ready-<workspaceId>`) so a retry never produces a
 * duplicate inbox entry — Resend de-dupes on its end.
 *
 * Send gating — IMPORTANT:
 *   Both senders check `isLifecycleEmailsEnabled()` first. If the env
 *   flag `MAXWELL_LIFECYCLE_EMAILS` is not `"1"`, they return a
 *   sentinel `{ skipped: true, reason: "lifecycle_emails_disabled" }`
 *   without calling Resend. Rationale: this module ships BEFORE the
 *   Resend domain has been verified in production (still ops follow-up
 *   per the FASE 2 handoff). The gate prevents an accidental
 *   "merge B8" → "every paying client gets two emails tomorrow" foot-
 *   gun. Once ops flips the env var in Vercel and reloads, the gate
 *   opens with no redeploy.
 *
 *   The CALLER decides what to do when skipped — typical path: log it
 *   under `maxwell.lifecycle-email` scope (so we can see in the dash
 *   that B8 #2 fired N times today but only K landed) and move on. The
 *   payment/workspace flow MUST NOT fail when these emails are gated.
 *
 * Fire-and-forget contract:
 *   This module does NOT swallow errors when sending is enabled — the
 *   caller decides. The proposal-email pattern (in
 *   `app/api/maxwell/payment/route.ts`) wraps the call in try/catch
 *   and surfaces failure to ops without rolling back the payment
 *   activation. We keep that contract here.
 */

import { resolvePublicBaseUrl } from "./public-url";
import {
  EmailConfigurationError,
  EmailSendError,
  escapeHtml,
  getResendConfig,
  isLifecycleEmailsEnabled,
  isResendConfigured,
  sendViaResend,
  type EmailSendResult,
} from "./email-config";

// Re-export so callers don't need a second import from email-config.
export { EmailConfigurationError, EmailSendError };
export type LifecycleEmailResult =
  | (EmailSendResult & { skipped?: false })
  | { provider: "resend"; messageId: null; skipped: true; reason: LifecycleEmailSkipReason };

export type LifecycleEmailSkipReason =
  | "lifecycle_emails_disabled"
  | "resend_not_configured";

/**
 * Soft check: are both the Resend transport AND the lifecycle gate
 * ready? Useful for UI badges in the ops dashboard that show "B8
 * emails: live / dormant".
 */
export function isLifecycleEmailsReady(): boolean {
  return isResendConfigured() && isLifecycleEmailsEnabled();
}

function buildSkipResult(reason: LifecycleEmailSkipReason): LifecycleEmailResult {
  return { provider: "resend", messageId: null, skipped: true, reason };
}

// ---------------------------------------------------------------------------
// B8 #2 — Payment received
// ---------------------------------------------------------------------------

export type SendPaymentReceivedEmailInput = {
  /** Payment event id (from `payment_event.id`). Used for the idempotency key. */
  paymentEventId: string;
  /** Recipient email — typically `proposal_request.delivery_recipient`. */
  to: string;
  /** Human-readable project title (same one used in the proposal email). */
  projectTitle: string;
  /** Paid amount in major units (e.g. 250 for $250.00). */
  amount: number;
  /** ISO 4217 currency code (e.g. "USD"). */
  currency: string;
  /**
   * Optional reference string surfaced in the body (Stripe payment intent
   * id, manual evidence id, etc.). Helps the client / their accountant
   * match the email to their bank statement.
   */
  paymentReference?: string | null;
  /** Workspace URL (built via `buildWorkspaceUrl`). Click-through to portal. */
  workspaceUrl?: string | null;
};

function formatAmount(amount: number, currency: string): string {
  // Intl.NumberFormat with currency style handles the symbol + decimals
  // per locale. en-US gives "$250.00" / "US$250.00" depending on
  // currency; that's appropriate for a B2B receipt.
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    // Fallback if currency code is not recognised by the runtime ICU
    // database (very unlikely with USD). Better to send a slightly
    // ugly email than to fail the whole send.
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

function buildPaymentReceivedSubject(projectTitle: string): string {
  return `Payment received — ${projectTitle || "your Noon project"}`;
}

function buildPaymentReceivedText(input: SendPaymentReceivedEmailInput): string {
  const lines = [
    "Thanks — your payment has been received.",
    "",
    `Project: ${input.projectTitle}`,
    `Amount: ${formatAmount(input.amount, input.currency)}`,
  ];

  if (input.paymentReference) {
    lines.push(`Reference: ${input.paymentReference}`);
  }

  lines.push(
    "",
    "Your project is now active and the Noon team has been notified to begin execution.",
  );

  if (input.workspaceUrl) {
    lines.push("", `Open your workspace: ${input.workspaceUrl}`);
  }

  lines.push(
    "",
    "If anything looks wrong, reply to this email and the Noon team will help you.",
  );

  return lines.join("\n");
}

function buildPaymentReceivedHtml(input: SendPaymentReceivedEmailInput): string {
  const projectTitle = escapeHtml(input.projectTitle);
  const amount = escapeHtml(formatAmount(input.amount, input.currency));
  const reference = input.paymentReference ? escapeHtml(input.paymentReference) : null;
  const workspaceUrl = input.workspaceUrl ? escapeHtml(input.workspaceUrl) : null;

  const referenceRow = reference
    ? `<br />Reference: <strong>${reference}</strong>`
    : "";

  const workspaceCta = workspaceUrl
    ? `
        <p style="margin:0 0 28px;">
          <a
            href="${workspaceUrl}"
            style="display:inline-block; background:#171412; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:999px; font-size:14px; font-weight:600;"
          >
            Open your workspace
          </a>
        </p>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; background:#f6f3ee; margin:0; padding:32px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5ddd1; border-radius:16px; padding:32px;">
        <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#8a7f71;">Noon receipt</p>
        <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#171412;">Payment received</h1>
        <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#3c342f;">
          Project: <strong>${projectTitle}</strong><br />
          Amount: <strong>${amount}</strong>${referenceRow}
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
}

export async function sendPaymentReceivedEmail(
  input: SendPaymentReceivedEmailInput,
): Promise<LifecycleEmailResult> {
  if (!isLifecycleEmailsEnabled()) {
    return buildSkipResult("lifecycle_emails_disabled");
  }

  // Resolve config eagerly so a missing env var fails LOUD here instead
  // of producing a confusing Resend 401 later.
  const config = getResendConfig();

  return sendViaResend({
    config,
    to: input.to,
    subject: buildPaymentReceivedSubject(input.projectTitle),
    html: buildPaymentReceivedHtml(input),
    text: buildPaymentReceivedText(input),
    idempotencyKey: `maxwell-payment-${input.paymentEventId}`,
    tags: [
      { name: "flow", value: "maxwell_payment_received" },
      { name: "payment_event_id", value: input.paymentEventId },
    ],
  });
}

// ---------------------------------------------------------------------------
// B8 #3 — Workspace ready
// ---------------------------------------------------------------------------

export type SendWorkspaceReadyEmailInput = {
  /** Client workspace id (from `client_workspace.id`). Idempotency key. */
  workspaceId: string;
  /** Recipient email — typically `proposal_request.delivery_recipient`. */
  to: string;
  /** Human-readable project title. */
  projectTitle: string;
  /** Workspace URL (built via `buildWorkspaceUrl`). The whole point of the email. */
  workspaceUrl: string;
};

function buildWorkspaceReadySubject(projectTitle: string): string {
  return `Your workspace is ready — ${projectTitle || "Noon project"}`;
}

function buildWorkspaceReadyText(input: SendWorkspaceReadyEmailInput): string {
  return [
    "Your Noon workspace is ready.",
    "",
    `Project: ${input.projectTitle}`,
    "",
    "You can now see your project status, latest updates, and delivery materials in your workspace.",
    "",
    `Open your workspace: ${input.workspaceUrl}`,
    "",
    "Reply to this email anytime if you need help or have a question for the Noon team.",
  ].join("\n");
}

function buildWorkspaceReadyHtml(input: SendWorkspaceReadyEmailInput): string {
  const projectTitle = escapeHtml(input.projectTitle);
  const workspaceUrl = escapeHtml(input.workspaceUrl);

  return `
    <div style="font-family: Arial, sans-serif; background:#f6f3ee; margin:0; padding:32px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5ddd1; border-radius:16px; padding:32px;">
        <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#8a7f71;">Noon workspace</p>
        <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#171412;">Your workspace is ready</h1>
        <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#3c342f;">
          Project: <strong>${projectTitle}</strong>
        </p>
        <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#3c342f;">
          You can now see your project status, latest updates, and delivery materials in your workspace.
        </p>
        <p style="margin:0 0 28px;">
          <a
            href="${workspaceUrl}"
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
}

export async function sendWorkspaceReadyEmail(
  input: SendWorkspaceReadyEmailInput,
): Promise<LifecycleEmailResult> {
  if (!isLifecycleEmailsEnabled()) {
    return buildSkipResult("lifecycle_emails_disabled");
  }

  const config = getResendConfig();

  return sendViaResend({
    config,
    to: input.to,
    subject: buildWorkspaceReadySubject(input.projectTitle),
    html: buildWorkspaceReadyHtml(input),
    text: buildWorkspaceReadyText(input),
    idempotencyKey: `maxwell-workspace-ready-${input.workspaceId}`,
    tags: [
      { name: "flow", value: "maxwell_workspace_ready" },
      { name: "workspace_id", value: input.workspaceId },
    ],
  });
}

// ---------------------------------------------------------------------------
// B8 #4 — First version (MVP) ready
// ---------------------------------------------------------------------------

export type SendMvpReadyEmailInput = {
  /**
   * App project id (from the milestone payload). Idempotency anchor — the
   * `version-ready` milestone is unique per project, so the key
   * `maxwell-mvp-ready-<projectId>` can never collide with a second send.
   */
  projectId: string;
  /** Recipient email — typically `proposal_request.delivery_recipient`. */
  to: string;
  /** Human-readable project title. */
  projectTitle: string;
  /** Workspace URL (built via `buildWorkspaceUrl`). Primary CTA. */
  workspaceUrl: string;
  /** Direct preview URL from the milestone (`version_url`), when present. */
  previewUrl?: string | null;
};

function buildMvpReadySubject(projectTitle: string): string {
  return `Your first version is ready — ${projectTitle || "your Noon project"}`;
}

function buildMvpReadyText(input: SendMvpReadyEmailInput): string {
  const lines = [
    "Your first version is ready to see.",
    "",
    `Project: ${input.projectTitle}`,
    "",
    "We've built the first working version of your project. Open your workspace to explore it and tell us what to refine.",
    "",
    `Open your workspace: ${input.workspaceUrl}`,
  ];

  if (input.previewUrl) {
    lines.push("", `Or open the version directly: ${input.previewUrl}`);
  }

  lines.push(
    "",
    "Reply to this email anytime if you need help or have a question for the Noon team.",
  );

  return lines.join("\n");
}

function buildMvpReadyHtml(input: SendMvpReadyEmailInput): string {
  const projectTitle = escapeHtml(input.projectTitle);
  const workspaceUrl = escapeHtml(input.workspaceUrl);
  const previewUrl = input.previewUrl ? escapeHtml(input.previewUrl) : null;

  const previewLine = previewUrl
    ? `
        <p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#6a6057;">
          Or open the version directly:
          <a href="${previewUrl}" style="color:#171412;">${previewUrl}</a>
        </p>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; background:#f6f3ee; margin:0; padding:32px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5ddd1; border-radius:16px; padding:32px;">
        <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#8a7f71;">Noon project</p>
        <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#171412;">Your first version is ready</h1>
        <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#3c342f;">
          Project: <strong>${projectTitle}</strong>
        </p>
        <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#3c342f;">
          We&#39;ve built the first working version of your project. Open your workspace to
          explore it and tell us what to refine.
        </p>
        <p style="margin:0 0 28px;">
          <a
            href="${workspaceUrl}"
            style="display:inline-block; background:#171412; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:999px; font-size:14px; font-weight:600;"
          >
            See your project
          </a>
        </p>
        ${previewLine}
        <p style="margin:0; font-size:14px; line-height:1.6; color:#6a6057;">
          Reply to this email anytime if you need help or have a question for the Noon team.
        </p>
      </div>
    </div>
  `.trim();
}

export async function sendMvpReadyEmail(
  input: SendMvpReadyEmailInput,
): Promise<LifecycleEmailResult> {
  if (!isLifecycleEmailsEnabled()) {
    return buildSkipResult("lifecycle_emails_disabled");
  }

  const config = getResendConfig();

  return sendViaResend({
    config,
    to: input.to,
    subject: buildMvpReadySubject(input.projectTitle),
    html: buildMvpReadyHtml(input),
    text: buildMvpReadyText(input),
    idempotencyKey: `maxwell-mvp-ready-${input.projectId}`,
    tags: [
      { name: "flow", value: "maxwell_mvp_ready" },
      { name: "project_id", value: input.projectId },
    ],
  });
}

// ---------------------------------------------------------------------------
// Project escalated — a Noon specialist takes over
// ---------------------------------------------------------------------------
//
// Fired by the `ai-mvp-milestone` webhook on the `escalated` milestone: the AI
// pipeline handed the project to a human. The client sees a REASSURING note
// ("a specialist is on it"), never an alarming "the build failed" — the
// milestone is unique per project, so this is a once-per-project email.

export type SendMvpEscalatedEmailInput = {
  /**
   * App project id (from the milestone payload). Idempotency anchor — the
   * `escalated` milestone is unique per project (UNIQUE(project_id, kind)), so
   * `maxwell-mvp-escalated-<projectId>` can never collide with a second send.
   */
  projectId: string;
  /** Recipient email — typically `proposal_request.delivery_recipient`. */
  to: string;
  /** Human-readable project title. */
  projectTitle: string;
  /** Workspace URL (built via `buildWorkspaceUrl`). Primary CTA. */
  workspaceUrl: string;
};

function buildMvpEscalatedSubject(projectTitle: string): string {
  return `Your project is in expert hands — ${projectTitle || "your Noon project"}`;
}

function buildMvpEscalatedText(input: SendMvpEscalatedEmailInput): string {
  return [
    "A Noon specialist is now on your project.",
    "",
    `Project: ${input.projectTitle}`,
    "",
    "A member of our team is giving your project hands-on attention to make sure it's done exactly right. There's nothing you need to do — we'll keep you posted in your workspace.",
    "",
    `Open your workspace: ${input.workspaceUrl}`,
    "",
    "Reply to this email anytime if you have a question for the Noon team.",
  ].join("\n");
}

function buildMvpEscalatedHtml(input: SendMvpEscalatedEmailInput): string {
  const projectTitle = escapeHtml(input.projectTitle);
  const workspaceUrl = escapeHtml(input.workspaceUrl);

  return `
    <div style="font-family: Arial, sans-serif; background:#f6f3ee; margin:0; padding:32px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5ddd1; border-radius:16px; padding:32px;">
        <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#8a7f71;">Noon project</p>
        <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#171412;">Your project is in expert hands</h1>
        <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#3c342f;">
          Project: <strong>${projectTitle}</strong>
        </p>
        <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#3c342f;">
          A member of our team is giving your project hands-on attention to make sure it&#39;s
          done exactly right. There&#39;s nothing you need to do — we&#39;ll keep you posted in
          your workspace.
        </p>
        <p style="margin:0 0 28px;">
          <a
            href="${workspaceUrl}"
            style="display:inline-block; background:#171412; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:999px; font-size:14px; font-weight:600;"
          >
            Open your workspace
          </a>
        </p>
        <p style="margin:0; font-size:14px; line-height:1.6; color:#6a6057;">
          Reply to this email anytime if you have a question for the Noon team.
        </p>
      </div>
    </div>
  `.trim();
}

export async function sendMvpEscalatedEmail(
  input: SendMvpEscalatedEmailInput,
): Promise<LifecycleEmailResult> {
  if (!isLifecycleEmailsEnabled()) {
    return buildSkipResult("lifecycle_emails_disabled");
  }

  const config = getResendConfig();

  return sendViaResend({
    config,
    to: input.to,
    subject: buildMvpEscalatedSubject(input.projectTitle),
    html: buildMvpEscalatedHtml(input),
    text: buildMvpEscalatedText(input),
    idempotencyKey: `maxwell-mvp-escalated-${input.projectId}`,
    tags: [
      { name: "flow", value: "maxwell_mvp_escalated" },
      { name: "project_id", value: input.projectId },
    ],
  });
}

// `resolvePublicBaseUrl` is re-exported so a caller building the URL
// for the email body can do the resolution + URL construction in one
// import. Keeps the call site:
//
//   const url = buildWorkspaceUrl(session.id);
//   await sendWorkspaceReadyEmail({ workspaceId, to, projectTitle, workspaceUrl: url });
//
// without dragging in `public-url.ts` separately.
export { resolvePublicBaseUrl };
