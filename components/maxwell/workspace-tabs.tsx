"use client";

// WorkspaceTabs — the client portal's section switcher. The tabs behave like
// real tabs (not in-page anchors): selecting one swaps the visible panel, it
// does NOT scroll a long page. All panels stay mounted (hidden via `hidden`)
// so interactive ones (Messages / Requests forms) keep their draft state across
// switches. Each child carries a `data-panel` matching a tab id; MULTIPLE
// children may share the same `data-panel` (e.g. Overview = hero + activity),
// and all of them show together under that tab — no need to be contiguous.

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";

// A tab's optional notification indicator:
//  · "unread" → blue, clears once you open the section (a new message, a new build)
//  · "action" → amber, STAYS until you resolve it (approve a version, verify a domain)
// `count` renders a small number badge (colored per kind) instead of a plain dot.
type Tab = { id: string; label: string; pending?: "unread" | "action"; count?: number };

// Lets content INSIDE a panel drive the tabs: `select` switches tabs (e.g. the
// "Request a change" chip jumps to Chat); `resolvePending` clears a tab's
// "action" indicator once the thing is actually resolved (e.g. approving the
// ready version turns off the amber dot on Versions). Null outside a
// WorkspaceTabs tree.
type WorkspaceTabsApi = {
  select: (id: string) => void;
  resolvePending: (id: string) => void;
};
const WorkspaceTabsContext = createContext<WorkspaceTabsApi | null>(null);

export function useWorkspaceTabs() {
  return useContext(WorkspaceTabsContext);
}

export function WorkspaceTabs({ tabs, children }: { tabs: Tab[]; children: ReactNode }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  // Sections you've already opened this session — their "unread" dot is
  // cleared. The tab you land on counts as seen. (Front-only: real "pending"
  // state + persistence is logic-later; this just models the clear-on-open UX.)
  const [seen, setSeen] = useState<Set<string>>(() => new Set(tabs[0]?.id ? [tabs[0].id] : []));
  // "action" indicators DON'T clear on open — they clear when the thing is
  // resolved (content calls resolvePending via context, e.g. after approving
  // the ready version).
  const [resolved, setResolved] = useState<Set<string>>(() => new Set());
  const navRef = useRef<HTMLElement>(null);

  function select(id: string) {
    setActive(id);
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    // New panel starts at the top: reset the scrolling content column (the
    // surface is viewport-locked; the column scrolls, not the window).
    const scroller = navRef.current?.closest(".overflow-y-auto");
    if (scroller) scroller.scrollTop = 0;
  }

  function resolvePending(id: string) {
    setResolved((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  // ARIA tabs keyboard pattern (audit P1-10): ←/→ move + activate (roving
  // tabindex — only the active tab is in the tab order), Home/End jump to the
  // edges. Activation follows focus (the common automatic-activation flavor).
  function onTablistKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const ids = tabs.map((t) => t.id);
    const idx = ids.indexOf(active);
    let next: string | null = null;
    if (e.key === "ArrowRight") next = ids[(idx + 1) % ids.length];
    else if (e.key === "ArrowLeft") next = ids[(idx - 1 + ids.length) % ids.length];
    else if (e.key === "Home") next = ids[0];
    else if (e.key === "End") next = ids[ids.length - 1];
    if (!next || next === active) return;
    e.preventDefault();
    select(next);
    navRef.current
      ?.querySelector<HTMLButtonElement>(`[data-tabid="${next}"]`)
      ?.focus();
  }

  const panels = Children.toArray(children).filter(isValidElement) as ReactElement<{
    "data-panel"?: string;
    className?: string;
  }>[];

  return (
    <WorkspaceTabsContext.Provider value={{ select, resolvePending }}>
      {/* pl-14 is only needed on the HEADER (the fixed ▢ overlaps it); the tabs
          and content sit below it, so they keep symmetric gutters (px-6, lg:px-14
          matching the header's left edge on desktop). */}
      <nav
        ref={navRef}
        aria-label="Workspace sections"
        // Sticks just below the h-14 header (top-14) so the two form one cohesive
        // top bar; solid bg (no translucency) so scrolling content never bleeds
        // through. Pairs with a `sticky top-0` header in the host page.
        className="relative sticky top-14 z-10 border-b border-border bg-card px-6 lg:px-14"
      >
        {/* Mobile: the tab row scrolls sideways; this right-edge fade is the
            affordance that there's more (e.g. "Domains" clipped at 375px). */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-card to-transparent md:hidden"
        />
        <div className="flex gap-1 overflow-x-auto py-2" role="tablist" onKeyDown={onTablistKeyDown}>
          {tabs.map((t) => {
            // "unread" indicators clear once you've opened the section; "action"
            // ones stay until the thing is actually resolved (resolvePending).
            const showAlert =
              Boolean(t.pending) &&
              !(t.pending === "unread" && seen.has(t.id)) &&
              !resolved.has(t.id);
            const action = t.pending === "action";
            const count = typeof t.count === "number" && t.count > 0 ? t.count : null;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                data-tabid={t.id}
                aria-selected={active === t.id}
                tabIndex={active === t.id ? 0 : -1}
                onClick={() => select(t.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0056fd]/60 ${
                  active === t.id
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                {t.label}
                {showAlert && (
                  <>
                    {count !== null ? (
                      <span
                        aria-hidden
                        className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none ${
                          action ? "bg-[#f59e0b] text-[#451a03]" : "bg-[#0056fd] text-white"
                        }`}
                      >
                        {/* Geist digits sit slightly low in a tight line box; nudge
                            just the number (not the circle) so it's optically centered.
                            Small value on purpose — this is subpixel and DPI-sensitive. */}
                        <span className="inline-block" style={{ transform: "translateY(0.5px)" }}>
                          {count > 99 ? "99+" : count}
                        </span>
                      </span>
                    ) : (
                      <span
                        aria-hidden
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${action ? "bg-[#f59e0b]" : "bg-[#0056fd]"}`}
                      />
                    )}
                    <span className="sr-only"> ({action ? "action needed" : "updates"})</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="space-y-5 px-6 py-6 lg:px-14">
        {panels.map((panel, i) => {
          const hidden = active !== panel.props["data-panel"];
          return cloneElement(panel, {
            key: i,
            className: `${panel.props.className ?? ""}${hidden ? " hidden" : ""}`.trim(),
          });
        })}
      </main>
    </WorkspaceTabsContext.Provider>
  );
}
