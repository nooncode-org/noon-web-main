import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://noon-main.vercel.app";

  return {
    rules: {
      userAgent: "*",
      allow: ["/en", "/en/about", "/en/services", "/en/contact"],
      disallow: [
        "/api/",
        "/en/maxwell/review",
        "/en/maxwell/proposal/",
        "/en/maxwell/workspace/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
