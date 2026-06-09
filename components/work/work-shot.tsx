"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// WorkShot — a /work product mockup embedded as a LIVE, self-contained,
// same-origin iframe (public/work/mockups/*.html).
//
// CRITICAL: the iframe keeps a CONSTANT internal viewport (the mockup's
// authoring size, e.g. 1560×980) and the PARENT scales it with a CSS
// transform. The mockups' .window is a flex item of a centering .stage —
// at any narrower live viewport it flex-shrinks and the whole layout
// REFLOWS (truncated names, colliding table headers — Playwright-diagnosed).
// A fixed layout viewport makes that reflow impossible at every box size;
// same-origin iframes re-rasterize under ancestor transforms, so text stays
// vector-crisp at the composited scale.

export type WorkShotFrame = { src: string; title: string; w: number; h: number };

function ScaledFrame({
  frame,
  interactive = false,
  lazy = true,
}: {
  frame: WorkShotFrame;
  interactive?: boolean;
  lazy?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / frame.w);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [frame.w]);

  return (
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: `${frame.w} / ${frame.h}` }}
    >
      <iframe
        src={frame.src}
        title={frame.title}
        loading={lazy ? "lazy" : "eager"}
        scrolling="no"
        className={`absolute left-0 top-0 border-0 ${interactive ? "" : "pointer-events-none"}`}
        style={{
          width: frame.w,
          height: frame.h,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          visibility: scale > 0 ? "visible" : "hidden",
        }}
      />
    </div>
  );
}

export function WorkShot({ frame }: { frame: WorkShotFrame }) {
  return (
    <Dialog>
      <div className="lg:relative lg:left-1/2 lg:w-[min(94vw,1400px)] lg:-translate-x-1/2">
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={`View full size — ${frame.title}`}
            className="group relative block w-full cursor-zoom-in overflow-hidden rounded-[12px] border border-foreground/12 bg-card/30 outline-none transition-colors duration-200 hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-primary/45"
          >
            <ScaledFrame frame={frame} />
            <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-background/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
              <Maximize2 className="h-3 w-3" strokeWidth={2} />
              View detail
            </span>
          </button>
        </DialogTrigger>
      </div>
      <DialogContent
        aria-describedby={undefined}
        className="block w-[min(96vw,1700px)] max-w-none gap-0 overflow-hidden border-foreground/15 bg-background p-2 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{frame.title}</DialogTitle>
        <div className="max-h-[88vh] overflow-auto overscroll-contain rounded-[8px]">
          <div className="w-full min-w-[1100px]">
            <ScaledFrame frame={frame} interactive lazy={false} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
