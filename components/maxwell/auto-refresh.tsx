"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * AutoRefresh — re-runs the current server component tree on an interval via
 * `router.refresh()`. Used by the workspace "Preparing" state so the page flips
 * to the live portal on its own the moment provisioning lands (the route is
 * `force-dynamic`, so each refresh re-reads the workspace row) — no manual
 * reload asked of a client who just paid.
 *
 * Only ticks while the tab is visible: a backgrounded tab stops polling (no
 * server churn), and the `visibilitychange` listener refreshes once on return
 * so the client never stares at a stale "preparing" after coming back.
 */
export function AutoRefresh({ intervalMs = 20_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);

  return null;
}
