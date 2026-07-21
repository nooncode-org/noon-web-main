"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* Explicit brand blue + tokens: this dialog PORTALS outside `.mxw-rd`, where
   `.site-primary-action` never lands (see workspace-add-domain.tsx). */
const BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-[6px] bg-[#0056fd] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0047e0]";
const BTN_SECONDARY =
  "inline-flex items-center justify-center rounded-[6px] border border-border bg-secondary/30 px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary";

/* Mock DNS records (front only — the real values come from the registrar/App). */
const DNS_RECORDS = [
  { type: "A", name: "@", value: "76.76.21.21" },
  { type: "CNAME", name: "www", value: "cname.nooncode.dev" },
];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable — no-op */
        }
      }}
      aria-label={`Copy ${value}`}
      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
    </button>
  );
}

/**
 * DomainSetupButton — the "Action needed" resolution for a domain (owner:
 * "puede ser ambos, 1 y 2"). Opens a dialog offering BOTH paths:
 *  - self-serve: the exact DNS records to add at the client's provider, with
 *    copy buttons + a "Verify" action;
 *  - team-assisted: "Let the team do it" → the Noon team handles the DNS.
 *
 * Front only for now: Verify is a no-op (logic later wires a DNS check); the
 * team path uses the existing custom-domain contact href.
 */
export function DomainSetupButton({
  domain,
  contactHref,
}: {
  domain: string;
  contactHref: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center rounded-[6px] border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/20"
      >
        Finish setup
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-[6px]">
          <DialogHeader>
            <DialogTitle className="break-all font-mono text-base">{domain}</DialogTitle>
            <DialogDescription>
              To finish connecting it, add these records at your domain provider (GoDaddy,
              Namecheap…), then verify. Prefer not to? Let your Noon team do it for you.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-hidden rounded-[6px] border border-border">
            <div className="grid grid-cols-[3rem_4rem_1fr_auto] items-center gap-3 border-b border-border bg-secondary/20 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
              <span>Type</span>
              <span>Name</span>
              <span>Value</span>
              <span className="sr-only">Copy</span>
            </div>
            {DNS_RECORDS.map((r) => (
              <div
                key={`${r.type}-${r.name}`}
                className="grid grid-cols-[3rem_4rem_1fr_auto] items-center gap-3 border-t border-border px-3 py-2.5 text-[13px]"
              >
                <span className="font-mono text-muted-foreground">{r.type}</span>
                <span className="font-mono">{r.name}</span>
                <span className="min-w-0 truncate font-mono">{r.value}</span>
                <CopyButton value={r.value} />
              </div>
            ))}
          </div>

          <DialogFooter className="sm:justify-between">
            <a href={contactHref} className={BTN_SECONDARY}>
              Let the team do it
            </a>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={BTN_PRIMARY}
            >
              Verify
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
