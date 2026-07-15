import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NoonWordmark, NoonMark } from "@/components/brand/noon-logo";
import "@/app/_components/site/legal-rd.css";
import "../signin-rd.css";

/**
 * Auth.js `pages.verifyRequest` target — the branded "we sent you a link"
 * screen. The primary UX is the inline "sent" state on the signin form itself
 * (email-signin-form.tsx); this page is the safety net for a direct
 * /api/auth/signin entry that redirects here.
 */
export default async function CheckEmailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lp = (href: string) => `/${locale}${href}`;

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} lgl-rd sic-rd`}>
      <header className="sic-top">
        <Link href={lp("/")} className="sic-top-logo" aria-label="Noon — home">
          <NoonWordmark />
        </Link>
        <Link href={lp("/signin/login")} className="sic-top-alt">
          Sign In
        </Link>
      </header>

      <main className="sic-center">
        <div className="sic-col">
          <div className="sic-mark">
            <NoonMark />
          </div>
          <h1 className="sic-title">Check your email</h1>
          <p className="sic-sub">
            We sent you a sign-in link. Open it from your inbox to continue —
            it&apos;s valid for 15 minutes and can be used once.
          </p>
          <p className="sic-alt">
            Didn&apos;t get it? <Link href={lp("/signin/login")}>Try again</Link>
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
