import type { MetadataRoute } from "next";

const publicRoutes = [
  "",
  "/about",
  "/services",
  "/work",
  "/approach",
  "/templates",
  "/upgrade",
  "/opportunities",
  "/contact",
  "/privacy-policy",
  "/terms-and-conditions",
  "/cookies-policy",
  "/legal",
  "/legal-notice",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://noon-main.vercel.app";
  const now = new Date();

  return publicRoutes.map((route) => ({
    url: `${baseUrl}/en${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
