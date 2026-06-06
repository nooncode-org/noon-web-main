import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { checkAuthEnv } from "@/lib/auth/env";

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

const providers = isGoogleConfigured()
  ? [
      Google({
        authorization: {
          params: {
            prompt: "select_account",
          },
        },
      }),
    ]
  : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers,
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      const email = typeof profile?.email === "string" ? profile.email : "";
      const emailVerified =
        typeof profile?.email_verified === "boolean"
          ? profile.email_verified
          : false;
      return Boolean(email && emailVerified);
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

// Dev-only bypass: returns a fake viewer email when Google auth is not
// configured and NODE_ENV is not production. Set DEV_VIEWER_EMAIL in
// .env.local to enable. Never active in production (checked at runtime).
export function getDevBypassEmail(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const email = process.env.DEV_VIEWER_EMAIL?.trim();
  return email && email.length > 0 ? email : null;
}
