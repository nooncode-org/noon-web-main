"use client";

import { CircleHelp, Phone } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * WorkspaceHelpMenu — a compact self-service FAQ behind a "?" in the workspace
 * header (audit P2-FAQ). Answers the handful of questions every client asks
 * before they ask them in the chat; native <details> keeps it dependency-free
 * and accessible. NOT a knowledge base — if this list wants to grow past ~6
 * entries, that's the signal to build a real help page instead.
 *
 * Plan-aware: the membership FAQ talks about the build flow, the Chat, and
 * publishing — none of which a ONE-TIME buyer has. They get their own set
 * (their code, yearly hosting, what non-renewal does, how to get changes), and
 * no reference to a chat they don't have.
 */
const FAQ_MEMBERSHIP: { q: string; a: string }[] = [
  {
    q: "When will I see my first preview?",
    a: "Usually 3–5 business days after kickoff. It appears on your Overview the moment it's ready, and you get an email.",
  },
  {
    q: "How do I request a change?",
    a: "Just say it in the Chat — or use \"+\" → Review site to mark the exact spot you mean. Your team tracks it from there.",
  },
  {
    q: "What does \"Make it live\" do?",
    a: "It publishes that version to your live site. Nothing goes live without your say-so.",
  },
  {
    q: "Can I use my own domain?",
    a: "Yes — Domains tab → Add. Your Noon team handles all the DNS; you never touch records unless you want to.",
  },
  {
    q: "How does billing work?",
    a: "The Plan card on your Overview shows your plan and next payment. Invoices and payment method live under Manage billing.",
  },
  {
    q: "Need a human?",
    a: "The Chat reaches your real Noon team — replies within 24h. Or book a call from the settings menu.",
  },
];

// One-time buyer: delivered project, owns the code, pays yearly hosting, no chat.
const FAQ_ONETIME: { q: string; a: string }[] = [
  {
    q: "Where's my code?",
    a: "On your Overview, under \"Your code\" — download it any time or open your repository. It's yours to keep.",
  },
  {
    q: "Can I use my own domain?",
    a: "Yes — Domains tab → Add. Your Noon team handles all the DNS; you never touch records unless you want to.",
  },
  {
    q: "How does billing work?",
    a: "You paid once for your build. Hosting and your domain renew yearly to keep the site online — we email you before each renewal.",
  },
  {
    q: "What happens if I don't renew?",
    a: "Your site goes offline, but nothing is deleted — we keep everything for 12 months, and you always have your code. Renew and it comes back exactly as it was.",
  },
  {
    q: "Can I get changes or new features?",
    a: "Your build is a fixed scope. For ongoing changes or new features, add a membership from your Overview — or ask in the Chat to scope a one-off.",
  },
  {
    q: "Need a human?",
    a: "Just say it in the Chat — it reaches your real Noon team. Or book a call below.",
  },
];

export function WorkspaceHelpMenu({ isMembership = true }: { isMembership?: boolean }) {
  const FAQ = isMembership ? FAQ_MEMBERSHIP : FAQ_ONETIME;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Help"
          title="Help"
          className="shrink-0 rounded-[6px] p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground"
        >
          <CircleHelp className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-[8px] p-2">
        <p className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Common questions
        </p>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-[6px]">
              <summary className="cursor-pointer list-none rounded-[6px] px-2 py-2 text-[13px] font-medium transition-colors hover:bg-secondary/50 [&::-webkit-details-marker]:hidden">
                {item.q}
              </summary>
              <p className="px-2 pb-2.5 pt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
        {/* The human escape hatch — support contact lives with Help, not in
            settings (moved from the gear 2026-07-19, reference-backed).
            TODO(logic later): the team's real scheduling link. */}
        <div className="mt-1 border-t border-border pt-1">
          <a
            href="https://cal.com/nooncode/check-in"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-[6px] px-2 py-2 text-[13px] font-medium transition-colors hover:bg-secondary/50"
          >
            <Phone className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
            Book a call
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
