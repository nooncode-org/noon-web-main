import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { getAuthenticatedViewer } from "@/lib/auth/session";

export default async function Home() {
  const viewer = await getAuthenticatedViewer();

  return (
    <main className="relative h-dvh overflow-hidden bg-background">
      <Navigation viewer={viewer} />
      <HeroSection />
    </main>
  );
}
