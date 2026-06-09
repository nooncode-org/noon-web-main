"use client";

import Image from "next/image";
import { Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// WorkShot — a /work product capture with a click-to-expand lightbox. The
// showcase renders 1440px-wide dashboard UIs; inline they read as product
// shots, and the lightbox shows the full-resolution capture (~1700px) so the
// detail is actually legible. Radix Dialog supplies Esc/focus/aria.

export type WorkShotImage = { src: string; alt: string; w: number; h: number };

export function WorkShot({ image, title }: { image: WorkShotImage; title: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`View full size — ${title}`}
          className="group relative block w-full cursor-zoom-in overflow-hidden rounded-[12px] border border-foreground/12 outline-none transition-colors duration-200 hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-primary/45"
        >
          <Image
            src={image.src}
            alt={image.alt}
            width={image.w}
            height={image.h}
            sizes="(min-width: 1024px) 640px, 100vw"
            className="h-auto w-full"
          />
          <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-background/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
            <Maximize2 className="h-3 w-3" strokeWidth={2} />
            View detail
          </span>
        </button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="block w-[min(96vw,1700px)] max-w-none gap-0 border-foreground/15 bg-background p-2 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <Image
          src={image.src}
          alt={image.alt}
          width={image.w}
          height={image.h}
          sizes="96vw"
          className="max-h-[86vh] w-full rounded-[8px] object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
