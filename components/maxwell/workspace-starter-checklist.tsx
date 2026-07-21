"use client";

import { Palette, Globe, Phone } from "lucide-react";
import { useWorkspaceTabs } from "@/components/maxwell/workspace-tabs";

/**
 * StarterChecklist — "While you wait": the three things a just-paid client can
 * DO during the v1 build (audit close-out, 2026-07-19). The new-client moment
 * is the anxiety peak; Milestones shows progress but gives them no agency —
 * this does (references: a getting-started checklist halved onboarding
 * tickets). Renders only in the fresh state (no versions, no live site).
 *
 * Deliberately NO checkmarks: navigating to the chat isn't the same as having
 * shared the kit, and fake "done" state erodes trust. Real completion signals
 * (brand file attached, domain noted, call booked) are logic-later.
 */
const CAL_URL = "https://cal.com/nooncode/check-in"; // TODO(logic later): the team's real scheduling link (same as settings)

export function StarterChecklist() {
  const tabs = useWorkspaceTabs();
  const row =
    "flex items-start gap-3 rounded-[6px] border border-border px-4 py-3.5 text-left transition-all hover:border-foreground/20 hover:bg-secondary/30";
  const iconWrap =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0056fd]/10 text-[#0056fd]";

  return (
    <section className="rounded-[6px] border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">While you wait</p>
        <p className="text-[12px] text-muted-foreground">Three quick things that speed us up</p>
      </div>
      <div className="grid gap-2.5 md:grid-cols-3">
        <button type="button" onClick={() => tabs?.select("chat")} className={row}>
          <span className={iconWrap}>
            <Palette className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-medium">Share your brand kit</span>
            <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
              Logo, colors, fonts — drop them in the chat.
            </span>
          </span>
        </button>
        <button type="button" onClick={() => tabs?.select("chat")} className={row}>
          <span className={iconWrap}>
            <Globe className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-medium">Tell us your domain wish</span>
            <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
              yourbrand.com? Say it in the chat — we handle the rest.
            </span>
          </span>
        </button>
        <a href={CAL_URL} target="_blank" rel="noopener noreferrer" className={row}>
          <span className={iconWrap}>
            <Phone className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-medium">Book a kickoff call</span>
            <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
              15 minutes with your team, whenever suits you.
            </span>
          </span>
        </a>
      </div>
    </section>
  );
}
