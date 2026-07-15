/**
 * lib/auth/signin-policy.ts
 *
 * The pure sign-in gate delegated from auth.ts's `signIn` callback. Kept in its
 * own module so it is unit-testable (like lib/auth/env.ts) without booting
 * NextAuth. Two provider families are allowed; everything else is denied:
 *
 *   - Google: unchanged — require a verified email.
 *   - Email (magic-link): the click phase is already token-validated by
 *     @auth/core, so allow it; the SEND phase gets a per-email throttle here
 *     (this also covers direct POSTs to /api/auth/signin/resend that bypass our
 *     server action).
 */

import { consumeDistributedToken } from "@/lib/server/rate-limit-distributed";

// Loosely-typed shapes — we only read a few fields off what @auth/core passes.
type SignInAccount = { provider?: string; type?: string } | null | undefined;
type SignInProfile = { email?: unknown; email_verified?: unknown } | null | undefined;
type SignInUser = { email?: string | null } | null | undefined;
type SignInEmail = { verificationRequest?: boolean } | undefined;

// Max sign-in emails per address per window (backstop; the action also
// throttles per-IP).
const EMAIL_SEND_LIMIT = 3;
const EMAIL_SEND_WINDOW_SECONDS = 15 * 60;

export type SignInPolicyParams = {
  account: SignInAccount;
  profile?: SignInProfile;
  user?: SignInUser;
  email?: SignInEmail;
};

export async function evaluateSignIn(params: SignInPolicyParams): Promise<boolean> {
  const { account, profile, user, email } = params;

  // ── Email / magic-link ──────────────────────────────────────────────────
  if (account?.type === "email") {
    if (email?.verificationRequest) {
      // SEND phase: throttle per normalized email.
      const address = user?.email?.trim().toLowerCase();
      if (!address) return false;
      const verdict = await consumeDistributedToken({
        namespace: "auth.magiclink.email",
        identityKey: address,
        limit: EMAIL_SEND_LIMIT,
        windowSeconds: EMAIL_SEND_WINDOW_SECONDS,
      });
      return verdict.ok;
    }
    // CLICK phase: the token was already validated by @auth/core.
    return true;
  }

  // ── Google (unchanged) ────────────────────────────────────────────────────
  if (account?.provider !== "google") return false;
  const googleEmail = typeof profile?.email === "string" ? profile.email : "";
  const emailVerified =
    typeof profile?.email_verified === "boolean" ? profile.email_verified : false;
  return Boolean(googleEmail && emailVerified);
}
