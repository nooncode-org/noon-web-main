/**
 * lib/maxwell/email-config.ts
 *
 * Shared primitives for every transactional email Maxwell sends through
 * Resend: config getter, error classes, HTML escaper, and a thin POST
 * helper. Extracted from `proposal-email.ts` (the original sole sender)
 * once we needed two more lifecycle emails (B8 #2 "Payment received" and
 * B8 #3 "Workspace ready") in `lifecycle-emails.ts`.
 *
 * Why factor this out:
 *   - There is exactly ONE Resend account / API surface. Duplicating the
 *     env-var parser across files would mean three places to touch when
 *     adding a config knob (region, custom domain, etc.) and three places
 *     to keep in sync if a typo creeps in.
 *   - The error taxonomy (configuration vs send) is the contract callers
 *     pattern-match on (`error instanceof EmailConfigurationError`). A
 *     single class hierarchy means the proposal route and the payment
 *     route handle config errors the same way.
 *   - Idempotency-Key construction is identical across emails — caller
 *     supplies a deterministic key, helper enforces the convention.
 *
 * Backward compatibility:
 *   `proposal-email.ts` re-exports `ProposalEmailConfigurationError` and
 *   `ProposalEmailSendError` as aliases for the generic classes, so the
 *   existing `instanceof` checks in callers and the existing
 *   `proposal-email.test.ts` keep working unchanged.
 *
 * Send gating (operational safety):
 *   `isLifecycleEmailsEnabled()` reads `MAXWELL_LIFECYCLE_EMAILS=1`.
 *   The new payment / workspace-ready senders honor this flag so the
 *   code can land + be reviewed + be tested in CI long before the Resend
 *   domain is verified in production — once verified, ops flips the env
 *   var without a redeploy. The existing `sendProposalEmail` is NOT
 *   gated (it has been sending for weeks).
 */

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export class EmailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailSendError";
  }
}

export type ResendConfig = {
  provider: "resend";
  apiKey: string;
  from: string;
  replyTo: string | null;
};

export type EmailSendResult = {
  provider: "resend";
  messageId: string;
};

/**
 * Parses env into a fully-resolved Resend config or throws. Trim is used
 * defensively because Vercel UI sometimes pastes a trailing newline that
 * silently breaks the auth header in production but works fine locally.
 */
export function getResendConfig(): ResendConfig {
  const provider = process.env.MAIL_PROVIDER?.trim().toLowerCase() || "resend";
  if (provider !== "resend") {
    throw new EmailConfigurationError(
      `Unsupported MAIL_PROVIDER "${provider}". Configure MAIL_PROVIDER=resend.`,
    );
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  const replyTo = process.env.MAIL_REPLY_TO?.trim() || null;

  if (!apiKey) {
    throw new EmailConfigurationError("RESEND_API_KEY is not configured.");
  }

  if (!from) {
    throw new EmailConfigurationError("MAIL_FROM is not configured.");
  }

  return { provider: "resend", apiKey, from, replyTo };
}

/**
 * Soft check used by `isProposalEmailConfigured` and
 * `isLifecycleEmailsConfigured` for UI surfaces ("hide the 'resend' button
 * if Resend isn't wired") that should never throw.
 */
export function isResendConfigured(): boolean {
  try {
    getResendConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * `MAXWELL_LIFECYCLE_EMAILS` is an opt-in feature gate for the new
 * payment / workspace-ready senders. Default OFF — required because the
 * Resend domain is not yet verified in prod and we do NOT want to flip
 * "merge B8" into "every paying client gets an email tomorrow." Ops sets
 * `MAXWELL_LIFECYCLE_EMAILS=1` after the Resend domain handshake +
 * smoke test, without a redeploy.
 */
export function isLifecycleEmailsEnabled(): boolean {
  return process.env.MAXWELL_LIFECYCLE_EMAILS === "1";
}

/**
 * HTML-escape user-supplied strings before interpolating into the
 * template. Centralised so any future improvement (e.g. switching to a
 * proper templater that auto-escapes) happens in one place.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type SendViaResendInput = {
  config: ResendConfig;
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Caller-supplied deterministic idempotency key. Same input → same
   * key → Resend returns the original id instead of double-sending.
   * Convention: `maxwell-<flow>-<entityId>[-<sub>]`. Examples:
   *   - `maxwell-proposal-<id>-v<n>`
   *   - `maxwell-payment-<paymentEventId>`
   *   - `maxwell-workspace-ready-<workspaceId>`
   */
  idempotencyKey: string;
  /** Optional Resend tags for inbox filtering / analytics. */
  tags?: Array<{ name: string; value: string }>;
};

/**
 * Thin wrapper around the Resend HTTP API. Throws `EmailSendError` on
 * any non-2xx or missing id. Callers wrap their own `try { send } catch
 * (error) { log.error(...) }` — this helper does NOT swallow errors
 * (because some flows want to retry / surface failure to the operator).
 */
export async function sendViaResend(input: SendViaResendInput): Promise<EmailSendResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: input.config.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.config.replyTo ?? undefined,
      tags: input.tags,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new EmailSendError(
      `Resend email send failed with status ${response.status}: ${responseText}`,
    );
  }

  const data = (await response.json()) as { id?: string };
  if (!data.id) {
    throw new EmailSendError("Resend email send succeeded without a message id.");
  }

  return { provider: "resend", messageId: data.id };
}
