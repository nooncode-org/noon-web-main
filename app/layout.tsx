import React from "react"
import type { Metadata, Viewport } from 'next'
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google'
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
    },
  },
  openGraph: {
    type: "website",
    url: "/en",
    siteName: "Noon",
    title: "Noon - The code-first software company",
    description:
      "Noon turns ideas into real, scalable software built in code and accelerated by AI.",
    images: [{ url: "/logo-icon.png", width: 512, height: 512, alt: "Noon" }],
  },
  twitter: {
    card: "summary",
    title: "Noon - The code-first software company",
    description:
      "Noon turns ideas into real, scalable software built in code and accelerated by AI.",
    images: ["/logo-icon.png"],
  },
  icons: {
    icon: '/logo-icon.png',
    apple: '/logo-icon.png',
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden">
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
