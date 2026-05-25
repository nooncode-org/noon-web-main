import path from "node:path"
import { fileURLToPath } from "node:url"
import createNextIntlPlugin from "next-intl/plugin"

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: rootDir,
  },
  async redirects() {
    return [
      // Consolidated pages redirects
      {
        source: "/solutions",
        destination: "/en/services",
        permanent: true,
      },
      {
        source: "/capabilities",
        destination: "/en/services",
        permanent: true,
      },
      {
        source: "/what-we-build",
        destination: "/en/services",
        permanent: true,
      },
      {
        source: "/technology-we-use",
        destination: "/en/about#technology",
        permanent: true,
      },
      {
        source: "/about-noon",
        destination: "/en/about",
        permanent: true,
      },
      {
        source: "/work-with-noon",
        destination: "/en/contact",
        permanent: true,
      },
      {
        source: "/next-product",
        destination: "/en/contact",
        permanent: true,
      },
      {
        source: "/start-with-maxwell",
        destination: "/en/maxwell",
        permanent: true,
      },
      // Legacy non-locale paths → redirect to /en/ version
      { source: "/maxwell", destination: "/en/maxwell", permanent: false },
      { source: "/maxwell/:path*", destination: "/en/maxwell/:path*", permanent: false },
      { source: "/upgrade", destination: "/en/upgrade", permanent: false },
      { source: "/upgrade/:path*", destination: "/en/upgrade/:path*", permanent: false },
      { source: "/signin", destination: "/en/signin", permanent: false },
      { source: "/cookies-policy", destination: "/en/cookies-policy", permanent: false },
      { source: "/legal", destination: "/en/legal", permanent: false },
      { source: "/legal-notice", destination: "/en/legal-notice", permanent: false },
      { source: "/privacy-policy", destination: "/en/privacy-policy", permanent: false },
      { source: "/terms-and-conditions", destination: "/en/terms-and-conditions", permanent: false },
    ]
  },
  async headers() {
    // Content-Security-Policy
    // ----------------------------------------------------------------------
    // Allowances justified:
    // - script-src 'unsafe-inline' → required by the inline <Script id="hydration-attribute-scrub">
    //   in app/layout.tsx that scrubs extension-injected attributes and toggles dark mode
    //   pre-hydration. Could be replaced with a per-request nonce via middleware in a
    //   follow-up; out of scope here.
    // - style-src 'unsafe-inline' → required by (a) Radix UI / shadcn components that set
    //   element-level style="" attributes for animations/positioning, and (b) the inline
    //   <style> block in app/global-error.tsx that cannot depend on globals.css loading.
    // - frame-src https://*.vercel.app https://*.vusercontent.net → v0 preview iframes.
    //   v0 may serve demos on either host; embedded in studio-preview-pane.tsx.
    // - form-action https://checkout.stripe.com → Stripe Checkout redirect target when the
    //   payment path eventually moves from submit_payment_evidence to Stripe Checkout.
    // - connect-src 'self' → all third-party calls (OpenAI, V0, Resend, Stripe, Postgres)
    //   are server-side; no browser-originated cross-origin fetches today. Tighten if
    //   client-side telemetry (Sentry, etc.) is added later.
    // - img-src 'self' data: blob: https: → pragmatic for now (any HTTPS image source).
    //   Tighten to explicit hosts once external image references are catalogued.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-src https://*.vercel.app https://*.vusercontent.net",
      "form-action 'self' https://checkout.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
          // ── B15 additions ──
          // HSTS: 1 year, includeSubDomains. Not preloaded — soft launch should avoid
          // committing to the hstspreload.org list until the domain is stable.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // X-Frame-Options: belt-and-suspenders with CSP frame-ancestors 'none' for
          // older browsers that do not parse CSP frame-ancestors.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
