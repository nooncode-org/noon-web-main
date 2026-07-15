import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { checkAuthEnv } from "@/lib/auth/env";
import { isResendConfigured } from "@/lib/maxwell/email-config";
import { sendMagicLinkVerificationRequest } from "@/lib/auth/magic-link-email";
import { createVerificationTokenAdapter } from "@/lib/auth/verification-adapter";
import { evaluateSignIn } from "@/lib/auth/signin-policy";

const envCheck = checkAuthEnv();
if (!envCheck.ok) {
  if (envCheck.mode === "production-runtime") {
    throw new Error(
      `[auth] Google OAuth is required in production but the following env vars are missing or empty: ${envCheck.missing.join(", ")}. ` +
        "Refusing to start. Configure AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET before serving traffic.",
    );
  }
  // Build phase or non-production: warn loud so it is visible in logs.
  console.warn(
    `[auth] Google OAuth is not fully configured (missing ${envCheck.missing.join(", ")}). ` +
      "Sign-in will not work until AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are set.",
  );
}

function isGoogleConfigured() {
  return Boolean(
    process.env.AUTH_GOOGLE_ID?.trim() &&
      process.env.AUTH_GOOGLE_SECRET?.trim(),
  );
}

// Email magic-link is enabled only when BOTH the Resend send path and a
// Postgres URL (for the verification-token adapter) are configured. Without
// them the provider AND adapter are omitted — the app behaves byte-identically
// to the Google-only setup (local/dev, and prod until the env is set), so the
// dev bypass and existing sessions are untouched.
function isEmailSignInConfigured() {
  return (
    isResendConfigured() &&
    Boolean(process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim())
  );
}

const emailEnabled = isEmailSignInConfigured();

const providers = [
  ...(isGoogleConfigured()
    ? [Google({ authorization: { params: { prompt: "select_account" } } })]
    : []),
  ...(emailEnabled
    ? [
        Resend({
          // Unused (sendVerificationRequest is overridden) but set so the
          // provider factory has a defined key.
          apiKey: process.env.RESEND_API_KEY?.trim(),
          from: process.env.MAIL_FROM?.trim(),
          maxAge: 15 * 60, // magic link TTL: 15 minutes
          sendVerificationRequest: sendMagicLinkVerificationRequest,
        }),
      ]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers,
  // The adapter (verification-token persistence) is required by the email
  // provider; only mount it when email sign-in is on so the Google-only path
  // is unchanged.
  adapter: emailEnabled ? createVerificationTokenAdapter() : undefined,
  pages: {
    signIn: "/signin",
    // Branded "we sent you a link" screen (safety net for direct
    // /api/auth/signin entries); the action's inline state is the primary UX.
    verifyRequest: "/signin/check-email",
    // Keep token/config errors (e.g. an expired link → ?error=Verification) on
    // our branded signin page instead of the unbranded default error page.
    error: "/signin",
  },
  callbacks: {
    async signIn({ account, profile, user, email }) {
      return evaluateSignIn({ account, profile, user, email });
    },
    async jwt({ token, user, profile }) {
      if (user?.email) token.email = user.email;
      if (user?.name) token.name = user.name;
      if (user?.image) token.picture = user.image;

      if (typeof profile?.email === "string") token.email = profile.email;
      if (typeof profile?.name === "string") token.name = profile.name;
      if (typeof profile?.picture === "string") token.picture = profile.picture;

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.email === "string") session.user.email = token.email;
        if (typeof token.name === "string") session.user.name = token.name;
        if (typeof token.picture === "string") session.user.image = token.picture;
      }
      return session;
    },
  },
});

export function isGoogleAuthConfigured() {
  return isGoogleConfigured();
}

// Whether email magic-link sign-in is wired (Resend + Postgres). Drives the
// signin UI (real form vs disabled placeholder). Mirrors isGoogleAuthConfigured.
export function isEmailAuthConfigured() {
  return isEmailSignInConfigured();
}

// Dev-only bypass: returns a fake viewer email when Google auth is not
// configured and NODE_ENV is not production. Set DEV_VIEWER_EMAIL in
// .env.local to enable. Never active in production (checked at runtime).
export function getDevBypassEmail(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const email = process.env.DEV_VIEWER_EMAIL?.trim();
  return email && email.length > 0 ? email : null;
}
