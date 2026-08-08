import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { DISABLED_LAUNCH_LOCALES } from "@/i18n/launch-locales";

type Locale = (typeof routing.locales)[number];

/**
 * Only the locales we actually serve get pre-rendered.
 *
 * Routing declares four (en/es/fr/de) so the scaffolding exists, but fr/de are
 * gated in the middleware and no visitor can reach them. Building them anyway
 * cost real time and, worse, filled every build log with
 * `MISSING_MESSAGE: … (de)` — their message files sit at 248 keys against 624,
 * frozen since before the portal existed. Those errors were noise about pages
 * nobody serves, and noise is where a real error goes to hide.
 *
 * A locale that later ships joins here automatically by leaving the disabled
 * set — there is no second list to remember.
 */
export function generateStaticParams() {
  return routing.locales
    .filter((locale) => !DISABLED_LAUNCH_LOCALES.has(locale))
    .map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
