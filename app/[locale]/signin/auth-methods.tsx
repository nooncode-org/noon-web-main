import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NoonWordmark, NoonMark } from "@/components/brand/noon-logo";
import { normalizeInternalRedirect } from "@/lib/auth/redirect";
import { signInWithGoogleAction } from "./actions";

export type AuthMode = "signup" | "signin";

/**
 * Shared method-chooser screen for the sign-up and sign-in routes. The two modes
 * are near-identical (v0-style) and differ only in copy + the cross-link to the
 * other mode. Auth is intentionally not wired yet — the method buttons are a
 * visual step (follow-up).
 */
const COPY = {
  signup: {
    heading: "Sign up for Maxwell",
    sub: "Use the email you check for work — it's where your Maxwell proposal will land.",
    altPrefix: "Already have an account?",
    altLabel: "Sign In",
    altHref: "/signin/login",
  },
  signin: {
    heading: "Sign in to Maxwell",
    sub: "Sign in to pick up your prompts, prototypes, and proposals.",
    altPrefix: "Don't have an account?",
    altLabel: "Sign Up",
    altHref: "/signin/signup",
  },
} as const;

function GoogleGlyph() {
  return (
    <svg className="sic-ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.87Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.75-2.1-6.69-4.93H1.3v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.31 14.32a7.2 7.2 0 0 1 0-4.63V6.6H1.3a12 12 0 0 0 0 10.81l4.01-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.3 6.6l4.01 3.09C6.25 6.85 8.89 4.75 12 4.75Z" />
    </svg>
  );
}

function AppleGlyph() {
  // Apple's mark is tall-and-narrow, so a same-box icon renders smaller than the
  // Google G. Sized up (21px) so its painted height matches the G's ~18px.
  return (
    <svg className="sic-ic" viewBox="0 0 384 512" width="21" height="21" fill="currentColor" aria-hidden="true">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

export function AuthMethodsScreen({
  mode,
  locale,
  redirectTo,
}: {
  mode: AuthMode;
  locale: string;
  redirectTo?: string;
}) {
  const copy = COPY[mode];
  const lp = (href: string) => `/${locale}${href}`;
  // Preserve the intended post-auth destination as the user crosses between the
  // sign-up and sign-in screens.
  const rt = redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : "";
  // Google is the only wired provider; hand it the sanitized post-auth target.
  const resolvedRedirect = normalizeInternalRedirect(redirectTo, "/maxwell/studio");

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} lgl-rd sic-rd`}>
      <header className="sic-top">
        <Link href={lp("/")} className="sic-top-logo" aria-label="Noon — home">
          <NoonWordmark />
        </Link>
        <Link href={`${lp(copy.altHref)}${rt}`} className="sic-top-alt">
          {copy.altLabel}
        </Link>
      </header>

      <main className="sic-center">
        <div className="sic-col">
          <div className="sic-mark">
            <NoonMark />
          </div>

          <h1 className="sic-title">{copy.heading}</h1>
          <p className="sic-sub">{copy.sub}</p>

          {/* Only Google is wired (Noon's sole real provider). Email + Apple have no
              backend yet, so they render disabled/greyed as a visual step. */}
          <form className="sic-form">
            <input
              type="email"
              className="sic-input"
              placeholder="name@work-email.com"
              autoComplete="email"
              aria-label="Email address"
              disabled
            />
            <button type="button" className="lgl-btn lgl-btn-primary sic-btn" disabled>
              Continue with Email
            </button>
          </form>

          <div className="sic-divider" aria-hidden="true" />

          <div className="sic-providers">
            <form action={signInWithGoogleAction} className="sic-provider-form">
              <input type="hidden" name="redirectTo" value={resolvedRedirect} />
              <button type="submit" className="lgl-btn lgl-btn-secondary sic-btn">
                <GoogleGlyph />
                Continue with Google
              </button>
            </form>
            <button type="button" className="lgl-btn lgl-btn-secondary sic-btn" disabled>
              <AppleGlyph />
              Continue with Apple
            </button>
          </div>

          <p className="sic-alt">
            {copy.altPrefix} <Link href={`${lp(copy.altHref)}${rt}`}>{copy.altLabel}</Link>
          </p>
        </div>
      </main>

      <footer className="sic-legal">
        By proceeding, you agree to creating a Noon account subject to our{" "}
        <Link href={lp("/legal/terms-and-conditions")}>Terms of Service</Link> and{" "}
        <Link href={lp("/legal/privacy-policy")}>Privacy Policy</Link>.
      </footer>
    </div>
  );
}
