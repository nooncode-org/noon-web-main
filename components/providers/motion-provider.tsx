"use client";

import { MotionConfig } from "framer-motion";

/**
 * MotionProvider — global motion baseline for the whole app.
 *
 * `reducedMotion="user"` makes every framer-motion animation honor the user's
 * `prefers-reduced-motion` setting automatically (entrances, layout, gestures),
 * which is the Vercel-grade accessibility baseline (audit #7 / additive D1).
 * Pair with the global CSS reduced-motion rule in `globals.css` for the
 * non-framer (CSS / inline-transition) animations.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
