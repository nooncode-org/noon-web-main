"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// WorkShot — a /work product mockup embedded as a LIVE, INTERACTIVE,
// self-contained same-origin iframe (public/work/mockups/*.html). Owner wants
// the real HTML in the section (hover states alive), not a screenshot.
//
// Why an iframe and not the raw HTML inlined into the page DOM: each mockup
// ships its own global <style>, @font-face and a fit() script — inlining would
// leak those and wreck the site's CSS. The iframe IS "the HTML, directly,"
// just style/script-isolated.
//
// Scaling: the iframe holds a CONSTANT internal viewport (authoring size, e.g.
// 1560×980) and the parent scales it with a measured CSS transform. A fixed
// inner viewport makes the fixed-width design's flex layout impossible to
// reflow at any box size (Playwright-verified); same-origin iframes
// re-rasterize under the transform, so text stays vector-crisp.
//
// Interactivity is responsive: live on desktop (lg+) with an explicit Expand
// button; on touch the iframe stays pointer-events-none so a drag scrolls the
// PAGE (no scroll-trap) and the whole surface taps open the lightbox — where
// it becomes interactive and pannable.

export type WorkShotFrame = { src: string; title: string; w: number; h: number };

function ScaledFrame({
  frame,
  interactive,
  lazy = true,
}: {
  frame: WorkShotFrame;
  interactive: "lg" | "always";
  lazy?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // Overscan in ALL FOUR directions: the iframe is scaled +2px and shifted
    // -1px,-1px so it overhangs every edge by ~1px; overflow-hidden clips it.
    // A bottom-right-only overscan left a hairline at the TOP edge, where the
    // dialog's fractional translate(-50%) centering put the box on a sub-pixel
    // row and the dimmed backdrop bled through against the dark mockups.
    const measure = () => setScale((el.clientWidth + 2) / frame.w);
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
        className={`absolute left-0 top-0 border-0 ${
          interactive === "always" ? "" : "pointer-events-none lg:pointer-events-auto"
        }`}
        style={{
          width: frame.w,
          height: frame.h,
          transform: `translate(-1px, -1px) scale(${scale})`,
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
      <div className="group relative">
        <div className="overflow-hidden rounded-[12px] border border-foreground/12">
          <ScaledFrame frame={frame} interactive="lg" />
        </div>

        {/* touch: the whole surface taps to expand (iframe is inert there) */}
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={`View full size — ${frame.title}`}
            className="absolute inset-0 cursor-zoom-in rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-primary/45 lg:hidden"
          />
        </DialogTrigger>

        {/* desktop: live & interactive — explicit Expand affordance only */}
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={`View full size — ${frame.title}`}
            className="absolute bottom-3 right-3 hidden items-center gap-1.5 rounded-full border border-foreground/15 bg-background/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur-sm transition-colors duration-200 hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 lg:inline-flex"
          >
            <Maximize2 className="h-3 w-3" strokeWidth={2} />
            Expand
          </button>
        </DialogTrigger>
      </div>

      {/* Frameless but rounded: no dialog border/padding/bg, and the mockup's
         own window border is stripped at build time — the rounded corners come
         from this container clipping the (square) project, so there's no frame
         or background, just softened corners (owner: don't leave it so square). */}
      <DialogContent
        aria-describedby={undefined}
        className="block w-[min(96vw,1700px)] max-w-none gap-0 overflow-hidden rounded-[12px] border-transparent bg-transparent p-0 shadow-2xl sm:max-w-none"
      >
        <DialogTitle className="sr-only">{frame.title}</DialogTitle>
        <div className="max-h-[88vh] overflow-auto overscroll-contain">
          <div className="w-full min-w-[1100px]">
            <ScaledFrame frame={frame} interactive="always" lazy={false} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
