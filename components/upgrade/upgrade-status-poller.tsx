"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionWithDetails } from "@/lib/upgrade/types";

const POLL_INTERVAL_MS = 2500;

const ACTIVE_STATUSES = new Set(["crawling", "analyzing", "generating"]);

type Props = {
  sessionId: string;
  initialSession: SessionWithDetails;
  children: (session: SessionWithDetails, isPolling: boolean) => React.ReactNode;
};

/**
 * Polls GET /api/upgrade/[id] while the session is in an active (processing) state.
 * Stops polling once the status is terminal (audit_ready, version_ready, error, etc.)
 */
export function UpgradeStatusPoller({ sessionId, initialSession, children }: Props) {
  const [session, setSession] = useState<SessionWithDetails>(initialSession);
  const [isPolling, setIsPolling] = useState(ACTIVE_STATUSES.has(initialSession.status));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  // Ref to the latest `poll` so setTimeout callbacks pick up updates after sessionId changes
  // and we avoid referencing `poll` inside its own definition (TDZ / stale closure).
  const pollRef = useRef<() => void>(() => undefined);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/upgrade/${sessionId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!mountedRef.current) return;

      const updated: SessionWithDetails = data.session;
      setSession(updated);

      if (ACTIVE_STATUSES.has(updated.status)) {
        timerRef.current = setTimeout(() => pollRef.current(), POLL_INTERVAL_MS);
      } else {
        setIsPolling(false);
      }
    } catch {
      // network error — retry after interval
      if (mountedRef.current) {
        timerRef.current = setTimeout(() => pollRef.current(), POLL_INTERVAL_MS);
      }
    }
  }, [sessionId]);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  useEffect(() => {
    mountedRef.current = true;
    // Sync session state immediately so the UI reflects server data right away
    // after router.refresh(). Idiomatic Next/React would instead use `key={session.id}`
    // on the parent so this component remounts; refactor tracked as separate gap.
    setSession(initialSession);

    if (ACTIVE_STATUSES.has(initialSession.status)) {
      setIsPolling(true);
      timerRef.current = setTimeout(() => pollRef.current(), POLL_INTERVAL_MS);
    } else {
      setIsPolling(false);
    }

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // initialSession (whole object) intentionally not in deps to avoid re-run on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSession.status, poll]);

  return <>{children(session, isPolling)}</>;
}
