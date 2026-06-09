"use client";

import { Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// WorkShot — a /work product mockup embedded as a LIVE, self-contained,
// same-origin iframe (public/work/mockups/*.html — DOM scales vector-crisp at
// any size, unlike raster screenshots). Each mockup carries its own fit()
// scaler, so it adapts to whatever box the iframe gives it. Inline: a
// pointer-events-none frame with a click-overlay that opens the same mockup
// large in a Radix-Dialog lightbox (where it stays interactive — hover etc.).

export type WorkShotFrame = { src: string; title: string; aspect: string };

export function WorkShot({ frame }: { frame: WorkShotFrame }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`View full size — ${frame.title}`}
          className="group relative block w-full cursor-zoom-in overflow-hidden rounded-[12px] border border-foreground/12 bg-card/30 outline-none transition-colors duration-200 hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-primary/45"
          style={{ aspectRatio: frame.aspect }}
        >
          <iframe
            src={frame.src}
            title={frame.title}
            loading="lazy"
            scrolling="no"
            className="pointer-events-none absolute inset-0 h-full w-full border-0"
          />
          <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-background/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
            <Maximize2 className="h-3 w-3" strokeWidth={2} />
            View detail
          </span>
        </button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="block w-[min(96vw,1700px)] max-w-none gap-0 overflow-hidden border-foreground/15 bg-background p-2 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{frame.title}</DialogTitle>
        <div className="max-h-[86vh] overflow-hidden rounded-[8px]" style={{ aspectRatio: frame.aspect }}>
          <iframe src={frame.src} title={frame.title} scrolling="no" className="h-full w-full border-0" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
