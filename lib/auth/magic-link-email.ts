/**
 * lib/auth/magic-link-email.ts
 *
 * The branded sign-in email for the Auth.js email (magic-link) provider.
 * Reuses the shared Resend primitives (lib/maxwell/email-config.ts) and mirrors
 * the proposal email's Noon branding (cream #f6f3ee / dark #171412, rounded
 * CTA). Wired into auth.ts as the provider's `sendVerificationRequest` override,
 * which is why `provider.apiKey` goes unused — we hit Resend through our own
 * helper for consistent branding + idempotency + tags.
 */

import { createHash } from "node:crypto";
import { getResendConfig, escapeHtml, sendViaResend } from "@/lib/maxwell/email-config";

const LINK_TTL_MINUTES = 15;

export function buildMagicLinkEmailSubject(): string {
  return "Your Noon sign-in link";
}

export function buildMagicLinkEmailHtml(url: string): string {
  const safeUrl = escapeHtml(url);
  return `
    <div style="font-family: Arial, sans-serif; background:#f6f3ee; margin:0; padding:32px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5ddd1; border-radius:16px; padding:32px;">
        <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#8a7f71;">Noon</p>
        <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#171412;">Sign in to Maxwell</h1>
        <p style="margin:0 0 24px; font-size:16px; line-height:1.6; color:#3c342f;">
          Click the button below to sign in. This link is valid for ${LINK_TTL_MINUTES} minutes and can be used once.
        </p>
        <p style="margin:0 0 28px;">
          <a
            href="${safeUrl}"
            style="display:inline-block; background:#171412; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:999px; font-size:14px; font-weight:600;"
          >
            Sign in to Maxwell
          </a>
        </p>
        <p style="margin:0; font-size:14px; line-height:1.6; color:#6a6057;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    </div>
  `.trim();
}

export function buildMagicLinkEmailText(url: string): string {
  return [
    "Sign in to Maxwell",
    "",
    `Use this link to sign in (valid for ${LINK_TTL_MINUTES} minutes, one-time use):`,
    url,
    "",
    "If you didn't request this, you can safely ignore this email.",
  ].join("\n");
}

/**
 * Matches Auth.js's `sendVerificationRequest` signature (it passes more fields —
 * expires, provider, token, theme, request — we only need identifier + url +
 * token). Throws on a Resend failure so @auth/core surfaces the send error to
 * the caller instead of pretending the link went out.
 */
export async function sendMagicLinkVerificationRequest(params: {
  identifier: string;
  url: string;
  token: string;
}): Promise<void> {
  const config = getResendConfig();
  // Deterministic per-send key from the (already-hashed) token — never the raw
  // link value, and unique enough that a resend isn't deduped away.
  const idempotencyKey = `auth-magiclink-${createHash("sha256")
    .update(params.token)
    .digest("hex")
    .slice(0, 24)}`;

  await sendViaResend({
    config,
    to: params.identifier,
    subject: buildMagicLinkEmailSubject(),
    html: buildMagicLinkEmailHtml(params.url),
    text: buildMagicLinkEmailText(params.url),
    idempotencyKey,
    tags: [{ name: "flow", value: "auth_magic_link" }],
  });
}
