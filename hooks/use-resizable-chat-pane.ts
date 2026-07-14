"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Drives the drag-resizable chat↔preview divider in the Maxwell studio split
 * (desktop lg+). The chat pane's width lives in a `--mxw-chat-w` CSS variable on
 * the workspace container; during a drag we write that variable straight to the
 * DOM via rAF (no React re-render per pointermove — the pattern from
 * app/[locale]/contact/contact-scroll.tsx), then commit the final width to state
 * + localStorage on pointer-up. Restore-on-mount imitates
 * components/upgrade/upgrade-input.tsx to stay SSR-safe (never read storage
 * during render).
 */

const STORAGE_KEY = "maxwell_studio_split_width";
const DEFAULT_WIDTH = 440;
const MIN_CHAT = 360;
const MIN_PREVIEW = 400; // always leave this much for the preview pane
const KEYBOARD_STEP = 24;

function clampWidth(px: number, containerWidth: number): number {
  const max = Math.max(MIN_CHAT, containerWidth - MIN_PREVIEW);
  return Math.round(Math.min(max, Math.max(MIN_CHAT, px)));
}

export function useResizableChatPane() {
  // The workspace <main>. Its left edge already sits right of the sidebar rail,
  // so `clientX - rect.left` is exactly the desired chat width.
  const containerRef = useRef<HTMLElement | null>(null);
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<number>(DEFAULT_WIDTH);

  const applyVar = useCallback((px: number) => {
    containerRef.current?.style.setProperty("--mxw-chat-w", `${px}px`);
  }, []);

  const scheduleVar = useCallback(
    (px: number) => {
      pendingRef.current = px;
      if (frameRef.current != null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        applyVar(pendingRef.current);
      });
    },
    [applyVar],
  );

  const persist = useCallback((px: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(px));
    } catch {
      /* ignore storage errors (private mode / quota) */
    }
  }, []);

  // Restore the saved width once, after mount — clamped to the current
  // container so a wide saved value on a narrower screen still fits.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw == null) return;
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed)) return;
      const containerWidth =
        containerRef.current?.getBoundingClientRect().width ?? Number.POSITIVE_INFINITY;
      setWidth(clampWidth(parsed, containerWidth));
    } catch {
      /* ignore */
    }
    // run-once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return; // left button only
      const container = containerRef.current;
      const handle = e.currentTarget;
      if (!container) return;
      e.preventDefault();
      // Capture keeps the drag alive when the pointer crosses the cross-origin
      // preview iframe; window listeners (which still fire under capture, since
      // the event bubbles) do the actual tracking — robust across browsers and
      // synthetic test events alike.
      try {
        handle.setPointerCapture(e.pointerId);
      } catch {
        /* capture unsupported — window listeners still track */
      }
      setIsResizing(true);
      const rect = container.getBoundingClientRect();

      const onMove = (ev: PointerEvent) => {
        scheduleVar(clampWidth(ev.clientX - rect.left, rect.width));
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        try {
          handle.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        if (frameRef.current != null) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        const finalW = clampWidth(ev.clientX - rect.left, rect.width);
        applyVar(finalW);
        setWidth(finalW);
        setIsResizing(false);
        persist(finalW);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [applyVar, persist, scheduleVar],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const containerWidth =
        containerRef.current?.getBoundingClientRect().width ?? Number.POSITIVE_INFINITY;
      const delta = e.key === "ArrowLeft" ? -KEYBOARD_STEP : KEYBOARD_STEP;
      setWidth((w) => {
        const next = clampWidth(w + delta, containerWidth);
        applyVar(next);
        persist(next);
        return next;
      });
    },
    [applyVar, persist],
  );

  // Double-click the divider → back to the default split.
  const reset = useCallback(() => {
    applyVar(DEFAULT_WIDTH);
    setWidth(DEFAULT_WIDTH);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [applyVar]);

  return { containerRef, width, isResizing, onPointerDown, onKeyDown, reset };
}
