"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface AnimatedConnectionProps {
  direction?: "horizontal" | "vertical";
  active?: boolean;
  /** When false (reduced motion), show a static line with no flowing dot. */
  animate?: boolean;
  /** Seconds to offset, so the connection lights up in flow order. */
  delay?: number;
}

// Theme-aware connector. The line draws in once; a single dot travels through
// it once (finite) to suggest the hand-off between steps. Static under reduced
// motion. No infinite loops.
export function AnimatedConnection({
  direction = "horizontal",
  active = false,
  animate = true,
  delay = 0,
}: AnimatedConnectionProps) {
  const isHorizontal = direction === "horizontal";
  const length = isHorizontal ? 40 : 40;
  const [dot, setDot] = useState(0);

  useEffect(() => {
    if (active && animate) {
      const id = setTimeout(() => setDot((d) => d + 1), delay * 1000);
      return () => clearTimeout(id);
    }
    // reset when out of view so the dot re-fires on the next entry
    setDot(0);
  }, [active, animate, delay]);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: isHorizontal ? length : 2, height: isHorizontal ? 2 : length }}
    >
      {/* Base line — muted by default, primary tint when active */}
      <motion.div
        className="absolute"
        style={{
          width: isHorizontal ? "100%" : 2,
          height: isHorizontal ? 2 : "100%",
          background: active ? "rgba(18,0,197,0.45)" : "var(--border)",
        }}
        initial={{ scaleX: isHorizontal ? 0 : 1, scaleY: isHorizontal ? 1 : 0 }}
        animate={{ scaleX: 1, scaleY: 1 }}
        transition={{ duration: 0.45, delay, ease: [0.32, 0.72, 0, 1] }}
      />

      {/* One travelling dot, fired after `delay`; re-fires on each re-entry */}
      {dot > 0 && (
        <motion.span
          key={dot}
          className="absolute rounded-full bg-primary"
          style={{ width: 5, height: 5, [isHorizontal ? "left" : "top"]: 0 }}
          initial={{ [isHorizontal ? "x" : "y"]: 0, opacity: 0 }}
          animate={{ [isHorizontal ? "x" : "y"]: length, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.7, ease: "linear" }}
        />
      )}
    </div>
  );
}
