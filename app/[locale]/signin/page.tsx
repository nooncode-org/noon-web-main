import { redirect } from "next/navigation";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NoonWordmark } from "@/components/brand/noon-logo";
import { auth, isGoogleAuthConfigured } from "@/auth";
import { signInWithGoogleAction } from "./actions";
import { normalizeInternalRedirect } from "@/lib/auth/redirect";
import { siteRoutes, getStartWithMaxwellHref } from "@/lib/site-config";
import "@/app/_components/site/legal-rd.css";
import "./signin-rd.css";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
};

export default async function SignInPage({ params, searchParams }: Props) {
  const [{ locale }, { redirectTo: rawRedirectTo, error }, session] = await Promise.all([
    params,
    searchParams,
    auth(),
  ]);

  const redirectTo = normalizeInternalRedirect(rawRedirectTo, "/maxwell/studio");

  if (session?.user?.email) {
    redirect(redirectTo);
  }

  const googleConfigured = isGoogleAuthConfigured();
  const lp = (href: string) => `/${locale}${href}`;

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} lgl-rd`}>
      <header className="lgl-nav">
        <div className="lgl-nav-inner">
          <Link href={lp("/")} className="lgl-nav-logo" aria-label="Noon — home">
            <span style={{ height: 20, display: "inline-flex" }}>
              <NoonWordmark />
            </span>
          </Link>
          <nav className="lgl-nav-links">
            <Link href={lp(siteRoutes.services)}>Services</Link>
            <Link href={lp(siteRoutes.about)}>About</Link>
            <Link href={lp(siteRoutes.contact)}>Contact</Link>
          </nav>
          <Link
            href={lp(getStartWithMaxwellHref())}
            className="lgl-nav-cta lgl-btn lgl-btn-primary"
          >
            Start with Maxwell
          </Link>
        </div>
      </header>

      <div className="lgl-frame" aria-hidden />

      <main className="si-main">
        <div className="si-card">
          <h1 className="si-heading">
            Sign in to continue<br />with Maxwell
          </h1>
          <p className="si-body">
            Noon requires a Google account before starting a Maxwell session. Your prompt and
            proposal flow stay tied to the same verified identity.
          </p>

          <div className="si-info">
            <p className="si-info-title">What happens next</p>
            <ul className="si-info-list">
              <li>Continue into Maxwell Studio with your prompt preserved.</li>
              <li>Keep your proposal and workspace linked to the same account.</li>
              <li>Receive the formal proposal to the email tied to your sign-in.</li>
            </ul>
          </div>

          {error ? <div className="si-error">{error}</div> : null}

          {googleConfigured ? (
            <form action={signInWithGoogleAction} className="si-form">
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <button type="submit" className="lgl-btn lgl-btn-primary si-submit">
                Continue with Google
              </button>
            </form>
          ) : (
            <div className="si-dev-warning">
              Google sign-in is not configured yet. Add <code>AUTH_GOOGLE_ID</code>,{" "}
              <code>AUTH_GOOGLE_SECRET</code>, and <code>AUTH_SECRET</code> before enabling this
              flow.
            </div>
          )}
        </div>
      </main>

      <footer className="si-footer">
        <span>© 2026 Noon</span>
      </footer>
    </div>
  );
}
