import { ArrowRight, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";

// ============================================================================
// UpgradeAuditPreview — a FAITHFUL, static representation of the real Upgrade
// tool output (components/upgrade/upgrade-audit.tsx): the audit a live site
// receives after the scan — an overall score, what's working, critical issues,
// per-section scores, and the "Create upgraded version" action.
//
// Native dark product palette, framed as a real product window (like the
// Maxwell preview). Coherent sample findings, no decorative effects.
// ============================================================================

const SECTIONS = [
  { label: "Performance", score: 7 },
  { label: "Accessibility", score: 6 },
  { label: "Design", score: 8 },
  { label: "Conversion", score: 4 },
] as const;

// audit color scale (real thresholds: >=7 good, >=5 warn, else critical)
function scoreColor(n: number) {
  if (n >= 7) return "text-emerald-400";
  if (n >= 5) return "text-amber-400";
  return "text-red-400";
}
function dotColor(n: number) {
  if (n >= 7) return "bg-emerald-400";
  if (n >= 5) return "bg-amber-400";
  return "bg-red-400";
}

export function UpgradeAuditPreview({ className = "" }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-[10px] border border-white/10 bg-[#050505] text-zinc-100 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] ${className}`}
    >
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#0a0a0a] px-3 py-2">
        <span className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-zinc-700" />
          <span className="h-2 w-2 rounded-full bg-zinc-700" />
          <span className="h-2 w-2 rounded-full bg-zinc-700" />
        </span>
        <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">
          upgrade · audit
        </span>
        <span className="ml-auto font-mono text-[10px] text-zinc-500">acme.com</span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[1.4fr_1fr] sm:p-5">
        {/* left — findings */}
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-semibold text-zinc-100">Website audit</span>
              <span className="font-mono text-[10px] text-zinc-500">12 pages analyzed</span>
            </div>
          </div>

          {/* what's working */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
              <span className="text-[11px] font-medium text-zinc-300">What&apos;s working</span>
            </div>
            <ul className="space-y-1">
              {["Clear value proposition above the fold", "Fast first paint on mobile"].map((s) => (
                <li key={s} className="flex gap-2 text-[11px] leading-snug text-zinc-400">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* critical issues */}
          <div className="rounded-[8px] border border-red-500/20 bg-red-500/[0.06] p-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" strokeWidth={2} />
              <span className="text-[11px] font-medium text-zinc-300">Critical issues</span>
            </div>
            <ul className="space-y-1">
              {["No clear primary CTA on the landing page", "Contact form buried three clicks deep"].map((s) => (
                <li key={s} className="flex gap-2 text-[11px] leading-snug text-zinc-400">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-400/70" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* right — score + sections + cta */}
        <div className="flex flex-col gap-4">
          {/* overall score */}
          <div className="flex items-center justify-between rounded-[8px] border border-white/10 bg-[#0c0c0c] px-3 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">Overall</span>
            <span className="font-mono text-[22px] font-semibold leading-none text-emerald-400">
              7<span className="text-[13px] text-zinc-600">/10</span>
            </span>
          </div>

          {/* per-section scores */}
          <div className="space-y-1.5">
            {SECTIONS.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${dotColor(s.score)}`} />
                <span className="text-[11px] text-zinc-400">{s.label}</span>
                <span className={`ml-auto font-mono text-[11px] font-semibold ${scoreColor(s.score)}`}>
                  {s.score}
                </span>
              </div>
            ))}
          </div>

          {/* cta */}
          <span className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-[8px] bg-[#1200c5] px-3 py-2 text-[11px] font-medium text-white">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            Create upgraded version
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        </div>
      </div>
    </div>
  );
}
