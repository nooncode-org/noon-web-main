import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NotFoundView } from "@/app/_components/site/not-found-view";

/**
 * The 404 for paths with no locale segment. With `localePrefix: "always"` the
 * middleware prefixes essentially everything, so `app/[locale]/not-found.tsx`
 * handles the real traffic and this is the fallback beneath it.
 *
 * The locale is pinned to English rather than detected: there is no locale to
 * detect here, and English is what the site defaults to. The copy still comes
 * from `messages/en.json` so the two 404s can never word themselves
 * differently.
 */

const FALLBACK_LOCALE = "en";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({
    locale: FALLBACK_LOCALE,
    namespace: "notFound",
  });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

export default async function NotFound() {
  const t = await getTranslations({
    locale: FALLBACK_LOCALE,
    namespace: "notFound",
  });

  return (
    <NotFoundView
      locale={FALLBACK_LOCALE}
      kicker={t("kicker")}
      headline={t("headline")}
      lead={t("lead")}
      backHome={t("backHome")}
      contact={t("contact")}
    />
  );
}
