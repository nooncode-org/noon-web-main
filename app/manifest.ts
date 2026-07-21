import type { MetadataRoute } from "next";

// Web App Manifest — makes the site installable ("Add to home screen"), so a
// client's project portal lives as an app icon on their phone (owner ask
// 2026-07-20). Next.js auto-emits the <link rel="manifest"> for this route.
// Site-wide: a signed-in client's start_url ("/") lands on their dashboard.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Noon",
    short_name: "Noon",
    description: "Your Noon project — previews, chat, and updates in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#050505",
    icons: [
      { src: "/logo-icon.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/logo-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
