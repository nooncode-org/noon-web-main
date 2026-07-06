import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { getAuthenticatedViewer } from "@/lib/auth/session";

/**
 * COMPARE-ONLY variant of the Home hero with iridescent "spectrum" accents
 * turned on (`<HeroSection spectrum />`). Identical to the live home otherwise,
 * so the owner can see the accents side-by-side without touching `/`. Delete
 * this route once the direction is decided (adopt → bake into the home, or drop).
 */
// Internal compare page — keep out of the index (auditoría 2026-07 F5, MED).
export const metadata = { robots: { index: false, follow: false } };

export default async function HeroSpectrum() {
  const viewer = await getAuthenticatedViewer();

  return (
    <main
      className={`${GeistSans.variable} ${GeistMono.variable} relative h-dvh overflow-hidden bg-background`}
      style={{ fontFamily: "var(--font-geist-sans)" }}
    >
      <Navigation viewer={viewer} />
      <HeroSection spectrum />
      <div className="home-frame" aria-hidden />
    </main>
  );
}
