import type { ReactNode } from "react";
import { FloatingTechElements } from "@/components/landing/floating-tech-elements";
import { FooterSection } from "@/components/landing/footer-section";
import { Navigation } from "@/components/landing/navigation";
import { SiteScrollIndicator } from "@/app/_components/site/site-scroll-indicator";
import { getAuthenticatedViewer } from "@/lib/auth/session";

type SitePageFrameProps = {
  children: ReactNode;
};

export async function SitePageFrame({ children }: SitePageFrameProps) {
  // Server-fetched viewer so `Navigation` can render the auth-aware user menu
  // (sign out + Maxwell Studio link) instead of the anonymous "Sign up" CTA.
  // Falls back to `null` for anonymous traffic.
  const viewer = await getAuthenticatedViewer();

  return (
    <main
      id="site-page-frame"
      className="page-grid-background relative flex min-h-dvh flex-col overflow-x-hidden noise-overlay"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute right-0 top-0 h-[700px] w-[700px] translate-x-1/3 -translate-y-1/4 rounded-full opacity-[0.055] blur-[120px]" style={{ background: "radial-gradient(circle, #1200c5 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-0 h-[500px] w-[500px] -translate-x-1/3 translate-y-1/4 rounded-full opacity-[0.03] blur-[100px]" style={{ background: "radial-gradient(circle, #6a63f2 0%, transparent 70%)" }} />
      </div>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[55] hidden md:block">
        <div
          className="absolute top-[46px] left-3 right-3 bottom-3 border border-foreground/10"
          style={{ boxShadow: "0 0 0 9999px var(--background)" }}
        />
      </div>
      <SiteScrollIndicator />
      <FloatingTechElements />
      <Navigation viewer={viewer} />
      <div className="relative z-10 flex-1 pt-28 lg:pt-32">{children}</div>
      <FooterSection />
    </main>
  );
}
