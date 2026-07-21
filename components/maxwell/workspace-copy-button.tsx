"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * CopyButton — one-click copy for a value the client shares often (their live
 * URL, a domain). Brief check-mark confirmation, then reverts. Clients paste
 * their site into WhatsApp / socials constantly; selecting text by hand is
 * friction this removes (owner ask 2026-07-20).
 */
export function WorkspaceCopyButton({
  value,
  label = "Copy",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${className}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
    </button>
  );
}
