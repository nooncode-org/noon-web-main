"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Split "Visit" button (Vercel-style): the left part opens the live site in a
 * new tab; the chevron toggles a menu of the available destinations —
 * "Preview" (the latest version's preview URL) and "Live" (the published MVP).
 * Preview only appears when a preview URL is available.
 */
export function VisitButton({
  liveUrl,
  previewUrl,
}: {
  liveUrl: string;
  previewUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const itemClass =
    "block px-3 py-1.5 text-foreground transition-colors hover:bg-secondary";

  return (
    <div ref={ref} className="relative inline-flex">
      <div className="inline-flex overflow-hidden rounded-[6px] border border-border bg-card text-xs font-medium text-foreground">
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 transition-colors hover:bg-secondary"
        >
          Visit
        </a>
        <span className="w-px self-stretch bg-border" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Choose destination"
          aria-expanded={open}
          className="flex items-center px-1.5 transition-colors hover:bg-secondary"
        >
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-[6px] border border-border bg-card py-1 text-xs shadow-lg">
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              Preview
            </a>
          )}
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            Live
          </a>
        </div>
      )}
    </div>
  );
}
