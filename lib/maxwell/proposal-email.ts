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
};

export function isProposalEmailConfigured(): boolean {
  return isResendConfigured();
}

function buildProposalEmailSubject(projectTitle: string, versionNumber: number): string {
  return `Your Noon proposal${projectTitle ? ` - ${projectTitle}` : ""} (v${versionNumber})`;
}

function buildProposalEmailText(input: SendProposalEmailInput): string {
  return [
    "Your Noon project proposal is ready.",
    "",
    `Project: ${input.projectTitle}`,
    `Proposal version: v${input.versionNumber}`,
    `Validity: ${PROPOSAL_VALIDITY_DAYS} days from the first time you open the proposal link.`,
    "",
    `Open your proposal: ${input.publicUrl}`,
    "",
    "If you would prefer direct assistance, you can reply to this email and the Noon team will help you.",
  ].join("\n");
}

function buildProposalEmailHtml(input: SendProposalEmailInput): string {
  const projectTitle = escapeHtml(input.projectTitle);
  const publicUrl = escapeHtml(input.publicUrl);

  return `
    <div style="font-family: Arial, sans-serif; background:#f6f3ee; margin:0; padding:32px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5ddd1; border-radius:16px; padding:32px;">
        <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#8a7f71;">Noon proposal</p>
        <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#171412;">Your proposal is ready</h1>
        <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#3c342f;">
          Project: <strong>${projectTitle}</strong><br />
          Proposal version: <strong>v${input.versionNumber}</strong>
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
