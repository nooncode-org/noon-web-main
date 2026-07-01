"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export function ContactScroll({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroll = scrollRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!scroll || !track || !thumb) return;

    // sync thumb position + size directly to DOM — zero React re-renders
    function sync() {
      const { scrollTop, scrollHeight, clientHeight } = scroll!;
      const scrollable = scrollHeight - clientHeight;
      if (scrollable <= 1) {
        track!.dataset.visible = "false";
        return;
      }
      const height = Math.max(32, (clientHeight / scrollHeight) * clientHeight);
      const top = (scrollTop / scrollable) * (clientHeight - height);
      thumb!.style.top = `${top}px`;
      thumb!.style.height = `${height}px`;
      track!.dataset.visible = "true";
    }

    // drag state — kept in a plain object, never touches React
    let drag: { startY: number; startScroll: number } | null = null;

    function onPointerDown(e: PointerEvent) {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      drag = { startY: e.clientY, startScroll: scroll!.scrollTop };
    }

    function onPointerMove(e: PointerEvent) {
      if (!drag) return;
      const { scrollHeight, clientHeight } = scroll!;
      const scrollable = scrollHeight - clientHeight;
      const thumbH = Math.max(32, (clientHeight / scrollHeight) * clientHeight);
      const denom = clientHeight - thumbH;
      if (denom <= 0) return;
      scroll!.scrollTop = drag.startScroll + ((e.clientY - drag.startY) * scrollable) / denom;
    }

    function onPointerUp(e: PointerEvent) {
      drag = null;
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* already released */ }
    }

    const ro = new ResizeObserver(sync);
    ro.observe(scroll);
    if (scroll.firstElementChild) ro.observe(scroll.firstElementChild);

    scroll.addEventListener("scroll", sync, { passive: true });
    thumb.addEventListener("pointerdown", onPointerDown);
    thumb.addEventListener("pointermove", onPointerMove);
    thumb.addEventListener("pointerup", onPointerUp);
    window.addEventListener("resize", sync);
    requestAnimationFrame(sync);

    return () => {
      scroll.removeEventListener("scroll", sync);
      thumb.removeEventListener("pointerdown", onPointerDown);
      thumb.removeEventListener("pointermove", onPointerMove);
      thumb.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", sync);
      ro.disconnect();
    };
  }, []);

  return (
    <>
      <div className="ct-scroll" ref={scrollRef}>
        {children}
      </div>
      <div className="ct-sb" ref={trackRef} aria-hidden>
        <div className="ct-sb-thumb" ref={thumbRef}>
          <span className="ct-sb-bar" />
        </div>
      </div>
    </>
  );
}
