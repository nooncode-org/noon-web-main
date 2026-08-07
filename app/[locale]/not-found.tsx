import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { NotFoundView } from "@/app/_components/site/not-found-view";

/**
 * The 404 for anything under a locale — which, with `localePrefix: "always"`,
 * is effectively every request. Next renders the nearest `not-found.tsx` above
 * the segment that called `notFound()`, so this file catches the locale tree
 * and `app/not-found.tsx` stays as the locale-less fallback.
 *
 * It exists because a page can be gated OUT of Spanish (see
 * i18n/launch-locales.ts) but its 404 cannot: `/es/maxwell/prototipo/<typo>`
 * legitimately stays on `/es`, and used to answer with an English 404 under
 * `<html lang="es">` — a screen reader would have read English copy with
 * Spanish pronunciation.
 *
 * `not-found.tsx` receives no params (a Next limitation), so the locale comes
 * from the request via next-intl rather than from the route segment.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFound");
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

export default async function LocaleNotFound() {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("notFound"),
  ]);

  return (
    <NotFoundView
      locale={locale}
      kicker={t("kicker")}
      headline={t("headline")}
      lead={t("lead")}
      backHome={t("backHome")}
      contact={t("contact")}
    />
  );
}
