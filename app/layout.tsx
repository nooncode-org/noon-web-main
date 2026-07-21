import React from "react"
import type { Metadata, Viewport } from 'next'
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import { getLocale } from "next-intl/server"
import Script from "next/script"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import './globals.css'
import { MotionProvider } from "@/components/providers/motion-provider"

const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://noon-main.vercel.app");

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: '--font-instrument'
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: '--font-jetbrains'
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: 'Noon - The code-first software company',
  description: 'Noon turns ideas into real, scalable software built in code and accelerated by AI. Tell us what you want to build.',
  alternates: {
    canonical: "/en",
    languages: {
      en: "/en",
      es: "/es",
    },
  },
  openGraph: {
    type: "website",
    url: "/en",
    siteName: "Noon",
    title: "Noon - The code-first software company",
    description:
      "Noon turns ideas into real, scalable software built in code and accelerated by AI.",
    // og:image comes from the file-based opengraph-image.tsx per route
    // (app/[locale]/** ) — branded 1200×630 cards, one per page.
  },
  twitter: {
    card: "summary_large_image",
    title: "Noon - The code-first software company",
    description:
      "Noon turns ideas into real, scalable software built in code and accelerated by AI.",
  },
  icons: {
    icon: '/logo-icon.png',
    apple: '/logo-icon.png',
  },
  // iOS "add to home screen" → runs as a standalone app (pairs with app/manifest.ts).
  appleWebApp: {
    capable: true,
    title: 'Noon',
    statusBarStyle: 'default',
  },
  other: {
    'color-scheme': 'light dark',
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
  ],
  colorScheme: "light dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Every page lives under app/[locale], so the middleware has always resolved
  // a locale by the time this renders — <html lang> must follow it (es launched
  // 2026-07-19; hardcoding "en" mislabeled Spanish pages for SEO/AT).
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning className="overflow-x-hidden">
      <body
        suppressHydrationWarning
        className={`${instrumentSans.variable} ${jetbrainsMono.variable} font-sans antialiased overflow-x-hidden`}
      >
        <Script id="hydration-attribute-scrub" strategy="beforeInteractive">
          {`
            document.documentElement.removeAttribute("cz-shortcut-listen");
            if (document.body) {
              document.body.removeAttribute("cz-shortcut-listen");
            } else {
              document.addEventListener("DOMContentLoaded", function () {
                document.body?.removeAttribute("cz-shortcut-listen");
              }, { once: true });
            }
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
              document.documentElement.classList.add('dark');
            }
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
              document.documentElement.classList.toggle('dark', e.matches);
            });
          `}
        </Script>
        {/* Organization structured data — name/logo/socials, sitewide. The
            socials mirror lib/site-config footerSocialLinks. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Noon",
              url: `${siteUrl.origin}/en`,
              logo: `${siteUrl.origin}/logo-icon.png`,
              description:
                "Noon turns ideas into real, scalable software built in code and accelerated by AI — every build human-reviewed.",
              sameAs: [
                "https://www.tiktok.com/@nooncode.dev",
                "https://www.facebook.com/people/Noon-Development-Agency/61571938881520/",
                "https://www.instagram.com/nooncode.dev",
              ],
            }),
          }}
        />
        <MotionProvider>{children}</MotionProvider>
        {/* Vercel Analytics + Speed Insights — chosen observability path,
            see roadmap §10.8.3. No third-party error tracker (e.g. Sentry)
            is wired by design. Both components are no-ops in non-Vercel
            environments and free up to a per-project quota. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
