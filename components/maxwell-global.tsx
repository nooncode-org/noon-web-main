"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { siteRoutes } from "@/lib/site-config";
import { siteStatusTones, siteTones } from "@/lib/site-tones";

export function MaxwellGlobal() {
  const pathname = usePathname();

  // Suppress on Maxwell pages and inside the Studio itself (/studio) — the
  // user is already in the Maxwell flow.
  if (pathname.includes("/maxwell") || pathname.includes("/studio")) return null;

  return (
    <Link
      href={siteRoutes.maxwellStudio}
      aria-label="Start with Maxwell"
      className="fixed bottom-6 right-6 z-[99] flex items-center gap-2.5 rounded-full border border-border py-3 pl-4 pr-5 shadow-xl transition-[background-color,border-color,box-shadow] duration-300 ease-out hover:border-primary/30"
      style={{
        backgroundColor: "var(--background)",
        boxShadow: "0 8px 32px -4px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
      }}
    >
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: siteTones.brand.accent }}
      >
        <Sparkles className="w-3.5 h-3.5" style={{ color: siteTones.brand.contrast }} />
      </span>
      <span className="text-sm font-medium">Maxwell</span>
      <span
        className="w-2 h-2 rounded-full animate-pulse"
        style={{ backgroundColor: siteStatusTones.availability.accent }}
      />
    </Link>
  );
}
