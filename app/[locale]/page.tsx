import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { FloatingTechElements } from "@/components/landing/floating-tech-elements";

export default function Home() {
  return (
    <main className="page-grid-background relative h-dvh overflow-hidden noise-overlay">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[55]"
      >
        <div
          className="absolute top-[46px] left-1.5 right-1.5 bottom-1.5 rounded-[10px] border border-foreground/10 md:left-3 md:right-3 md:bottom-3"
          style={{ boxShadow: "0 0 0 9999px var(--background)" }}
        />
      </div>
      <FloatingTechElements />
      <Navigation />
      <HeroSection />
    </main>
  );
}
