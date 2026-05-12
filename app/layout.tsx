import React from "react"
import type { Metadata } from 'next'
import Script from "next/script"
import './globals.css'

export const metadata: Metadata = {
  title: 'Noon - The code-first software company',
  description: 'Noon turns ideas into real, scalable software built in code and accelerated by AI. Tell us what you want to build.',
  icons: {
    icon: '/logo-icon.png',
    apple: '/logo-icon.png',
  },
  other: {
    'color-scheme': 'light dark',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden">
      <body
        suppressHydrationWarning
        className="font-sans antialiased overflow-x-hidden"
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
        {children}
      </body>
    </html>
  )
}
