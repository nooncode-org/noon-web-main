"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

type UseRevealOnViewOptions = {
  threshold?: number | number[];
  rootMargin?: string;
  once?: boolean;
  initialVisible?: boolean;
};

/**
 * Scroll-reveal gate (IntersectionObserver). Shared by `FadeIn`, `StaggeredReveal`
 * and other CSS-transition reveals.
 *
 * Accessibility: when the user prefers reduced motion, content is reported
 * `isVisible` immediately — it never depends on a scroll to appear and never
 * animates. (Pairs with the global reduced-motion rule in `globals.css`, which
 * also zeroes the transition so the reveal is instant.) Motion users keep the
 * original observer-driven, no-flash behavior (starts hidden, reveals on view).
 */
export function useRevealOnView<T extends Element = HTMLDivElement>({
  threshold = 0.1,
  rootMargin = "0px",
  once = true,
  initialVisible = false,
}: UseRevealOnViewOptions = {}) {
  const ref = useRef<T | null>(null);
  const reduce = useReducedMotion() ?? false;
  const [intersected, setIntersected] = useState(initialVisible);

  useEffect(() => {
    // Reduced motion: skip the observer entirely. `isVisible` is derived as
    // `true` below, so content shows immediately with no animation.
    if (reduce) {
      return;
    }

    const node = ref.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIntersected(true);
          if (once) {
            observer.disconnect();
          }
          return;
        }
        if (!once) {
          setIntersected(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [once, rootMargin, threshold, reduce]);

  const isVisible = reduce ? true : intersected;

  return { ref, isVisible };
}
