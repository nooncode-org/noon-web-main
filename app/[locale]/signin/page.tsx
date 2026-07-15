import { redirect } from "next/navigation";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ArrowUp, Plus } from "lucide-react";
import { auth } from "@/auth";
import { normalizeInternalRedirect } from "@/lib/auth/redirect";
import { NoonMark } from "@/components/brand/noon-logo";
import { SignInModalShell } from "./signin-modal-shell";
import "@/app/_components/site/legal-rd.css";
import "./signin-rd.css";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
};

/**
 * Maps an Auth.js error code (or our own) to friendly copy. Known codes only —
 * anything unrecognized becomes a generic message rather than reflecting raw
 * query text back into the page.
 */
function mapSignInError(code?: string): string | null {
  if (!code) return null;
  switch (code) {
    case "Verification":
      return "That sign-in link expired or was already used — request a new one below.";
    case "AccessDenied":
      return "Too many sign-in attempts. Please wait a few minutes and try again.";
    case "GoogleSignInFailed":
      return "Could not start Google sign-in. Please try again.";
    case "Configuration":
      return "Sign-in is temporarily unavailable. Please try again shortly.";
    default:
      return "Something went wrong signing in. Please try again.";
  }
}

export default async function SignInPage({ params, searchParams }: Props) {
  const [{ locale }, { redirectTo: rawRedirectTo, error }, session] = await Promise.all([
    params,
    searchParams,
    auth(),
  ]);

  const redirectTo = normalizeInternalRedirect(rawRedirectTo, `/${locale}`);
  const authQuery = rawRedirectTo ? `?redirectTo=${encodeURIComponent(rawRedirectTo)}` : "";

  if (session?.user?.email) {
    redirect(redirectTo);
  }

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} lgl-rd si-rd`}>
      {/* ── Dimmed product backdrop (decorative — the Maxwell home behind) ──── */}
      <div className="si-bg" aria-hidden="true">
        <div className="si-bg-nav">
          <span className="si-bg-logo">
            <NoonMark />
          </span>
          <span className="si-bg-navlinks">
            <span>Services</span>
            <span>About</span>
            <span>Contact</span>
          </span>
          <span className="si-bg-navcta">Start with Maxwell</span>
        </div>

        <div className="si-bg-center">
          <p className="si-bg-heading">Tell us what you want to build.</p>
          <div className="si-mock si-bg-mock">
            <div className="si-mock-body">
              <p className="si-mock-ghost">
                Build a client portal where my customers can log in, view their projects, upload
                documents, and message my team…
              </p>
            </div>
            <div className="si-mock-bar">
              <span className="si-mock-plus">
                <Plus size={16} strokeWidth={1.75} />
              </span>
              <span className="si-mock-send">
                <ArrowUp size={16} strokeWidth={2} />
              </span>
            </div>
          </div>
          <div className="si-bg-chips">
            <span>Reservation platform</span>
            <span>Operations dashboard</span>
            <span>AI customer support</span>
          </div>
        </div>
      </div>

      {/* ── Scrim ──────────────────────────────────────────────────────────── */}
      <div className="si-scrim" aria-hidden="true" />

      {/* ── Centered modal (client shell: click-outside / Escape dismiss) ──── */}
      <SignInModalShell dismissHref={`/${locale}`}>
        <div className="si-modal">
          <div className="si-modal-logo">
            <NoonMark />
          </div>

          <h1 className="si-modal-title">Continue with Maxwell</h1>
          <p className="si-modal-sub">
            To start a Maxwell session, sign in to your account or create a new one.
          </p>

          {mapSignInError(error) ? (
            <div className="si-error">{mapSignInError(error)}</div>
          ) : null}

          {/* Sign Up / Sign In each open their own method-chooser screen; the
              intended post-auth destination (redirectTo) is carried through. */}
          <div className="si-actions">
            <Link
              href={`/${locale}/signin/signup${authQuery}`}
              className="lgl-btn lgl-btn-primary si-gbtn"
            >
              Sign Up
            </Link>
            <Link
              href={`/${locale}/signin/login${authQuery}`}
              className="lgl-btn lgl-btn-secondary si-gbtn"
            >
              Sign In
            </Link>
          </div>
        </div>
      </SignInModalShell>
    </div>
  );
}
