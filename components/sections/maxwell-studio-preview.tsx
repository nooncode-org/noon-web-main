import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";

// ============================================================================
// MaxwellStudioPreview — a FAITHFUL, static representation of Noon's real
// product: the Maxwell scoping studio in its "prototype ready" phase. Layout,
// labels, phases and CTAs mirror the actual app (components/maxwell/*): a
// two-pane workspace — scoping chat on the left, the generated working
// prototype on the right, with the real Approve / Request-adjustment actions.
//
// It is rendered in the product's NATIVE dark palette (#050505 / #131313) and
// framed as a product window, the way Vercel/Linear embed real product shots —
// so it reads as the actual tool, independent of the page's light/dark theme.
// No decorative gradients; the only motion is the live "prototype ready" dot.
// ============================================================================

const ORDERS = [
  { id: "#1042", customer: "Acme Co", status: "Shipped", total: "$1,240", tone: "emerald" },
  { id: "#1041", customer: "Lite Studio", status: "Processing", total: "$480", tone: "amber" },
  { id: "#1039", customer: "Northwind", status: "Shipped", total: "$2,150", tone: "emerald" },
  { id: "#1036", customer: "Globex", status: "Delivered", total: "$760", tone: "zinc" },
] as const;

const TONE: Record<string, string> = {
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  zinc: "bg-zinc-500",
};

export function MaxwellStudioPreview({ className = "" }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-[10px] border border-white/10 bg-[#050505] text-zinc-100 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] ${className}`}
    >
      {/* ── App header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-[#0a0a0a] px-3 py-2">
        <ArrowLeft className="h-3.5 w-3.5 text-zinc-500" strokeWidth={2} />
        <span className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-[5px] bg-[#1200c5]">
            <Sparkles className="h-2.5 w-2.5 text-white" strokeWidth={2} />
          </span>
          <span className="text-[12px] font-medium text-zinc-200">Client order portal</span>
        </span>
        <span className="ml-3 hidden items-center gap-1.5 sm:flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#4155ef] opacity-70 motion-safe:animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#4155ef]" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            Prototype ready
          </span>
        </span>
        <span className="ml-auto hidden items-center gap-1.5 font-mono text-[10px] text-zinc-600 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
          2 / 2
        </span>
      </div>

      {/* ── Two-pane workspace ─────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row">
        {/* Left — scoping chat */}
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 lg:w-[290px] lg:shrink-0 lg:border-b-0 lg:border-r">
          {/* user message */}
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-[16px] rounded-tr-sm bg-[#131313] px-3 py-2 text-[12px] leading-relaxed text-zinc-200">
              Build a client portal where customers track their orders in real time.
            </p>
          </div>
          {/* assistant message */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-[#4155ef]" strokeWidth={2} />
              <span className="font-mono text-[10px] text-zinc-500">Maxwell mapped this</span>
              <CheckCircle2 className="h-3 w-3 text-emerald-400/80" strokeWidth={2} />
              <span className="font-mono text-[10px] text-zinc-600">Ready in 9s</span>
            </div>
            <p className="text-[12px] leading-relaxed text-zinc-300">
              Here&apos;s a working first version — sign-in, an order list scoped per client, and
              live status. Want anything adjusted before the formal proposal?
            </p>
          </div>
          {/* input */}
          <div className="mt-auto flex items-center gap-2 rounded-[10px] border border-white/10 bg-[#131313] px-3 py-2">
            <span className="flex-1 text-[12px] text-zinc-600">Ask a follow-up…</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10">
              <ArrowRight className="h-3.5 w-3.5 text-zinc-300" strokeWidth={2} />
            </span>
          </div>
        </div>

        {/* Right — generated prototype */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* preview chrome */}
          <div className="flex items-center gap-2 border-b border-white/10 bg-[#0a0a0a] px-3 py-2">
            <span className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-zinc-700" />
              <span className="h-2 w-2 rounded-full bg-zinc-700" />
              <span className="h-2 w-2 rounded-full bg-zinc-700" />
            </span>
            <span className="ml-1 flex gap-1">
              <span className="rounded-[5px] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">v1</span>
              <span className="inline-flex items-center gap-1 rounded-[5px] border border-white/10 bg-[#131313] px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                v2 <span className="h-1 w-1 rounded-full bg-[#4155ef]" />
              </span>
            </span>
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-zinc-600">
              Open full screen <ExternalLink className="h-3 w-3" strokeWidth={2} />
            </span>
          </div>

          {/* generated app — a real client order portal UI */}
          <div className="flex flex-1 flex-col gap-3 bg-[#0c0c0c] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-zinc-100">Orders</span>
              <span className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-500">
                  <Search className="h-3 w-3" strokeWidth={2} /> Search
                </span>
                <span className="h-5 w-5 rounded-full bg-[#1200c5]/70" />
              </span>
            </div>

            <div className="overflow-hidden rounded-[8px] border border-white/10">
              <div className="grid grid-cols-[1fr_1.4fr_1fr_0.8fr] gap-2 border-b border-white/10 bg-white/[0.02] px-3 py-1.5 font-mono text-[9px] uppercase tracking-wide text-zinc-600">
                <span>Order</span>
                <span>Customer</span>
                <span>Status</span>
                <span className="text-right">Total</span>
              </div>
              <div className="divide-y divide-white/5">
                {ORDERS.map((o) => (
                  <div
                    key={o.id}
                    className="grid grid-cols-[1fr_1.4fr_1fr_0.8fr] items-center gap-2 px-3 py-2 text-[11px]"
                  >
                    <span className="font-mono text-zinc-400">{o.id}</span>
                    <span className="truncate text-zinc-200">{o.customer}</span>
                    <span className="inline-flex items-center gap-1.5 text-zinc-400">
                      <span className={`h-1.5 w-1.5 rounded-full ${TONE[o.tone]}`} />
                      {o.status}
                    </span>
                    <span className="text-right font-medium text-zinc-200">{o.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* actions — the real approve / adjust controls */}
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-[#0a0a0a] px-3 py-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#1200c5] px-3 py-1.5 text-[11px] font-medium text-white">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
              Approve prototype
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-white/12 px-3 py-1.5 text-[11px] font-medium text-zinc-300">
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
              Request adjustment
              <span className="rounded-full border border-white/12 px-1.5 py-0.5 font-mono text-[9px] text-zinc-500">
                2 left
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
