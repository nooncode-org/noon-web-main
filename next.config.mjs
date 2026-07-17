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
      // Studio moved from /maxwell/studio → /maxwell (2026-07). These must sit
      // BEFORE the /maxwell/:path* catch-alls below — first match wins, and
      // the catch-all would otherwise swallow the old studio URL. Query
      // strings (?session_id=, ?prompt=) are preserved automatically.
      { source: "/:locale(en|es|fr|de)/maxwell/studio", destination: "/:locale/maxwell", permanent: false },
      { source: "/maxwell/studio", destination: "/en/maxwell", permanent: false },
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
    // Dev only: Turbopack/React Fast Refresh require eval() in development.
    // Production stays strict (no 'unsafe-eval'). Without this, the dev CSP
    // blocks eval() → client JS fails → useRevealOnView leaves sections at
    // opacity-0 (page appears blank).
    const isDev = process.env.NODE_ENV !== "production";
    // https://js.stripe.com → Stripe.js (Embedded Checkout) on the proposal page.
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com"
      : "script-src 'self' 'unsafe-inline' https://js.stripe.com";

    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // api.stripe.com → Stripe.js network calls during Embedded Checkout.
      "connect-src 'self' https://api.stripe.com",
      // 'self' → /templates live product mockups (public/templates/mockups/*.html)
      // embedded as same-origin iframes; v0 preview hosts; Stripe Embedded Checkout
      // mounts its payment form from js.stripe.com / checkout.stripe.com.
      "frame-src 'self' https://*.vercel.app https://*.vusercontent.net https://js.stripe.com https://checkout.stripe.com",
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
            // payment=(self + Stripe) → Apple Pay / Google Pay inside the Stripe
            // Embedded Checkout iframe (checkout.stripe.com).
            key: "Permissions-Policy",
            value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com")',
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
      // /templates live product mockups (static, self-contained HTML in
      // /public) are embedded by our own pages as same-origin iframes — they
      // need frame-ancestors 'self' / SAMEORIGIN. Scoped override: later
      // matching entries win per header key; everything else inherits the
      // strict set.
      {
        source: "/templates/mockups/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value: csp.replace("frame-ancestors 'none'", "frame-ancestors 'self'"),
          },
        ],
      },
      // /upgrade "before/after" NORR mockups (public/mockups/*.html) — same
      // reasoning as /templates above.
      {
        source: "/mockups/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value: csp.replace("frame-ancestors 'none'", "frame-ancestors 'self'"),
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
