"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
  const startTimeRef = useRef<number | null>(null);

  const animate = useCallback(
    (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);

      setCount(easedProgress * end);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    },
    [duration, end]
  );

  useEffect(() => {
    if (isVisible && !hasAnimated) {
      const timeoutId = setTimeout(() => {
        setHasAnimated(true);
        animationRef.current = requestAnimationFrame(animate);
      }, delay);

      return () => {
        clearTimeout(timeoutId);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isVisible, hasAnimated, animate, delay]);

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
