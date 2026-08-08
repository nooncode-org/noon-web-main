import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations({ locale, namespace: "signin" });

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} lgl-rd sic-rd`}>
      <header className="sic-top">
        <Link href={lp("/")} className="sic-top-logo" aria-label={t("home")}>
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
          <h1 className="sic-title">{t("checkEmailTitle")}</h1>
          <p className="sic-sub">{t("checkEmailBody")}</p>
          <p className="sic-alt">
            {/* One sentence with a link inside it — the link's position in the
                sentence differs per language, so it travels in the message. */}
            {t.rich("didntGetIt", {
              retry: (chunks) => <Link href={lp("/signin/login")}>{chunks}</Link>,
            })}
          </p>
        </div>
      </main>

      <footer className="sic-legal">
        {t.rich("legal", {
          terms: (chunks) => <Link href={lp("/legal/terms-and-conditions")}>{chunks}</Link>,
          privacy: (chunks) => <Link href={lp("/legal/privacy-policy")}>{chunks}</Link>,
        })}
      </footer>
    </div>
  );
}
