"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { goToWorkspaceChat } from "@/components/maxwell/workspace-chat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* Primary/secondary button classes, self-contained: this dialog PORTALS to
   <body>, OUTSIDE `.mxw-rd`, where the `.site-primary-action` override never
   lands — so the primary uses an explicit brand blue. Tokens (bg-secondary,
   border, muted-foreground…) DO reach the portal via `:root:has(.mxw-rd)`. */
const BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-[6px] bg-[#0056fd] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0047e0] disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground";
const BTN_SECONDARY =
  "inline-flex items-center justify-center rounded-[6px] border border-border bg-secondary/30 px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary";

/* Mock TLD catalog for the Buy flow (front only — real availability + pricing
   comes from the registrar API later). */
const BUY_TLDS = [".com", ".io", ".co", ".app", ".dev"] as const;
const BUY_PRICE: Record<string, number> = {
  ".com": 12,
  ".io": 39,
  ".co": 24,
  ".app": 14,
  ".dev": 14,
};

/**
 * AddDomainButtons — the Domains toolbar's right-side actions.
 *
 * "Add Existing" → dialog where the CLIENT types a domain they ALREADY own;
 * the Noon team does the DNS/config (no operator controls — that's the team's
 * job). "Buy" → dialog to find + buy a NEW domain (search → availability +
 * price → Buy per row); once it's theirs the team connects it.
 *
 * Front only (owner: "logic later"): Add-Existing submit + per-row Buy just
 * close; the real build wires Add-Existing to a connect-domain request and Buy
 * to the registrar API + checkout.
 */
export function AddDomainButtons({
  viaChat = false,
  hidden = false,
}: {
  /** Membership ended → the portal is read-only, so these actions don't exist. */
  hidden?: boolean;
  /**
   * Real mode: submitting hands the client to the Chat with the request typed
   * and focused (their channel that actually reaches the team) — the registrar
   * purchase + connect-domain automation are later (#27/#28). Absent = the mock's
   * front-only close.
   */
  viaChat?: boolean;
} = {}) {
  const [addOpen, setAddOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const canAdd = domain.trim().length > 0;

  const [buyOpen, setBuyOpen] = useState(false);
  const [buyQuery, setBuyQuery] = useState("");

  const base = buyQuery
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9-].*$/, "");
  const buyResults = base
    ? BUY_TLDS.map((tld) => ({
        domain: base + tld,
        price: BUY_PRICE[tld],
        // .com of a real name is usually taken — show both states.
        available: tld !== ".com",
      }))
    : [];

  function submitAdd() {
    if (!canAdd) return;
    if (viaChat) {
      goToWorkspaceChat(
        `Hi — I'd like to connect my domain ${domain.trim()} to my site. Could you set it up?`,
      );
    }
    // TODO(logic later): create a "connect domain" request automatically.
    setAddOpen(false);
    setDomain("");
  }

  function buy(chosen?: string) {
    if (viaChat && chosen) {
      goToWorkspaceChat(`Hi — I'd like to buy the domain ${chosen}. Can you handle it for me?`);
    }
    // TODO(logic later): registrar API purchase + checkout, then the team connects it.
    setBuyOpen(false);
    setBuyQuery("");
  }

  return (
    <div className={`flex shrink-0 items-center gap-2 ${hidden ? "hidden" : ""}`}>
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="inline-flex items-center rounded-[6px] border border-border bg-secondary/40 px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
      >
        Add Existing
      </button>
      <button
        type="button"
        onClick={() => setBuyOpen(true)}
        // border-transparent: its sibling "Add Existing" carries a real 1px
        // border — without matching box metrics Buy renders 2px shorter.
        className="inline-flex items-center rounded-[6px] border border-transparent bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Buy
      </button>

      {/* Add Existing — connect a domain the client already owns. */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-[8px]">
          <DialogHeader>
            <DialogTitle>Add your domain</DialogTitle>
            <DialogDescription>
              Enter a domain you already own. Your Noon team connects it to your project and
              handles all the DNS — you never touch a thing.
            </DialogDescription>
          </DialogHeader>

          <div>
            <label
              htmlFor="add-domain-input"
              className="mb-1 block text-[11px] text-muted-foreground"
            >
              Domain
            </label>
            <input
              id="add-domain-input"
              type="text"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitAdd();
              }}
              placeholder="yourbrand.com"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-[6px] border border-border bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground/50 focus-visible:border-foreground/30"
            />
          </div>

          <DialogFooter>
            <button type="button" onClick={() => setAddOpen(false)} className={BTN_SECONDARY}>
              Cancel
            </button>
            <button type="button" onClick={submitAdd} disabled={!canAdd} className={BTN_PRIMARY}>
              Add domain
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buy — find + buy a new domain (front only; registrar API + checkout later). */}
      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="rounded-[8px]">
          <DialogHeader>
            <DialogTitle>Buy a domain</DialogTitle>
            <DialogDescription>
              Find a new domain for your project. Once it&apos;s yours, your Noon team connects
              it and handles the DNS — no setup on your end.
            </DialogDescription>
          </DialogHeader>

          <div>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60"
                strokeWidth={1.75}
              />
              <input
                type="text"
                value={buyQuery}
                onChange={(event) => setBuyQuery(event.target.value)}
                placeholder="Search for a domain"
                aria-label="Search for a domain to buy"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-[6px] border border-border bg-transparent py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/50 focus-visible:border-foreground/30"
              />
            </div>

            {buyResults.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted-foreground">
                Type a name to see available domains.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border overflow-hidden rounded-[6px] border border-border">
                {buyResults.map((r) => (
                  <li key={r.domain} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1 truncate font-mono text-sm">{r.domain}</span>
                    {r.available ? (
                      <>
                        <span className="shrink-0 text-[12px] text-muted-foreground">
                          ${r.price}/yr
                        </span>
                        <button
                          type="button"
                          onClick={() => buy(r.domain)}
                          className="shrink-0 rounded-[6px] bg-[#0056fd] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0047e0]"
                        >
                          Buy
                        </button>
                      </>
                    ) : (
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Taken
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
