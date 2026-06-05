"use client";

/**
 * UpgradeDemo — embeds the REAL <UpgradeAuditPanel> from components/upgrade/
 * on the marketing page, driven by static demo data. Like MaxwellDemo, it
 * imports the product component directly, so it stays in sync automatically
 * when the audit UI evolves. All handlers are no-ops / links.
 */

import { useLocale } from "next-intl";
import Link from "next/link";
import { UpgradeAuditPanel } from "@/components/upgrade/upgrade-audit";
import { DEMO_AUDIT } from "./demo-data";

const noop = () => {};

export function UpgradeDemo({ className = "" }: { className?: string }) {
  const locale = useLocale();
  return (
    <div
      className={`overflow-hidden rounded-[12px] border border-foreground/10 bg-background shadow-[0_24px_60px_-30px_rgba(0,0,0,0.55)] ${className}`}
    >
      {/* Browser-window chrome — shows the audited site URL */}
      <div className="flex items-center gap-2 border-b border-foreground/10 bg-secondary/40 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        </div>
        <div className="ml-2 flex-1 truncate rounded-md bg-background/70 px-3 py-1 text-center text-xs text-muted-foreground">
          app.noon.dev/upgrade · acme-logistics.com
        </div>
      </div>

      {/* The real audit panel — scrollable, interactive (expandable sections) */}
      <div className="max-h-[600px] overflow-y-auto px-5 py-6 sm:px-8">
        <UpgradeAuditPanel audit={DEMO_AUDIT} onCreateVersion={noop} isGenerating={false} />
      </div>

      {/* Footer CTA */}
      <div className="flex items-center justify-between gap-3 border-t border-foreground/10 px-5 py-3 text-xs text-muted-foreground">
        <span>This is the real Upgrade audit — interactive demo with sample data.</span>
        <Link
          href={`/${locale}/upgrade`}
          className="text-foreground/85 underline-offset-4 hover:underline"
        >
          Run it on your site →
        </Link>
      </div>
    </div>
  );
}
