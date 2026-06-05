"use client";

/**
 * DemoPrototypePreview — the right-hand "generated prototype" pane for the
 * Maxwell demo. Renders a faithful, theme-aware "Client order portal" (the
 * scope from the demo conversation) inside a preview chrome that mirrors the
 * real studio-preview-pane bar (traffic lights + version + open full screen).
 *
 * This is the demo stand-in for the live v0 iframe — built as native DOM so
 * it's interactive, crisp, and respects light/dark.
 */

import { ExternalLink } from "lucide-react";

type Order = {
  id: string;
  customer: string;
  items: string;
  status: "Delivered" | "In transit" | "Processing";
  eta: string;
};

const ORDERS: Order[] = [
  { id: "ORD-4821", customer: "Northwind Co.", items: "3 items", status: "In transit", eta: "Tomorrow" },
  { id: "ORD-4817", customer: "Globex Ltd.", items: "1 item", status: "Delivered", eta: "Jun 2" },
  { id: "ORD-4810", customer: "Soylent Corp.", items: "5 items", status: "Processing", eta: "Jun 9" },
  { id: "ORD-4802", customer: "Initech", items: "2 items", status: "Delivered", eta: "May 30" },
];

const STATUS_STYLES: Record<Order["status"], string> = {
  Delivered: "bg-green-500/12 text-green-700 dark:text-green-400",
  "In transit": "bg-blue-500/12 text-blue-700 dark:text-blue-400",
  Processing: "bg-amber-500/12 text-amber-700 dark:text-amber-500",
};

export function DemoPrototypePreview() {
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Preview bar — mirrors the real studio-preview-pane chrome */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>
          <span className="text-xs font-mono text-muted-foreground">Version 1</span>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          Open full screen
          <ExternalLink className="h-3 w-3" />
        </span>
      </div>

      {/* Generated prototype: a client order portal */}
      <div className="flex-1 overflow-y-auto">
        {/* Portal top bar */}
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
              A
            </div>
            <span className="text-sm font-semibold text-foreground">Acme Logistics</span>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[11px] font-medium text-muted-foreground">
            JD
          </div>
        </div>

        <div className="px-5 py-4">
          {/* Title + live */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">Your orders</h3>
              <p className="text-xs text-muted-foreground">Real-time status across your account</p>
            </div>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
              </span>
              Live
            </span>
          </div>

          {/* Stat tiles */}
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            {[
              { label: "Active", value: "12" },
              { label: "In transit", value: "4" },
              { label: "Delivered", value: "87" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-card px-3 py-2.5">
                <p className="text-lg font-semibold tabular-nums text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Order list */}
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-border bg-secondary/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>Order</span>
              <span>Status</span>
            </div>
            {ORDERS.map((o) => (
              <div
                key={o.id}
                className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-border/60 px-3 py-2.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">
                    {o.id} · {o.customer}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {o.items} · ETA {o.eta}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[o.status]}`}
                >
                  {o.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
