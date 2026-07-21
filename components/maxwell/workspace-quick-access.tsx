"use client";

import { Globe, KeyRound, MessageCircle, Receipt } from "lucide-react";
import { useWorkspaceTabs } from "@/components/maxwell/workspace-tabs";

/**
 * Quick access — the client's one-stop shortcut row: their live site, the
 * admin login for THEIR product, their invoice, and a direct line to the Noon
 * team. Every tile is optional (renders only when the underlying link exists),
 * except "Message the team", which always works via the Support tab.
 */
export function QuickAccess({
  liveUrl,
  adminUrl,
  invoiceUrl,
}: {
  liveUrl?: string | null;
  adminUrl?: string | null;
  invoiceUrl?: string | null;
}) {
  const tabs = useWorkspaceTabs();
  const tile =
    "flex items-center gap-2.5 rounded-[6px] border border-border px-4 py-3 text-[13px] font-medium transition-all hover:border-foreground/20 hover:bg-secondary/30";
  const icon = "h-4 w-4 shrink-0 text-muted-foreground";

  return (
    <section className="rounded-[6px] border border-border bg-card p-5">
      <p className="mb-3 text-sm font-medium">Quick access</p>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {liveUrl && (
          <a href={liveUrl} target="_blank" rel="noopener noreferrer" className={tile}>
            <Globe className={icon} strokeWidth={1.75} />
            Visit site
          </a>
        )}
        {adminUrl && (
          <a href={adminUrl} target="_blank" rel="noopener noreferrer" className={tile}>
            <KeyRound className={icon} strokeWidth={1.75} />
            Admin login
          </a>
        )}
        {invoiceUrl && (
          <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" className={tile}>
            <Receipt className={icon} strokeWidth={1.75} />
            Invoice
          </a>
        )}
        <button type="button" onClick={() => tabs?.select("chat")} className={tile}>
          <MessageCircle className={icon} strokeWidth={1.75} />
          Message the team
        </button>
      </div>
    </section>
  );
}

/**
 * "Request a change" — the client's primary post-delivery action, surfaced on
 * the Overview (it jumps to the Support tab where the request form lives).
 */
export function RequestChangeChip() {
  const tabs = useWorkspaceTabs();
  return (
    <button
      type="button"
      onClick={() => tabs?.select("chat")}
      className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-secondary/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
    >
      Request a change {"->"}
    </button>
  );
}
