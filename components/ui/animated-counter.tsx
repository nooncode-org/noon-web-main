"use client";

import { useEffect, useState, useRef } from "react";
import { useRevealOnView } from "@/hooks/use-reveal-on-view";

type AnimatedCounterProps = {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  delay?: number;
};

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function AnimatedCounter({
  end,
  duration = 2000,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
  delay = 0,
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const { ref, isVisible } = useRevealOnView<HTMLSpanElement>({
    threshold: 0.3,
    once: true,
  });
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isVisible || hasAnimated) return;

    const timeoutId = setTimeout(() => {
      setHasAnimated(true);

      // Local closure instead of a self-referential useCallback (which the
      // react-hooks rules flag as "used before declared"). `tick` is only
      // invoked on the next animation frame, after it is assigned.
      let startTime: number | null = null;
      const tick = (timestamp: number) => {
        if (startTime === null) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setCount(easeOutExpo(progress) * end);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(tick);
        } else {
          setCount(end);
        }
      };

      animationRef.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isVisible, hasAnimated, duration, end, delay]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const displayValue =
    decimals > 0 ? count.toFixed(decimals) : Math.round(count).toString();

  return (
    <span
      ref={ref}
      className={`tabular-nums transition-opacity duration-500 ${
        isVisible ? "opacity-100" : "opacity-0"
      } ${className}`}
    >
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
}
