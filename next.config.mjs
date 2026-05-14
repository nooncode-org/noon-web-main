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
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
