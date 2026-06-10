"use client";

import { useEffect, useRef, useState } from "react";

// TweetEmbed — renders a REAL tweet via X's official embed (widgets.js,
// createTweet). The card (avatar, handle, verified badge, text, timestamp) is
// served and rendered by X, so the content is authentic and can't be edited
// here — we only pass a real tweet id. Theme follows the site's current theme.
// Used in About → "The shift" as verifiable industry voices (not endorsements).

declare global {
  interface Window {
    twttr?: { widgets?: { createTweet?: (id: string, el: HTMLElement, opts?: Record<string, unknown>) => Promise<unknown> } };
  }
}

const SCRIPT_ID = "twitter-wjs";

function loadWidgets(): Promise<void> {
  return new Promise((resolve) => {
    if (window.twttr?.widgets) return resolve();
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = "https://platform.twitter.com/widgets.js";
    s.async = true;
    s.addEventListener("load", () => resolve());
    document.body.appendChild(s);
  });
}

export function TweetEmbed({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    loadWidgets().then(() => {
      const el = ref.current;
      if (cancelled || !el || !window.twttr?.widgets?.createTweet) return setState("error");
      el.innerHTML = "";
      window.twttr.widgets
        .createTweet(id, el, { theme, dnt: true, conversation: "none", align: "center" })
        .then((node) => !cancelled && setState(node ? "ready" : "error"))
        .catch(() => !cancelled && setState("error"));
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="min-h-[160px]">
      <div ref={ref} />
      {state === "loading" && (
        <div className="h-40 animate-pulse rounded-[14px] border border-foreground/10 bg-card/30" />
      )}
      {state === "error" && (
        <a
          href={`https://x.com/i/status/${id}`}
          target="_blank"
          rel="noreferrer"
          className="flex h-40 items-center justify-center rounded-[14px] border border-foreground/12 bg-card/30 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          View post on X ↗
        </a>
      )}
    </div>
  );
}
