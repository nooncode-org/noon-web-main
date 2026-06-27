import type { ReactNode } from "react";
import { FooterSection } from "@/components/landing/footer-section";
import { Navigation } from "@/components/landing/navigation";
import { SiteScrollIndicator } from "@/app/_components/site/site-scroll-indicator";
import type { UserMenuViewer } from "@/components/ui/user-menu";

type SitePageFrameProps = {
  children: ReactNode;
  /**
   * Authenticated viewer for the navbar UserMenu. Server pages should pass
   * `viewer={await getAuthenticatedViewer()}` to keep the auth-aware menu;
   * client pages pass nothing (viewer = null → anonymous Sign up CTA).
   *
   * Made into an explicit prop (instead of auto-fetching) so this component
   * can be used both from server and client pages — async + auto-fetch was
   * incompatible with the "use client" marketing pages.
   */
  viewer?: UserMenuViewer | null;
};

export function SitePageFrame({ children, viewer = null }: SitePageFrameProps) {
  return (
    <main
      id="site-page-frame"
      className="page-grid-background relative flex min-h-dvh flex-col overflow-x-hidden noise-overlay"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute right-0 top-0 h-[700px] w-[700px] translate-x-1/3 -translate-y-1/4 rounded-full opacity-[0.055] blur-[120px]" style={{ background: "radial-gradient(circle, #1200c5 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-0 h-[500px] w-[500px] -translate-x-1/3 translate-y-1/4 rounded-full opacity-[0.03] blur-[100px]" style={{ background: "radial-gradient(circle, #6a63f2 0%, transparent 70%)" }} />
      </div>
      <SiteScrollIndicator />
      <Navigation viewer={viewer} />
      <div className="relative z-10 flex-1 pt-28 lg:pt-32">{children}</div>
      <FooterSection />
    </main>
  );
}
