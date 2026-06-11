import { Check, GitPullRequest, ShieldCheck, UserRound } from "lucide-react";
import { siteStatusTones } from "@/lib/site-tones";

// BuildReceipt — the audit's "build card" signature artifact (Cursor/Linear
// agent-activity receipts, adapted to Noon's wedge): a delivery update as the
// client actually receives it — what the AI produced, what the humans checked,
// and the explicit awaiting-your-sign-off gate. ILLUSTRATIVE data, labeled as
// such (same disclosure practice as the /work mockups). Server-safe.

const SUCCESS = siteStatusTones.success.accent;

const CHECKS = [
  { label: "2 senior review passes", mono: "review" },
  { label: "9 files read line by line", mono: "diff" },
  { label: "14 tests added — all passing", mono: "ci" },
  { label: "1 change request raised & resolved", mono: "fix" },
];

export function BuildReceipt() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="overflow-hidden rounded-[12px] border border-foreground/12 bg-card/30">
        {/* header */}
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-primary/10 text-primary">
              <GitPullRequest className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="leading-tight">
              <div className="text-[13.5px] font-semibold text-foreground">Build update — client billing portal</div>
              <div className="font-mono text-[10px] text-muted-foreground/60">delivery 3 of 5 · today 16:40</div>
            </div>
          </div>
          <span className="rounded-full border border-foreground/12 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60">
            Illustrative
          </span>
        </div>

        {/* the checks the humans ran */}
        <ul className="divide-y divide-foreground/[0.06] px-5">
          {CHECKS.map((c) => (
            <li key={c.label} className="flex items-center gap-3 py-2.5">
              <span
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${SUCCESS}1a`, color: SUCCESS }}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="flex-1 text-sm text-foreground/85">{c.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground/45">{c.mono}</span>
            </li>
          ))}
        </ul>

        {/* the gate */}
        <div className="border-t border-foreground/10 bg-primary/[0.04] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-background text-primary">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            <div className="leading-snug">
              <div className="text-[13px] font-semibold text-foreground">
                Approved by senior engineering
              </div>
              <div className="text-[12px] text-muted-foreground">
                Working build on staging — awaiting your sign-off.
              </div>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-background px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
              <UserRound className="h-3 w-3" strokeWidth={2} /> your move
            </span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center font-mono text-[10px] leading-relaxed text-muted-foreground/50">
        Illustrative build update — the shape every Noon delivery takes.
      </p>
    </div>
  );
}
