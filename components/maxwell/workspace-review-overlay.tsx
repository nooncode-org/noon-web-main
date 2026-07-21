"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { X, Crop, Plus, ArrowUp } from "lucide-react";

/**
 * ReviewOverlay — the client's "point at your own site" tool, opened from the
 * chat composer's "+" menu → "Review site". Full-screen (like the studio
 * Preview): the site fills the viewport under a slim toolbar, with a LIGHT
 * FLOATING overlay on top — never a separate window (owner flow 2026-07-20).
 *
 * Flow: idle (browse + floating "Select area" pill) → capture mode (crosshair,
 * drag a box) → the box becomes ADJUSTABLE (move it, resize by its corners)
 * while a FIXED bottom bar holds the note input + actions (it never clips,
 * unlike the old box-anchored popover). "Add another area" commits the box and
 * lets the client mark more — marks are numbered; ONE note travels with all of
 * them to the chat on Send.
 *
 * Front only (logic later). It lives 100% in the portal — never injected into
 * the client's live site (owner call 2026-07-20). The site is a representative
 * mock; the real version renders a SERVER-SIDE SCREENSHOT of the client's site
 * here, and that screenshot replaces the schematic thumbnail in the chat.
 */

export type Rect = { x: number; y: number; w: number; h: number }; // all in % of the frame
export type ReviewMark = { rects: Rect[]; note: string; host: string };

type DragState =
  | { kind: "draw"; start: { x: number; y: number } }
  | { kind: "move"; start: { x: number; y: number }; orig: Rect }
  | { kind: "nw" | "ne" | "sw" | "se"; orig: Rect };

const MIN = 2; // minimum box side, in %

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const boxStyle = (r: Rect) => ({
  left: `${r.x}%`,
  top: `${r.y}%`,
  width: `${r.w}%`,
  height: `${r.h}%`,
});

/** Resize `orig` by dragging one corner to pointer `p`, opposite corner fixed. */
function resizeRect(orig: Rect, kind: "nw" | "ne" | "sw" | "se", p: { x: number; y: number }): Rect {
  const right = orig.x + orig.w;
  const bottom = orig.y + orig.h;
  let { x, y, w, h } = orig;
  if (kind === "se") {
    w = clamp(p.x - orig.x, MIN, 100 - orig.x);
    h = clamp(p.y - orig.y, MIN, 100 - orig.y);
  } else if (kind === "nw") {
    x = clamp(Math.min(p.x, right - MIN), 0, right - MIN);
    y = clamp(Math.min(p.y, bottom - MIN), 0, bottom - MIN);
    w = right - x;
    h = bottom - y;
  } else if (kind === "ne") {
    y = clamp(Math.min(p.y, bottom - MIN), 0, bottom - MIN);
    w = clamp(p.x - orig.x, MIN, 100 - orig.x);
    h = bottom - y;
  } else {
    x = clamp(Math.min(p.x, right - MIN), 0, right - MIN);
    w = right - x;
    h = clamp(p.y - orig.y, MIN, 100 - orig.y);
  }
  return { x, y, w, h };
}

export function ReviewOverlay({
  siteUrl,
  embed = false,
  onClose,
  onAttach,
}: {
  siteUrl: string;
  /**
   * Real mode: iframe the client's actual site instead of the MockSite stand-in.
   * Marks map to the visible viewport of the embed (the iframe scrolls its own
   * document); the server-side full-page capture is the later step (#27).
   */
  embed?: boolean;
  onClose: () => void;
  onAttach: (mark: ReviewMark) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  // Drag performance — the reason this used to feel laggy next to a native snip:
  // every pointermove did a setState, re-rendering the WHOLE preview (the site
  // DOM + overlay) each frame. Now a gesture writes the box geometry STRAIGHT to
  // the DOM inside a rAF (zero React renders), and state is committed once on
  // pointerup. The frame rect is cached at gesture start so we never re-read
  // layout mid-drag either.
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRectRef = useRef<DOMRect | null>(null);
  const liveRef = useRef<Rect | null>(null);
  const rafRef = useRef<number | null>(null);

  // idle = browsing the preview (floating pill). selecting = crosshair, can
  // draw. adjusting = the drawn box is live (move/resize) + bottom bar.
  const [mode, setMode] = useState<"idle" | "selecting" | "adjusting">("idle");
  const [draft, setDraft] = useState<Rect | null>(null);
  const [marks, setMarks] = useState<Rect[]>([]);
  const [note, setNote] = useState("");

  const host = siteUrl.replace(/^https?:\/\//, "");

  const resetAll = useCallback(() => {
    dragRef.current = null;
    liveRef.current = null;
    setDraft(null);
    setMarks([]);
    setNote("");
    setMode("idle");
  }, []);

  // Escape steps back: discard the in-progress box first; with nothing in
  // progress (and nothing marked), close down to the idle preview.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (draft) {
        setDraft(null);
        setMode("selecting");
      } else if (marks.length === 0 && mode !== "idle") {
        setMode("idle");
      } else if (mode === "idle") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [draft, marks.length, mode, onClose]);

  const toPct = useCallback((clientX: number, clientY: number) => {
    // Cached at gesture start — re-reading layout every move is a jank source.
    const r = frameRectRef.current ?? frameRef.current!.getBoundingClientRect();
    return {
      x: clamp(((clientX - r.left) / r.width) * 100, 0, 100),
      y: clamp(((clientY - r.top) / r.height) * 100, 0, 100),
    };
  }, []);

  // Write the live rect straight to the box element — no React render.
  const applyLive = useCallback(() => {
    rafRef.current = null;
    const r = liveRef.current;
    const el = boxRef.current;
    if (!r || !el) return;
    el.style.left = `${r.x}%`;
    el.style.top = `${r.y}%`;
    el.style.width = `${r.w}%`;
    el.style.height = `${r.h}%`;
  }, []);

  const schedule = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(applyLive);
  }, [applyLive]);

  // End of a gesture: stop the rAF and sync React state to what's on screen.
  const commitLive = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (liveRef.current) setDraft(liveRef.current);
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const beginGesture = (e: ReactPointerEvent<HTMLElement>) => {
    frameRectRef.current = frameRef.current?.getBoundingClientRect() ?? null;
    // Pointer capture keeps a drag alive outside the element; a throw (stale
    // or synthetic pointer) must never break the gesture.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
  };

  // ── Draw (selecting mode, on the crosshair layer) ──
  function onDrawDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (mode !== "selecting") return;
    beginGesture(e);
    const p = toPct(e.clientX, e.clientY);
    const r = { x: p.x, y: p.y, w: 0, h: 0 };
    dragRef.current = { kind: "draw", start: p };
    liveRef.current = r;
    setDraft(r); // the one render of the gesture: mounts the box we then drive
  }

  function onDrawMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "draw") return;
    const p = toPct(e.clientX, e.clientY);
    liveRef.current = {
      x: Math.min(drag.start.x, p.x),
      y: Math.min(drag.start.y, p.y),
      w: Math.abs(p.x - drag.start.x),
      h: Math.abs(p.y - drag.start.y),
    };
    schedule();
  }

  function onDrawUp() {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "draw") return;
    dragRef.current = null;
    const r = liveRef.current;
    // A tap (no real drag) → a small default box centered on the point.
    if (r && (r.w < MIN || r.h < MIN)) {
      liveRef.current = { x: clamp(r.x - 8, 0, 84), y: clamp(r.y - 5, 0, 90), w: 16, h: 10 };
    }
    commitLive();
    setMode("adjusting");
  }

  // ── Move (adjusting mode, on the box itself) ──
  function onMoveDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (mode !== "adjusting" || !draft) return;
    e.stopPropagation();
    beginGesture(e);
    dragRef.current = { kind: "move", start: toPct(e.clientX, e.clientY), orig: draft };
  }

  function onMoveMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "move") return;
    const p = toPct(e.clientX, e.clientY);
    const { orig, start } = drag;
    liveRef.current = {
      ...orig,
      x: clamp(orig.x + (p.x - start.x), 0, 100 - orig.w),
      y: clamp(orig.y + (p.y - start.y), 0, 100 - orig.h),
    };
    schedule();
  }

  // ── Resize (adjusting mode, corner handles) ──
  function onHandleDown(kind: "nw" | "ne" | "sw" | "se") {
    return (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!draft) return;
      e.stopPropagation();
      beginGesture(e);
      dragRef.current = { kind, orig: draft };
    };
  }

  function onHandleMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.kind === "draw" || drag.kind === "move") return;
    liveRef.current = resizeRect(drag.orig, drag.kind, toPct(e.clientX, e.clientY));
    schedule();
  }

  function endAdjustDrag() {
    const drag = dragRef.current;
    if (drag && drag.kind !== "draw") {
      dragRef.current = null;
      commitLive();
    }
  }

  // ── Bar actions ──
  const totalAreas = marks.length + (draft ? 1 : 0);
  const canSend = totalAreas > 0 && note.trim().length > 0;

  function addAnother() {
    if (!draft) return;
    setMarks((m) => [...m, draft]);
    liveRef.current = null;
    setDraft(null);
    setMode("selecting");
  }

  function removeMark(i: number) {
    setMarks((m) => m.filter((_, idx) => idx !== i));
  }

  function send() {
    if (!canSend) return;
    const rects = draft ? [...marks, draft] : marks;
    onAttach({ rects, note: note.trim(), host });
    onClose();
  }

  const barVisible = mode === "adjusting" || (mode === "selecting" && marks.length > 0);
  const handleBase =
    "absolute z-30 h-2.5 w-2.5 rounded-[2px] border border-[#0056fd] bg-white shadow-sm";
  // The number sits INSIDE the corner: outside it collided with the nw resize
  // handle (which is on top, so the digit vanished) and clipped off-screen on
  // boxes drawn against the left/top edge.
  const badgeClass =
    "absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#0056fd] text-[11px] font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.45)]";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review your site"
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Full-screen top toolbar (like the studio Preview) — the site fills the
          whole viewport below it, edge to edge, so it reads at real size. */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <p className="text-sm font-medium">Review your site</p>
        <span className="hidden items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground sm:inline-flex">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {host}
        </span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="ml-auto rounded-[6px] p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* Full-bleed site preview + the light floating capture overlay */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-secondary/20">
        <div className="h-full w-full overflow-y-auto overflow-x-hidden">
          {/* The site content + annotation surface share this coordinate box.
              It stretches to the full viewport height so the page never ends
              mid-screen — the real embed fills the frame the same way. */}
          <div ref={frameRef} className="relative flex min-h-full flex-col select-none">
            {embed ? (
              <iframe
                src={siteUrl}
                title="Your site"
                className="min-h-[calc(100vh-3rem)] w-full flex-1 border-0"
              />
            ) : (
              <MockSite />
            )}

            {/* Committed marks — numbered so one note can reference them all. */}
            {marks.map((r, i) => (
              <div
                key={`${r.x}-${r.y}-${i}`}
                className="pointer-events-none absolute z-10 rounded-[4px] border-2 border-[#0056fd] bg-[#0056fd]/[0.06]"
                style={boxStyle(r)}
              >
                <span className={badgeClass}>{i + 1}</span>
              </div>
            ))}

            {/* The ACTIVE box — draggable to move, corner handles to resize. */}
            {draft && (
              <div
                ref={boxRef}
                onPointerDown={onMoveDown}
                onPointerMove={onMoveMove}
                onPointerUp={endAdjustDrag}
                className={`absolute z-20 rounded-[4px] border-2 border-[#0056fd] ${
                  mode === "adjusting" ? "cursor-move" : "pointer-events-none"
                }`}
                style={{
                  ...boxStyle(draft),
                  backgroundColor: mode === "adjusting" ? "rgba(0,86,253,0.06)" : "rgba(0,86,253,0.10)",
                  // The dim is the box's OWN shadow, so it follows the box for
                  // free while dragging — nothing extra to update per frame.
                  // (Skipped once there are several marks: a single box's dim
                  // would hide the others.) The selection line is ONE colour —
                  // the dim already separates it from the site, so no halo.
                  boxShadow: marks.length === 0 ? "0 0 0 9999px rgba(0,0,0,0.45)" : undefined,
                }}
              >
                {marks.length > 0 && <span className={badgeClass}>{marks.length + 1}</span>}
                {mode === "adjusting" && (
                  <>
                    <div onPointerDown={onHandleDown("nw")} onPointerMove={onHandleMove} onPointerUp={endAdjustDrag} className={`${handleBase} -left-1.5 -top-1.5 cursor-nwse-resize`} />
                    <div onPointerDown={onHandleDown("ne")} onPointerMove={onHandleMove} onPointerUp={endAdjustDrag} className={`${handleBase} -right-1.5 -top-1.5 cursor-nesw-resize`} />
                    <div onPointerDown={onHandleDown("sw")} onPointerMove={onHandleMove} onPointerUp={endAdjustDrag} className={`${handleBase} -bottom-1.5 -left-1.5 cursor-nesw-resize`} />
                    <div onPointerDown={onHandleDown("se")} onPointerMove={onHandleMove} onPointerUp={endAdjustDrag} className={`${handleBase} -bottom-1.5 -right-1.5 cursor-nwse-resize`} />
                  </>
                )}
              </div>
            )}

            {/* Capture layer — intercepts pointer events only while selecting. */}
            {mode === "selecting" && (
              <div
                onPointerDown={onDrawDown}
                onPointerMove={onDrawMove}
                onPointerUp={onDrawUp}
                className="absolute inset-0 z-20 cursor-crosshair bg-[#0056fd]/[0.02]"
              />
            )}

            {/* Helper banner + a clear way out, while selecting. */}
            {mode === "selecting" && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex items-center justify-center gap-2">
                <span className="rounded-full bg-foreground/90 px-3 py-1.5 text-[12px] font-medium text-background shadow-lg">
                  {marks.length > 0 ? "Drag another box — or use the bar below" : "Drag a box over the part you want to talk about"}
                </span>
                <button
                  type="button"
                  onClick={() => (marks.length > 0 ? setMode("adjusting") : setMode("idle"))}
                  className="pointer-events-auto rounded-full bg-foreground/90 px-3 py-1.5 text-[12px] font-medium text-background/70 shadow-lg transition-colors hover:text-background"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* The light floating overlay — superimposed on the preview, not a
            separate window. Idle: the client sees their site + this pill;
            capture is a MODE they activate here, then select the area. */}
        {mode === "idle" && (
          <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/75 py-1.5 pl-3.5 pr-1.5 text-white shadow-2xl backdrop-blur-md">
              <span className="text-[12px] text-white/75">Point out something on your site</span>
              <button
                type="button"
                onClick={() => setMode("selecting")}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0056fd] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#0047e0]"
              >
                <Crop className="h-3.5 w-3.5" strokeWidth={2} />
                Select area
              </button>
            </div>
          </div>
        )}

        {/* Fixed bottom comment bar — never clips (replaces the box-anchored
            popover). One note describes all numbered areas; Send ships them. */}
        {barVisible && (
          <div className="absolute inset-x-0 bottom-4 z-40 flex justify-center px-4">
            <div className="flex w-[min(760px,100%)] flex-wrap items-center gap-2 rounded-[14px] border border-white/15 bg-black/80 p-2 text-white shadow-2xl backdrop-blur-md transition-colors focus-within:border-white/30">
              {marks.length > 0 && (
                <div className="flex items-center gap-1">
                  {marks.map((_, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-white/10 py-0.5 pl-2 pr-1 text-[11px] font-medium"
                    >
                      {i + 1}
                      <button
                        type="button"
                        aria-label={`Remove area ${i + 1}`}
                        onClick={() => removeMark(i)}
                        className="rounded-full p-0.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                autoFocus
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                placeholder={totalAreas > 1 ? "What would you like changed in these areas?" : "What would you like changed here?"}
                className="min-w-[180px] flex-1 bg-transparent px-2 py-1.5 text-[13px] outline-none placeholder:text-white/45"
              />
              <button
                type="button"
                onClick={resetAll}
                className="rounded-full px-2.5 py-1.5 text-[12px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addAnother}
                disabled={!draft}
                className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Add another area
              </button>
              <button
                type="button"
                onClick={send}
                disabled={!canSend}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0056fd] px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#0047e0] disabled:opacity-40"
              >
                Send
                <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ReviewThumb — the marked-area card shown inside a chat bubble once a review
 * is attached. Front only: a low-fi echo of the site's layout with the client's
 * numbered boxes drawn on top, so the regions read at a glance. The real
 * version swaps in an actual screenshot of the client's site.
 */
export function ReviewThumb({
  rects,
  host,
  onAccent,
}: {
  rects: Rect[];
  host: string;
  onAccent?: boolean;
}) {
  return (
    <span
      className={`mt-2 block overflow-hidden rounded-[8px] border ${
        onAccent ? "border-white/25 bg-white/12" : "border-border bg-background/70"
      }`}
    >
      {/* Mini browser bar */}
      <span className="flex items-center gap-1.5 border-b border-border/60 px-2 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
        <span className={`ml-1 truncate font-mono text-[10px] ${onAccent ? "text-white/80" : "text-muted-foreground"}`}>
          {host}
        </span>
      </span>

      {/* Low-fi wireframe echoing MockSite's layout + the marked boxes, with
          the same spotlight the overlay uses when there's a single area. */}
      <span className="relative block">
        <MiniWire />
        {rects.length === 1 && <Spotlight rect={rects[0]} dim="bg-black/25" />}
        {rects.map((r, i) => (
          <span
            key={`${r.x}-${r.y}-${i}`}
            aria-hidden
            className="absolute rounded-[3px] border-2 border-[#0056fd] bg-[#0056fd]/10"
            style={boxStyle(r)}
          >
            {rects.length > 1 && (
              <span className="absolute left-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0056fd] text-[8px] font-semibold text-white">
                {i + 1}
              </span>
            )}
          </span>
        ))}
      </span>
    </span>
  );
}

// A dim scrim framing the selected rect (four strips around it) so the picked
// area reads as the clear focal point — the annotation-tool "spotlight" that
// makes "Maxwell sees this exact area" literal. Strips are bounded to the box
// edges, so the browser chrome above the frame stays bright. Rendered as
// <span>s (absolutely positioned, so display is moot) so the same component is
// valid inside ReviewThumb's span-only markup; `dim` softens the shade at
// thumbnail scale.
function Spotlight({ rect, dim = "bg-black/45" }: { rect: Rect; dim?: string }) {
  const scrim = `pointer-events-none absolute ${dim}`;
  return (
    <>
      <span aria-hidden className={scrim} style={{ left: 0, right: 0, top: 0, height: `${rect.y}%` }} />
      <span aria-hidden className={scrim} style={{ left: 0, right: 0, top: `${rect.y + rect.h}%`, bottom: 0 }} />
      <span aria-hidden className={scrim} style={{ top: `${rect.y}%`, height: `${rect.h}%`, left: 0, width: `${rect.x}%` }} />
      <span aria-hidden className={scrim} style={{ top: `${rect.y}%`, height: `${rect.h}%`, left: `${rect.x + rect.w}%`, right: 0 }} />
    </>
  );
}

// The marking surface — a representative dashboard so drag-a-box lands on real-
// looking UI. Replaced by the client's real site (embedded / captured) later.
function MockSite() {
  return (
    <div className="flex min-h-[440px] flex-1 bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden w-44 shrink-0 flex-col gap-1 border-r border-border bg-secondary/20 p-3 sm:flex">
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="h-5 w-5 rounded-md bg-[#0056fd]" />
          <span className="text-[13px] font-semibold">OpsDash</span>
        </div>
        {["Overview", "Field teams", "Jobs", "Reports", "Settings"].map((item, i) => (
          <div
            key={item}
            className={`rounded-[6px] px-2.5 py-1.5 text-[12px] ${i === 0 ? "bg-[#0056fd]/10 font-medium text-[#0056fd]" : "text-muted-foreground"}`}
          >
            {item}
          </div>
        ))}
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Field operations</h3>
            <p className="text-[12px] text-muted-foreground">Live status across all teams</p>
          </div>
          <span className="rounded-[6px] bg-[#0056fd] px-3 py-1.5 text-[12px] font-medium text-white">New job</span>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          {[
            { k: "Active jobs", v: "128" },
            { k: "On site", v: "34" },
            { k: "Completed", v: "1,204" },
          ].map((s) => (
            <div key={s.k} className="rounded-[8px] border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground">{s.k}</p>
              <p className="mt-1 text-xl font-semibold">{s.v}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 h-32 rounded-[8px] border border-border bg-gradient-to-br from-[#0056fd]/15 to-transparent p-3">
          <p className="text-[12px] font-medium">Jobs over time</p>
          <div className="mt-3 flex h-16 items-end gap-1.5">
            {[40, 65, 45, 80, 55, 70, 90, 60, 75].map((h, i) => (
              <span key={i} className="flex-1 rounded-t bg-[#0056fd]/40" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>

        <div className="mb-4 overflow-hidden rounded-[8px] border border-border">
          <div className="grid grid-cols-4 gap-3 border-b border-border bg-secondary/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Team</span>
            <span>Job</span>
            <span>Status</span>
            <span>ETA</span>
          </div>
          {[
            ["North", "Install #4021", "On route", "12m"],
            ["West", "Repair #4019", "On site", "—"],
            ["South", "Survey #4022", "Scheduled", "1h"],
            ["East", "Install #4023", "On route", "35m"],
            ["North", "Repair #4024", "Scheduled", "2h"],
          ].map((row) => (
            <div key={row[1]} className="grid grid-cols-4 gap-3 border-b border-border px-3 py-2.5 text-[12px] last:border-b-0">
              <span>{row[0]}</span>
              <span className="text-muted-foreground">{row[1]}</span>
              <span>{row[2]}</span>
              <span className="text-muted-foreground">{row[3]}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[8px] border border-border p-3">
            <p className="mb-2.5 text-[12px] font-medium">Recent activity</p>
            {[
              ["Marta L.", "closed Repair #4012"],
              ["Diego R.", "started Install #4021"],
              ["Ana P.", "added a note to #4019"],
            ].map(([who, what]) => (
              <div key={what} className="flex items-center gap-2 py-1.5 text-[12px]">
                <span className="h-5 w-5 shrink-0 rounded-full bg-[#0056fd]/25" />
                <span className="truncate">
                  <span className="font-medium">{who}</span>{" "}
                  <span className="text-muted-foreground">{what}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="rounded-[8px] border border-border p-3">
            <p className="mb-2.5 text-[12px] font-medium">Coverage by region</p>
            {[
              ["North", 82],
              ["West", 64],
              ["South", 45],
            ].map(([label, pct]) => (
              <div key={label as string} className="py-1.5">
                <div className="mb-1 flex justify-between text-[11px]">
                  <span>{label}</span>
                  <span className="text-muted-foreground">{pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-[#0056fd]/60" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* mt-auto: the footer sits at the bottom of the frame, so the page
            reads as finished instead of stopping halfway down the screen. */}
        <footer className="mt-auto flex items-center justify-between border-t border-border pt-4 text-[11px] text-muted-foreground">
          <span>© 2026 OpsDash</span>
          <span className="flex gap-4">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Support</span>
          </span>
        </footer>
      </div>
    </div>
  );
}

// A compact, proportional echo of MockSite (sidebar · header · KPI row · chart ·
// table) so a box drawn over the real thing lands on a recognizable region here.
function MiniWire() {
  return (
    <span className="flex h-[150px] w-full bg-background">
      {/* sidebar */}
      <span className="hidden w-[18%] shrink-0 flex-col gap-1 border-r border-border/60 bg-secondary/20 p-1.5 sm:flex">
        <span className="mb-0.5 block h-2 w-2 rounded-sm bg-[#0056fd]" />
        <span className="block h-1.5 w-full rounded-sm bg-foreground/10" />
        <span className="block h-1.5 w-3/4 rounded-sm bg-foreground/[0.07]" />
        <span className="block h-1.5 w-3/4 rounded-sm bg-foreground/[0.07]" />
      </span>
      {/* main */}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
        <span className="flex items-center justify-between">
          <span className="block h-2 w-1/3 rounded-sm bg-foreground/20" />
          <span className="block h-2.5 w-8 rounded-sm bg-[#0056fd]/70" />
        </span>
        <span className="grid grid-cols-3 gap-1.5">
          <span className="block h-6 rounded-sm border border-border/70 bg-foreground/[0.04]" />
          <span className="block h-6 rounded-sm border border-border/70 bg-foreground/[0.04]" />
          <span className="block h-6 rounded-sm border border-border/70 bg-foreground/[0.04]" />
        </span>
        <span className="block h-10 rounded-sm border border-border/70 bg-gradient-to-br from-[#0056fd]/15 to-transparent" />
        <span className="block h-1.5 w-full rounded-sm bg-foreground/[0.06]" />
        <span className="block h-1.5 w-5/6 rounded-sm bg-foreground/[0.06]" />
      </span>
    </span>
  );
}
