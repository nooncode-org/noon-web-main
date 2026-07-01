"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
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

  // The entry page (`/upgrade`) is now redesigned (`upg-rd`) and brings its
  // own nav, framed border, and footer — rendering the old site chrome around
  // it would double up (two navs). Only `/upgrade/[id]` (the still-unredesigned
  // product workspace) gets the old chrome, unchanged.
  if (isUpgradeEntry) {
    return <>{children}</>;
  }

  return (
    <div className="page-grid-background noise-overlay relative flex min-h-dvh flex-col overflow-x-hidden bg-background">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[55] hidden md:block">
        <div
          className="absolute top-[46px] left-3 right-3 bottom-3 rounded-[10px] border border-foreground/10"
          style={{ boxShadow: "0 0 0 9999px var(--background)" }}
        />
      </div>
      <Navigation viewer={viewer} />
      <main id="upgrade-page-frame" className="relative z-10 flex-1 pb-8 pt-24 lg:pb-10 lg:pt-24">
        {children}
      </main>
    </div>
  );
}
