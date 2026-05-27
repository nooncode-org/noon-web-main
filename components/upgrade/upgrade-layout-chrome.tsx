"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { FloatingTechElements } from "@/components/landing/floating-tech-elements";
import { FooterSection } from "@/components/landing/footer-section";
import { Navigation } from "@/components/landing/navigation";
import type { UserMenuViewer } from "@/components/ui/user-menu";

const UPGRADE_ENTRY_PATTERN = /^\/(en|es|fr|de)\/upgrade\/?$/;

type UpgradeLayoutChromeProps = {
  children: ReactNode;
  /**
   * Auth-aware viewer fetched by the parent RSC layout. Threaded into
   * `Navigation` so the upgrade chrome shows the user menu instead of the
   * anonymous "Sign up" CTA when applicable.
   */
  viewer?: UserMenuViewer | null;
};

export function UpgradeLayoutChrome({ children, viewer = null }: UpgradeLayoutChromeProps) {
  const pathname = usePathname();
  const isUpgradeEntry = UPGRADE_ENTRY_PATTERN.test(pathname);

  return (
    <div className="page-grid-background noise-overlay relative flex min-h-dvh flex-col overflow-x-hidden bg-background">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[55] hidden md:block">
        <div
          className="absolute top-[46px] left-3 right-3 bottom-3 rounded-[10px] border border-foreground/10"
          style={{ boxShadow: "0 0 0 9999px var(--background)" }}
        />
      </div>
      <FloatingTechElements />
      <Navigation viewer={viewer} />
      <main id="upgrade-page-frame" className="relative z-10 flex-1 pb-8 pt-24 lg:pb-10 lg:pt-24">
        {children}
      </main>
      {isUpgradeEntry ? <FooterSection /> : null}
    </div>
  );
}
