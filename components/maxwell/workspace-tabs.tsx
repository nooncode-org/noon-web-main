"use client";

// WorkspaceTabs — the client portal's section switcher. The tabs behave like
// real tabs (not in-page anchors): selecting one swaps the visible panel, it
// does NOT scroll a long page. All panels stay mounted (hidden via `hidden`)
// so interactive ones (Messages / Requests forms) keep their draft state across
// switches. Each child carries a `data-panel` matching a tab id; MULTIPLE
// children may share the same `data-panel` (e.g. Overview = hero + activity),
// and all of them show together under that tab — no need to be contiguous.

import { Children, cloneElement, isValidElement, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

type Tab = { id: string; label: string };

export function WorkspaceTabs({ tabs, children }: { tabs: Tab[]; children: ReactNode }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const navRef = useRef<HTMLElement>(null);

  function select(id: string) {
    setActive(id);
    // New panel starts at the top: reset the scrolling content column (the
    // surface is viewport-locked; the column scrolls, not the window).
    const scroller = navRef.current?.closest(".overflow-y-auto");
    if (scroller) scroller.scrollTop = 0;
  }

  const panels = Children.toArray(children).filter(isValidElement) as ReactElement<{
    "data-panel"?: string;
    className?: string;
  }>[];

  return (
    <>
      {/* pl-14 is only needed on the HEADER (the fixed ▢ overlaps it); the tabs
          and content sit below it, so they keep symmetric gutters (px-6, lg:px-14
          matching the header's left edge on desktop). */}
      <nav
        ref={navRef}
        aria-label="Workspace sections"
        className="sticky top-0 z-10 border-b border-border bg-background/90 px-6 backdrop-blur lg:px-14"
      >
        <div className="flex gap-1 overflow-x-auto py-2" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active === t.id}
              onClick={() => select(t.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
                active === t.id
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
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
    </>
  );
}
