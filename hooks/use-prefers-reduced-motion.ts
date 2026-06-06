"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Whether the user prefers reduced motion — capturing the INITIAL state of the
 * media query.
 *
 * Unlike framer-motion's `useReducedMotion()` (which seeds `false` and only
 * reacts to later `change` events, so it misses a preference already set before
 * the page loaded — i.e. every real reduced-motion user), this reads the live
 * `matches` value. `useSyncExternalStore` keeps it SSR-safe (server snapshot =
 * `false`, so markup matches) and avoids a setState-in-effect.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
