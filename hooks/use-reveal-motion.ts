"use client";

import { useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { useHasMounted } from "./use-has-mounted";

// Margin type, derived from framer's own useInView signature so we don't depend
// on a named type export.
type InViewMargin = NonNullable<Parameters<typeof useInView>[1]>["margin"];

/**
 * Scroll-reveal gate for framer-motion entrances. Returns:
 *  - `ref`  — attach to the element whose visibility drives the entrance
 *  - `show` — true during SSR + first client paint (so server/client markup
 *             match — no hydration mismatch), then once the element scrolls into
 *             view; always true when the user prefers reduced motion.
 *
 * Pair with `initial={false}` on the motion nodes and animate between the
 * visible and hidden states off `show`. Reveals once and stays.
 */
export function useRevealMotion<T extends Element = HTMLDivElement>(
  options?: { margin?: InViewMargin },
) {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, margin: options?.margin ?? "-60px" });
  const reduce = useReducedMotion() ?? false;
  const mounted = useHasMounted();
  const show = !mounted || inView || reduce;
  return { ref, show };
}
