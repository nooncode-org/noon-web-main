/**
 * lib/maxwell/proposal-email.ts
 *
 * Sends the "Your proposal is ready" email to the client after the
 * Maxwell proposal review flow completes. The original single sender;
 * the shared Resend primitives live in `email-config.ts` since B8 #2/#3
 * added two more transactional emails (`lifecycle-emails.ts`).
 *
 * The exported names `ProposalEmailConfigurationError`,
 * `ProposalEmailSendError`, `isProposalEmailConfigured`,
 * `sendProposalEmail`, and the type `ProposalEmailResult` are preserved
 * for backward compatibility — existing callers and the existing
 * `tests/maxwell/proposal-email.test.ts` continue to work unchanged.
 */

import {
  EmailConfigurationError as ProposalEmailConfigurationError,
  EmailSendError as ProposalEmailSendError,
  escapeHtml,
  getResendConfig,
  isResendConfigured,
  sendViaResend,
  type EmailSendResult,
} from "./email-config";
import { PROPOSAL_VALIDITY_DAYS } from "./proposal-lifecycle";

// Re-export under the original names so both `instanceof
// ProposalEmailConfigurationError` value checks and
// `function f(err: ProposalEmailConfigurationError)` type annotations
// keep working in existing route handlers and the proposal-email tests.
// Using `import { X as Y }` + `export { Y }` carries both the value AND
// the instance type — a plain `export const Y = X` would only carry the
// value, leaving the type aliased to `typeof X` (constructor) instead
// of the instance type.
export { ProposalEmailConfigurationError, ProposalEmailSendError };
export type ProposalEmailResult = EmailSendResult;

export type SendProposalEmailInput = {
  proposalId: string;
  versionNumber: number;
  to: string;
  publicUrl: string;
  projectTitle: string;
  /**
   * Approved activation amount in major units (e.g. 349 for $349.00), as set
   * by the PM at approval time (`proposal_request.approved_amount_usd`). This
   * is the single payable activation fee the client is charged at checkout —
   * NOT a membership monthly, which is optional, not always offered, and is
   * not stored as a structured field (it only lives inside the proposal text).
   * When present (> 0) the email surfaces it so the client sees the headline
   * number before opening the proposal; when absent — e.g. the SLA auto-send
   * of a still `pending_review`, not-yet-priced proposal — the amount line is
   * omitted entirely and the email is unchanged from its previous form.
   */
  approvedAmountUsd?: number | null;
  /** ISO 4217 currency for `approvedAmountUsd`. Defaults to "USD" when omitted. */
  approvedCurrency?: string | null;
};

export function isProposalEmailConfigured(): boolean {
  return isResendConfigured();
}

/**
 * Formats the activation amount for display. Mirrors `formatAmount` in
 * `lifecycle-emails.ts` (en-US currency style → "$349.00") so the proposal
 * email and the later "Payment received" receipt render the same figure the
 * same way. Falls back to a plain "USD 349.00" if the runtime ICU database
 * does not recognise the currency code (very unlikely with USD) — better a
 * slightly ugly line than a failed send.
 */
function formatActivationAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

/**
 * Returns the formatted activation line (e.g. "$349.00") when a positive
 * approved amount is present, or null when there is nothing to show. Centralises
 * the "do we render the amount?" decision so the text and HTML builders stay
 * in sync.
 */
function resolveActivationLine(input: SendProposalEmailInput): string | null {
  const amount = input.approvedAmountUsd;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return formatActivationAmount(amount, input.approvedCurrency ?? "USD");
}

function buildProposalEmailSubject(projectTitle: string, versionNumber: number): string {
  return `Your Noon proposal${projectTitle ? ` - ${projectTitle}` : ""} (v${versionNumber})`;
}

function buildProposalEmailText(input: SendProposalEmailInput): string {
  const activation = resolveActivationLine(input);

  const lines = [
    "Your Noon project proposal is ready.",
    "",
    `Project: ${input.projectTitle}`,
    `Proposal version: v${input.versionNumber}`,
  ];

  if (activation) {
    lines.push(
      `Activation: ${activation} (payment options and the full breakdown are in your proposal)`,
    );
  }

  lines.push(
    `Validity: ${PROPOSAL_VALIDITY_DAYS} days from the first time you open the proposal link.`,
    "",
    `Open your proposal: ${input.publicUrl}`,
    "",
    "If you would prefer direct assistance, you can reply to this email and the Noon team will help you.",
  );

  return lines.join("\n");
}

function buildProposalEmailHtml(input: SendProposalEmailInput): string {
  const projectTitle = escapeHtml(input.projectTitle);
  const publicUrl = escapeHtml(input.publicUrl);
  const activation = resolveActivationLine(input);

  // Activation row, rendered only when a positive approved amount is present.
  // The muted parenthetical signals the figure is the activation fee and that
  // the payment options (single payment vs. membership) live in the proposal —
  // never implying membership is mandatory.
  const activationRow = activation
    ? `<br />Activation: <strong>${escapeHtml(activation)}</strong>
          <span style="color:#8a7f71;">(payment options and the full breakdown are in your proposal)</span>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; background:#f6f3ee; margin:0; padding:32px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5ddd1; border-radius:16px; padding:32px;">
        <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#8a7f71;">Noon proposal</p>
        <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#171412;">Your proposal is ready</h1>
        <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#3c342f;">
          Project: <strong>${projectTitle}</strong><br />
          Proposal version: <strong>v${input.versionNumber}</strong>${activationRow}
        </p>
        <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#3c342f;">
          This link stays valid for ${PROPOSAL_VALIDITY_DAYS} days starting from the first time you open it.
        </p>
        <p style="margin:0 0 28px;">
          <a
            href="${publicUrl}"
            style="display:inline-block; background:#171412; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:999px; font-size:14px; font-weight:600;"
          >
            Open proposal
          </a>
        </p>
        <p style="margin:0; font-size:14px; line-height:1.6; color:#6a6057;">
          If you prefer direct assistance, reply to this email and the Noon team will help you.
        </p>
      </div>
    </div>
  `.trim();
}

export async function sendProposalEmail(input: SendProposalEmailInput): Promise<ProposalEmailResult> {
  const config = getResendConfig();

  return sendViaResend({
    config,
    to: input.to,
    subject: buildProposalEmailSubject(input.projectTitle, input.versionNumber),
    html: buildProposalEmailHtml(input),
    text: buildProposalEmailText(input),
    idempotencyKey: `maxwell-proposal-${input.proposalId}-v${input.versionNumber}`,
    tags: [
      { name: "flow", value: "maxwell_proposal" },
      { name: "proposal_id", value: input.proposalId },
      { name: "proposal_version", value: String(input.versionNumber) },
    ],
  });
}

/**
 * The decline email sent when a PM/admin rejects OR cancels a proposal in
 * the Noon App (the two share one email — handoff 2026-05-29 Decision B).
 * Deliberately minimal: a respectful "we won't move forward" with the
 * reply-to address as the only path back. There is NO public URL / CTA —
 * the proposal is `expired` and its public page is closed. Mirrors the
 * structure of `sendProposalEmail` and uses the same shared Resend
 * primitives. Ungated, consistent with the live approval email (§6).
 *
 * Note on `changes_requested`: originally it sent no email (2026-05-29
 * Decision A). Superseded by the owner 2026-07-14: the CLIENT is the one who
 * must re-request the proposal, so with no signal they never find out —
 * `sendProposalChangesRequestedEmail` below covers it. The copy asks for
 * their action without exposing the internal review churn.
 */
export type SendProposalRejectedEmailInput = {
  proposalId: string;
  versionNumber: number;
  to: string;
  projectTitle: string;
};

function buildProposalRejectedEmailSubject(projectTitle: string): string {
  return `Update on your Noon proposal${projectTitle ? ` — ${projectTitle}` : ""}`;
}

function buildProposalRejectedEmailText(input: SendProposalRejectedEmailInput): string {
  return [
    "Thank you for your interest in working with Noon.",
    "",
    `After review, we won't be moving forward with this proposal${
      input.projectTitle ? ` for ${input.projectTitle}` : ""
    } at this time.`,
    "",
    "If you'd like to discuss alternatives or revisit this in the future, just reply to this email — the Noon team is happy to help.",
  ].join("\n");
}

function buildProposalRejectedEmailHtml(input: SendProposalRejectedEmailInput): string {
  const projectTitle = escapeHtml(input.projectTitle);
  const forProject = input.projectTitle ? ` for <strong>${projectTitle}</strong>` : "";

  return `
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
}

export async function sendProposalRejectedEmail(
  input: SendProposalRejectedEmailInput,
): Promise<ProposalEmailResult> {
  const config = getResendConfig();

  return sendViaResend({
    config,
    to: input.to,
    subject: buildProposalRejectedEmailSubject(input.projectTitle),
    html: buildProposalRejectedEmailHtml(input),
    text: buildProposalRejectedEmailText(input),
    idempotencyKey: `maxwell-proposal-rejected-${input.proposalId}`,
    tags: [
      { name: "flow", value: "maxwell_proposal_rejected" },
      { name: "proposal_id", value: input.proposalId },
      { name: "proposal_version", value: String(input.versionNumber) },
    ],
  });
}

/**
 * Sent when the Noon App PM requests changes on a proposal (W3, owner decision
 * 2026-07-14, supersedes Decision A). The draft went back to `returned` and the
 * session to `approved_for_proposal` — the CLIENT must re-request the proposal
 * from their studio session, and without this email they get no signal at all.
 * The copy is action-oriented ("request the updated proposal from your studio")
 * and never mentions the internal review loop. The version number in the
 * idempotency key lets a later round of changes (after a re-request bumps the
 * version) send its own email while webhook retries of the SAME round dedupe.
 */
export type SendProposalChangesRequestedEmailInput = {
  proposalId: string;
  versionNumber: number;
  to: string;
  projectTitle: string;
  /** Deep link back to the client's Maxwell studio session. */
  studioUrl: string;
};

function buildProposalChangesRequestedEmailSubject(projectTitle: string): string {
  return `Action needed on your Noon proposal${projectTitle ? ` — ${projectTitle}` : ""}`;
}

function buildProposalChangesRequestedEmailText(
  input: SendProposalChangesRequestedEmailInput,
): string {
  return [
    "We're refining your Noon proposal before sending the formal version.",
    "",
    `Project: ${input.projectTitle}`,
    "",
    "To receive the updated proposal, please return to your Maxwell studio session and request the proposal again when you're ready:",
    input.studioUrl,
    "",
    "If you prefer direct assistance, just reply to this email and the Noon team will help you.",
  ].join("\n");
}

function buildProposalChangesRequestedEmailHtml(
  input: SendProposalChangesRequestedEmailInput,
): string {
  const projectTitle = escapeHtml(input.projectTitle);
  const studioUrl = escapeHtml(input.studioUrl);

  return `
    <div style="font-family: Arial, sans-serif; background:#f6f3ee; margin:0; padding:32px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5ddd1; border-radius:16px; padding:32px;">
        <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#8a7f71;">Noon proposal</p>
        <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#171412;">Your proposal needs one more step</h1>
        <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#3c342f;">
          We're refining your proposal for <strong>${projectTitle}</strong> before sending the formal version.
        </p>
        <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#3c342f;">
          To receive the updated proposal, return to your Maxwell studio session and request it again when you're ready.
        </p>
        <p style="margin:0 0 28px;">
          <a
            href="${studioUrl}"
            style="display:inline-block; background:#171412; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:999px; font-size:14px; font-weight:600;"
          >
            Open your studio session
          </a>
        </p>
        <p style="margin:0; font-size:14px; line-height:1.6; color:#6a6057;">
          If you prefer direct assistance, reply to this email and the Noon team will help you.
        </p>
      </div>
    </div>
  `.trim();
}

export async function sendProposalChangesRequestedEmail(
  input: SendProposalChangesRequestedEmailInput,
): Promise<ProposalEmailResult> {
  const config = getResendConfig();

  return sendViaResend({
    config,
    to: input.to,
    subject: buildProposalChangesRequestedEmailSubject(input.projectTitle),
    html: buildProposalChangesRequestedEmailHtml(input),
    text: buildProposalChangesRequestedEmailText(input),
    idempotencyKey: `maxwell-proposal-changes-${input.proposalId}-v${input.versionNumber}`,
    tags: [
      { name: "flow", value: "maxwell_proposal_changes_requested" },
      { name: "proposal_id", value: input.proposalId },
      { name: "proposal_version", value: String(input.versionNumber) },
    ],
  });
}
