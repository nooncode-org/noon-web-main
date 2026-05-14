import Link from "next/link";
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { FloatingTechElements } from "@/components/landing/floating-tech-elements";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = locale === "en" ? "en" : "en";

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
      <footer className="fixed bottom-3 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-4 rounded-full border border-foreground/10 bg-background/75 px-4 py-2 text-[11px] text-muted-foreground backdrop-blur-md">
        <Link href={`/${safeLocale}/privacy-policy`} className="hover:text-foreground">
          Privacy
        </Link>
        <Link href={`/${safeLocale}/terms-and-conditions`} className="hover:text-foreground">
          Terms
        </Link>
        <Link href={`/${safeLocale}/contact`} className="hover:text-foreground">
          Contact
        </Link>
      </footer>
    </main>
  );
}
