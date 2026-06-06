"use client";

import { useSyncExternalStore } from "react";

// Returns false during SSR and the first client render (so server/client markup
// match — no hydration mismatch), then true after hydration. Uses
// useSyncExternalStore rather than a setState-in-effect mounted flag so it stays
// lint-clean (react-hooks/set-state-in-effect) and is the React-idiomatic way to
// read a "have we hydrated yet" value. React re-renders once after hydration
// when the client snapshot (true) differs from the server snapshot (false).
const emptySubscribe = () => () => {};

export function useHasMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
